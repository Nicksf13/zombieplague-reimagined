import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLearningSession, parseLearningTrace } from "../scripts/analyze-bot-learning-session.mjs";

const row = (Kind, Experience, fields = {}) => ({ Kind, Experience, Learner: "motion", Reason: "fixture", Session: "session",
    Bot: 1, Role: "zombie", Scope: "zigzag:zombie", Learning: true, Evaluation: false, Time: 1, ...fields });
const marker = (label, fields = {}) => row("marker", label, { Reason: label, Open: { Motion: [], Tactical: [] }, ...fields });
const capture = Rows => ({ Version: 1, Dropped: 0, Rows: Rows.map((value, index) => ({ ...value, Sequence: index + 1 })) });

test("session audit counts unique updates, supersession causes and live pending experiences separately", () => {
    const data = capture([marker("active_start"), row("start", "a"), row("start", "b"), row("start", "c"),
        row("finalize", "a", { Outcome: "success", Updated: true, Before: 0, After: 0.2, Total: 1 }),
        row("update", "a", { Updated: true, Before: 0, After: 0.2 }),
        row("finalize", "b", { Outcome: "superseded", Controller: "traffic", InterventionReason: "negotiated_passage", Updated: false }),
        row("update", "tactical-1", { Learner: "profile", Updated: true, Before: 0, After: 0.1 }),
        row("update", "passage-1", { Learner: "passage", Updated: true, Before: 0, After: 0.5 }),
        marker("active_end", { Open: { Motion: ["c"], Tactical: ["older-decision"] } })]);
    const report = analyzeLearningSession(data, { phase: "active", bot: 1 });
    assert.equal(report.Coverage.CompleteMarkedWindow, true);
    assert.equal(report.Learners.motion.Created, 3);
    assert.equal(report.Learners.motion.Finalized, 2);
    assert.deepEqual(report.Learners.motion.Outcomes, { success: 1, superseded: 1 });
    assert.equal(report.Learners.motion.UpdatedExperiences, 1, "finalize and update describe the same write");
    assert.deepEqual(report.Learners.motion.CreatedStillPendingAtEnd, ["c"]);
    assert.deepEqual(report.Learners.motion.CreatedWithNoFinalRecordAndNotConfirmedPending, []);
    assert.equal(report.Learners.profile.UpdatedExperiences, 1);
    assert.equal(report.Learners.profile.Created, 0, "profile has no independent episode lifecycle");
    assert.equal(report.Learners.passage.UpdatedExperiences, 1);
    assert.deepEqual(report.Superseded, [{ Learner: "motion", Controller: "traffic", Reason: "negotiated_passage", Experiences: 1 }]);
    assert.deepEqual(report.Learners.motion.FinalizedWithoutUpdate, { expected_controller_substitution: 1 });
});

test("explicit observer matches distinguish manual falls from detected receipts and attributed learning", () => {
    const data = capture([marker("active_start"), row("start", "owner", { Time: 1 }),
        row("departure", "owner", { Time: 1.4, CommandAt: 1.2, DepartureAt: 1.4 }),
        row("consequence", "owner", { Time: 2, Incident: "fall-1", Consequence: "fall", Attributed: true, CommandAt: 1.2, DepartureAt: 1.4 }),
        row("finalize", "owner", { Time: 2, Incident: "fall-1", Outcome: "failure", Total: -1, Updated: true, Before: 0, After: -0.2 }),
        marker("manual_fall", { Experience: "manual-1", Time: 2.1 }), marker("manual_fall", { Experience: "manual-2", Time: 3 }),
        marker("manual_fall", { Experience: "unreviewed", Time: 4 }), marker("active_end", { Time: 5 })]);
    const matches = [{ Manual: "manual-1", Incidents: ["fall-1"] }, { Manual: "manual-2", Incidents: [] }];
    const report = analyzeLearningSession(data, { phase: "active", bot: 1, matches });
    assert.equal(report.ManualFalls.ObservedMarkers, 3);
    assert.equal(report.ManualFalls.Reviewed, 2);
    assert.equal(report.ManualFalls.DetectedAmongReviewed, 1);
    assert.equal(report.ManualFalls.AttributedAmongReviewed, 1);
    assert.equal(report.ManualFalls.NotDetectedAmongReviewed, 1);
    assert.equal(report.ManualFalls.Unreviewed, 1);
    const timing = report.FallTimings[0];
    assert.ok(Math.abs(timing.CommandToDepartureSeconds - 0.2) < 1e-9);
    assert.ok(Math.abs(timing.DepartureToFallSeconds - 0.6) < 1e-9);
    assert.equal(timing.FallToFinalizationSeconds, 0);
    assert.equal(timing.Experience, "owner");
    assert.throws(() => analyzeLearningSession(data, { phase: "active", bot: 1, matches: [...matches,
        { Manual: "unreviewed", Incidents: ["fall-1"] }] }), /multiply assigned/);
});

test("unassigned consequences keep their reasons and absent timings remain unknown", () => {
    const data = capture([marker("active_start"), row("consequence", "", { Consequence: "fall", Incident: "fall-2", Attributed: false }),
        row("unattributed", "", { Reason: "stale_flight_before_damage", Incident: "fall-2", Updated: false }),
        row("unattributed", "old", { Reason: "experience_buffer_limit", Updated: false }), marker("active_end")]);
    const report = analyzeLearningSession(data, { phase: "active", bot: 1 });
    assert.deepEqual(report.UnattributedConsequences, [{ Learner: "motion", Reason: "stale_flight_before_damage", Records: 1, Incidents: 1 }]);
    assert.deepEqual(report.OtherLimitations, { experience_buffer_limit: 1 });
    assert.equal(report.FallTimings[0].CommandAt, null);
    assert.equal(report.FallTimings[0].FinalizedAt, null);
    assert.equal(report.ManualFalls.ObservedMarkers, 0, "zero annotations is explicitly not proof of zero real falls");
});

