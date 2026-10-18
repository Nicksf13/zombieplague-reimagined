import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { manualFallComparison, parseLearningTrace, traceWindow } from "./bot-learning-trace.mjs";
export { parseLearningTrace } from "./bot-learning-trace.mjs";

const learners = ["tactical", "motion", "profile", "passage", "place", "boost"];
const identity = row => JSON.stringify([row.Session, row.Bot, row.Learner, row.Experience]);
const increment = (table, key) => { table[key] = (table[key] ?? 0) + 1; };
const delta = (end, start) => Number.isFinite(end) && Number.isFinite(start) && end >= start ? end - start : null;
function noUpdateReason(row) {
    if (row.Evaluation === true) return "expected_frozen_evaluation";
    if (row.Learning === false) return "expected_learning_disabled";
    if (row.Outcome === "superseded") return "expected_controller_substitution";
    if (row.Reason === "no_issued_tactical_execution") return "expected_no_executed_command";
    if (row.Outcome === "interrupted") return "expected_unknown_interruption";
    if ((row.Learner === "tactical" || row.Learner === "place") && row.Total === 0) return "expected_zero_reward";
    return "needs_review_not_automatically_a_defect";
}

/** Counts events and confirmed state; never infers that an absent update is a failure. */
export function analyzeLearningSession(capture, { phase, bot, matches = [] } = {}) {
    const { Rows: rows, Start: start, End: end, Coverage } = traceWindow(capture, phase, bot);
    const starts = new Map(), finals = new Map(), updates = new Map();
    const issues = [], superseded = new Map(), unassigned = new Map(), limitations = {};
    for (const row of rows) {
        const key = identity(row);
        if (row.Kind === "start" || row.Kind === "finalize" || row.Kind === "update") {
            if (!row.Experience) throw new Error("Lifecycle/update record without an experience ID.");
            const table = row.Kind === "start" ? starts : row.Kind === "finalize" ? finals : updates;
            if (table.has(key)) issues.push({ Problem: "duplicate_" + row.Kind, Learner: row.Learner, Experience: row.Experience });
            else table.set(key, row);
        }
        if ((row.Kind === "update" || row.Kind === "finalize") && row.Updated === true &&
            (row.Evaluation === true || row.Learning === false)) issues.push({ Problem: "update_while_frozen", Experience: row.Experience });
        if (row.Kind === "unattributed") {
            if (row.Reason === "experience_buffer_limit") { increment(limitations, row.Reason); continue; }
            const group = JSON.stringify([row.Learner, row.Reason]);
            const value = unassigned.get(group) ?? { Learner: row.Learner, Reason: row.Reason, Records: 0, Incidents: new Set() };
            value.Records++; if (row.Incident) value.Incidents.add(row.Incident); unassigned.set(group, value);
        }
    }
    const applied = new Map(updates);
    for (const [key, row] of finals) if (row.Updated === true && !applied.has(key)) applied.set(key, row);
    const summary = {};
    for (const learner of learners) {
        const created = [...starts.values()].filter(row => row.Learner === learner), finished = [...finals.values()].filter(row => row.Learner === learner);
        const writes = [...applied.values()].filter(row => row.Learner === learner), outcomes = {}, noUpdate = {};
        const rawSnapshot = ({ tactical: end?.Open?.Tactical, motion: end?.Open?.Motion, place: end?.Open?.Place, boost: end?.Open?.Boost })[learner];
        // GLua JSON encoders can represent an empty table as an empty object.
        const snapshot = rawSnapshot && !Array.isArray(rawSnapshot) && Object.keys(rawSnapshot).length === 0 ? [] : rawSnapshot;
        if (snapshot !== undefined && (!Array.isArray(snapshot) || !snapshot.every(id => typeof id === "string"))) throw new Error("Invalid pending-ID snapshot.");
        const open = new Set(snapshot ?? []), createdIDs = new Set(created.map(row => row.Experience));
        for (const row of finished) {
            increment(outcomes, row.Outcome ?? "unrecorded");
            if (!applied.has(identity(row))) increment(noUpdate, noUpdateReason(row));
            if (row.Outcome === "superseded") {
                const controller = row.Controller ?? "unrecorded", reason = row.InterventionReason ?? row.Reason;
                const key = JSON.stringify([learner, controller, reason]);
                const group = superseded.get(key) ?? { Learner: learner, Controller: controller, Reason: reason, Experiences: 0 };
                group.Experiences++; superseded.set(key, group);
            }
        }
        summary[learner] = {
            Created: created.length, Finalized: finished.length, Outcomes: outcomes,
            FinalizedWithoutStartInWindow: finished.filter(row => !starts.has(identity(row))).length,
            UpdatedExperiences: writes.length, ChangedValues: writes.filter(row => Number.isFinite(row.Before) && Number.isFinite(row.After) && row.Before !== row.After).length,
            UpdatesByMode: { Active: writes.filter(row => row.Learning === true && row.Evaluation === false).length,
                Evaluation: writes.filter(row => row.Evaluation === true).length,
                Unknown: writes.filter(row => row.Learning === undefined || row.Evaluation === undefined).length },
            ConfirmedPendingAtEnd: snapshot ?? null,
            CreatedStillPendingAtEnd: snapshot ? [...open].filter(id => createdIDs.has(id)) : null,
            CreatedWithNoFinalRecordAndNotConfirmedPending: created.filter(row => !finals.has(identity(row)) && !open.has(row.Experience)).map(row => row.Experience),
            FinalizedWithoutUpdate: noUpdate,
            SupersededRateAmongFinalized: finished.length ? (outcomes.superseded ?? 0) / finished.length : null,
        };
    }
    const fallReceipts = new Map();
    for (const row of rows.filter(value => value.Kind === "consequence" && value.Consequence === "fall")) {
        if (typeof row.Incident !== "string" || !row.Incident) throw new Error("Detected fall without an incident receipt.");
        const key = JSON.stringify([row.Session, row.Bot, row.Incident]);
        if (fallReceipts.has(key)) issues.push({ Problem: "duplicate_fall_receipt", Incident: row.Incident });
        else fallReceipts.set(key, row);
    }
    const falls = [...fallReceipts.values()];
    const wrongModeRows = phase ? rows.filter(row => phase === "active" ? row.Learning !== true || row.Evaluation !== false :
        row.Evaluation !== true || row.Learning !== false) : [];
    const timings = falls.map(row => {
        const ending = [...finals.values()].find(value => value.Session === row.Session && value.Bot === row.Bot &&
            value.Learner === "motion" && value.Experience === row.Experience && value.Incident === row.Incident);
        return { Incident: row.Incident, Session: row.Session, Bot: row.Bot, Role: row.Role, Experience: row.Experience,
            Attributed: row.Attributed, Reason: row.Reason, CommandAt: row.CommandAt ?? null, DepartureAt: row.DepartureAt ?? null,
            FallDetectedAt: row.Time, FinalizedAt: ending?.Time ?? null,
            CommandToDepartureSeconds: delta(row.DepartureAt, row.CommandAt), DepartureToFallSeconds: delta(row.Time, row.DepartureAt),
            CommandToFallSeconds: delta(row.Time, row.CommandAt), FallToFinalizationSeconds: delta(ending?.Time, row.Time),
            Outcome: ending?.Outcome ?? null, Updated: ending?.Updated ?? null };
    });
    const evaluationEndings = [...finals.values()].filter(row => row.Evaluation === true && row.Learning === false &&
        ["success", "failure", "observed"].includes(row.Outcome) && row.Total !== 0 && Number.isFinite(row.Before) && row.Before === row.After && row.Updated === false);
    const evaluationCommands = rows.filter(row => row.Kind === "execution" && row.Evaluation === true && row.Commanded &&
        (Math.abs(row.Commanded.Forward) + Math.abs(row.Commanded.Side) + Math.abs(row.Commanded.Keys) > 0));
    const noFrozenWrites = [...applied.values()].every(row => row.Evaluation !== true && row.Learning !== false);
    return { Status: "captured_records_only", Coverage: { ...Coverage, RowsOutsideExpectedMode: phase ? wrongModeRows.length : null }, Learners: summary,
        ProfileLifecycle: "Profile updates reuse the tactical episode ID; there are no separate profile start/finalize records.",
        PassageLifecycle: "Passage updates record derived stage statistics without an independent start/finalize lifecycle. Before/After describe its failure fraction, not a tactical reward or scalar Q value.",
        Superseded: [...superseded.values()], UnattributedConsequences: [...unassigned.values()].map(value => ({ ...value, Incidents: value.Incidents.size })),
        OtherLimitations: limitations, DetectedFallEvents: falls.length, AttributedFallEvents: falls.filter(row => row.Attributed === true).length,
        ManualFalls: manualFallComparison(rows, falls, matches), FallTimings: timings,
        Departures: rows.filter(row => row.Kind === "departure"), IntegrityIssues: issues,
        Checks: { ActiveUpdatesObserved: [...applied.values()].some(row => row.Learning === true && row.Evaluation === false),
            EvaluationWindowObserved: phase === "evaluation" && Boolean(start?.Evaluation && end?.Evaluation),
            EvaluationExecutedCommands: evaluationCommands.length, EvaluationKnownUnchangedOutcomes: evaluationEndings.length,
            FrozenTestEvidencePresent: Coverage.CompleteMarkedWindow && phase === "evaluation" && wrongModeRows.length === 0 && Boolean(start?.Evaluation && end?.Evaluation) &&
                evaluationCommands.length > 0 && evaluationEndings.length > 0 && noFrozenWrites,
            NoEvaluationUpdatesInCapture: [...applied.values()].every(row => row.Evaluation !== true),
            Caveat: "A frozen phase is not demonstrated merely because there are zero updates. Require an evaluation window, executed inputs, known finalized outcomes and unchanged values. Active updates are evidence of writes, not proof of correct attribution or improvement." } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const [path, requestedPhase = "all", matchPath, rawBot = "1"] = process.argv.slice(2);
        const bot = Number(rawBot);
        if (!path || !Number.isInteger(bot) || bot < 1 || bot > 64) throw new Error("Usage: node scripts/analyze-bot-learning-session.mjs trace.json-or-console.txt [active|evaluation|all] [manual-matches.json|-] [bot-id]");
        const capture = parseLearningTrace(await readFile(path, "utf8"));
        const matches = matchPath && matchPath !== "-" ? JSON.parse(await readFile(matchPath, "utf8")) : [];
        console.log(JSON.stringify(analyzeLearningSession(capture, { phase: requestedPhase === "all" ? undefined : requestedPhase, bot, matches }), null, 2));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
