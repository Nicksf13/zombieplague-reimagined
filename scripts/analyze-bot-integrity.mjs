import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const conditions = ["Bot", "Code", "Rewards", "Map", "Scenario", "Difficulty", "Cohort", "Role", "ClassID", "Variant",
    "Equipment", "Resources", "Reference", "Speed", "Jump", "Health", "Physics", "Navigation", "Settings", "Opponents", "Start", "Goal"];
const outcomes = new Set(["success", "fall", "enemy", "environment", "unknown", "timeout", "path_failure", "interrupted", "missing_nav"]);
const finite = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
const quantile = (values, fraction) => values.length ? values[Math.ceil(values.length * fraction) - 1] : null;

/** Read-only analysis: path failures remain failed attempts, rather than disappearing from the denominator. */
export function integrityGroups(data, scenario) {
    if (data?.Version !== 1 || !Array.isArray(data.Rows)) throw new Error("Expected a version 1 bot statistics export with raw Rows.");
    const groups = new Map(), identities = new Set();
    for (const row of data.Rows) {
        if (row.Kind !== "navigation" || row.Mode !== "evaluation" || (scenario && row.Scenario !== scenario)) continue;
        if (typeof row.ID !== "string" || !row.ID || identities.has(row.ID)) throw new Error("Missing or duplicate navigation trial ID.");
        identities.add(row.ID);
        for (const key of conditions) if (row[key] === undefined) throw new Error(`Missing experimental condition: ${key}.`);
        if (!outcomes.has(row.End) || ![row.Seconds, row.Active, row.Stuck, row.Falls].every(finite) || !Number.isInteger(row.Falls) || row.Falls > 1)
            throw new Error("Invalid navigation outcome or counters.");
        if (typeof row.Policy !== "string" || !row.Policy || typeof row.Session !== "string" || !row.Session ||
            !Array.isArray(row.Start) || row.Start.length !== 3 || !Array.isArray(row.Goal) || row.Goal.length !== 3 ||
            ![...row.Start, ...row.Goal].every(value => typeof value === "number" && Number.isFinite(value))) throw new Error("Invalid policy, session or route coordinates.");
        const key = JSON.stringify(conditions.map(name => row[name]));
        const group = groups.get(key) ?? []; group.push(row); groups.set(key, group);
    }
    if (!groups.size) throw new Error("No frozen evaluation navigation trials match the requested scenario.");
    return groups;
}

export function summarizeIntegrity(rows) {
    const policies = new Set(rows.map(row => row.Policy));
    if (policies.size !== 1) throw new Error("More than one frozen policy in a challenge; export each checkpoint separately.");
    const attempts = rows.filter(row => row.End !== "interrupted" && row.End !== "missing_nav");
    const successes = attempts.filter(row => row.End === "success"), times = successes.map(row => row.Seconds).sort((a, b) => a - b);
    const falls = attempts.reduce((sum, row) => sum + Math.max(row.Falls, row.End === "fall" ? 1 : 0), 0);
    const active = attempts.reduce((sum, row) => sum + row.Active, 0), stuck = attempts.reduce((sum, row) => sum + row.Stuck, 0);
    return {
        Policy: [...policies][0], Sessions: new Set(rows.map(row => row.Session)).size, Attempts: attempts.length, Completed: successes.length,
        CompletionRate: attempts.length ? successes.length / attempts.length : null,
        Falls: falls, FallsPerAttempt: attempts.length ? falls / attempts.length : null,
        MedianCompletionSeconds: quantile(times, 0.5), P90CompletionSeconds: quantile(times, 0.9),
        StuckSeconds: stuck, StuckSecondsPerAttempt: attempts.length ? stuck / attempts.length : null, StuckFraction: active ? stuck / active : null,
        Timeouts: attempts.filter(row => row.End === "timeout").length, PathFailures: attempts.filter(row => row.End === "path_failure").length,
        Interrupted: rows.filter(row => row.End === "interrupted").length, MissingNavigation: rows.filter(row => row.End === "missing_nav").length,
    };
}

export function compareIntegrity(baseline, trained, scenario) {
    const left = integrityGroups(baseline, scenario), right = integrityGroups(trained, scenario);
    if (left.size !== right.size || [...left.keys()].some(key => !right.has(key)))
        throw new Error("Experimental conditions differ: use the same map, route, identity, role, resources, movement settings and corrected code.");
    return {
        Interpretation: "Descriptive measurements only; no in-game improvement is inferred from rewards or local tests.",
        Challenges: [...left].map(([key, rows]) => ({ Conditions: Object.fromEntries(conditions.map((name, index) => [name, JSON.parse(key)[index]])),
            Baseline: summarizeIntegrity(rows), Trained: summarizeIntegrity(right.get(key)) })),
    };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    try {
        const [baseline, trained, scenario] = process.argv.slice(2);
        if (!baseline || !trained) throw new Error("Usage: node scripts/analyze-bot-integrity.mjs baseline-export.json trained-export.json [scenario]");
        const [left, right] = await Promise.all([readFile(baseline, "utf8"), readFile(trained, "utf8")]);
        console.log(JSON.stringify(compareIntegrity(JSON.parse(left), JSON.parse(right), scenario), null, 2));
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
}