test("frozen verification requires actual commands and known unchanged outcomes, rather than an empty trace", () => {
    const frozen = value => ({ ...value, Learning: false, Evaluation: true });
    const data = capture([marker("evaluation_start"), row("start", "a"), row("execution", "a", { Commanded: { Forward: 100, Side: 0, Keys: 8 } }),
        row("finalize", "a", { Outcome: "failure", Total: -1, Updated: false, Before: -0.2, After: -0.2 }), marker("evaluation_end")].map(frozen));
    const result = analyzeLearningSession(data, { phase: "evaluation", bot: 1 });
    assert.equal(result.Checks.FrozenTestEvidencePresent, true);
    assert.deepEqual(result.Learners.motion.FinalizedWithoutUpdate, { expected_frozen_evaluation: 1 });
    assert.equal(analyzeLearningSession(capture([marker("evaluation_start"), marker("evaluation_end")].map(frozen)),
        { phase: "evaluation", bot: 1 }).Checks.FrozenTestEvidencePresent, false);
    data.Rows.splice(4, 0, frozen(row("update", "a", { Updated: true, Before: -0.2, After: -0.3 })));
    assert.equal(analyzeLearningSession(data, { phase: "evaluation", bot: 1 }).Checks.FrozenTestEvidencePresent, false);
    assert.ok(analyzeLearningSession(data, { phase: "evaluation", bot: 1 }).IntegrityIssues.some(value => value.Problem === "update_while_frozen"));
});

test("console parsing preserves complete records and missing boundaries or sequence gaps prevent completeness claims", () => {
    const data = capture([marker("active_start"), row("start", "open"), marker("active_end", { Open: { Motion: ["open"], Tactical: [] } })]);
    const text = "other console text\n" + data.Rows.map(row => "[ZP learning] " + JSON.stringify(row)).join("\n");
    assert.equal(parseLearningTrace(text).Rows.length, 3);
    assert.equal(parseLearningTrace(JSON.stringify(data)).Rows.length, 3);
    assert.throws(() => parseLearningTrace("[ZP learning] {bad"), /Malformed/);
    assert.throws(() => analyzeLearningSession({ ...data, Rows: data.Rows.slice(1) }, { phase: "active", bot: 1 }), /Missing start/);
    const missing = structuredClone(data); missing.Rows[2].Sequence = 4;
    assert.equal(analyzeLearningSession(missing, { phase: "active", bot: 1 }).Coverage.CompleteMarkedWindow, false);
    const unknown = analyzeLearningSession(capture([row("start", "incomplete")]));
    assert.equal(unknown.Learners.motion.ConfirmedPendingAtEnd, null);
    assert.deepEqual(unknown.Learners.motion.CreatedWithNoFinalRecordAndNotConfirmedPending, ["incomplete"]);
});

test("unchanged values can still be legitimate updates and duplicated export records do not inflate counts", () => {
    const data = capture([marker("active_start"), row("start", "a"), row("finalize", "a", {
        Outcome: "failure", Total: -1, Before: -1, After: -1, Updated: true }), row("update", "a", { Before: -1, After: -1, Updated: true }), marker("active_end")]);
    data.Rows.splice(3, 0, structuredClone(data.Rows[2]));
    const report = analyzeLearningSession(data, { phase: "active", bot: 1 });
    assert.equal(report.Coverage.DuplicateRecordsRemoved, 1);
    assert.equal(report.Learners.motion.UpdatedExperiences, 1);
    assert.equal(report.Learners.motion.ChangedValues, 0);
    assert.deepEqual(report.Learners.motion.FinalizedWithoutUpdate, {});
});

test("an empty GLua table in a pending snapshot is accepted without inventing an open experience", () => {
    const data = capture([marker("active_start"), marker("active_end", { Open: { Motion: {}, Tactical: {}, Place: {}, Boost: {} } })]);
    const report = analyzeLearningSession(data, { phase: "active", bot: 1 });
    for (const learner of ["motion", "tactical", "place", "boost"]) assert.deepEqual(report.Learners[learner].ConfirmedPendingAtEnd, []);
});

test("observer-confirmed duplicate presses count one physical fall and preserve both raw annotations", () => {
    const data = capture([marker("active_start"), marker("manual_fall", { Experience: "early", Time: 2 }),
        row("consequence", "", { Time: 3, Consequence: "fall", Incident: "pit", Attributed: false }),
        marker("manual_fall", { Experience: "late", Time: 4 }), marker("active_end", { Time: 5 })]);
    const matches = [{ Manual: "early", DuplicateOf: "late" }, { Manual: "late", Incidents: ["pit"] }];
    const report = analyzeLearningSession(data, { phase: "active", bot: 1, matches });
    assert.equal(report.ManualFalls.ObservedMarkers, 2);
    assert.equal(report.ManualFalls.DuplicateMarkers, 1);
    assert.equal(report.ManualFalls.DistinctObservedFalls, 1);
    assert.equal(report.ManualFalls.Reviewed, 1);
    assert.equal(report.ManualFalls.Unreviewed, 0);
    assert.equal(report.ManualFalls.DetectedAmongReviewed, 1);
    assert.equal(report.ManualFalls.AttributedAmongReviewed, 0);
    assert.equal(report.ManualFalls.Cases[0].DuplicateOf, "late");
    assert.equal(data.Rows.length, 5, "analysis cannot rewrite the source capture");
    assert.throws(() => analyzeLearningSession(data, { phase: "active", bot: 1, matches: [{ Manual: "early", DuplicateOf: "early" }] }), /duplicate marker/);
});
