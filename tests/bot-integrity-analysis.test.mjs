import test from "node:test";
import assert from "node:assert/strict";
import { compareIntegrity, integrityGroups } from "../scripts/analyze-bot-integrity.mjs";

function row(id, end, policy = "empty") {
    return { ID: id, Kind: "navigation", Mode: "evaluation", Policy: policy, Session: "one", Bot: 1, Code: "corrected", Rewards: "integrity-v2",
        Map: "zigzag", Scenario: "crossing", Difficulty: "standard", Cohort: "trained", Role: "zombie", ClassID: "default", Variant: "normal",
        Equipment: "fists", Resources: "full", Reference: "none", Speed: 300, Jump: 200, Health: 1000, Physics: "fixed", Navigation: "same-nav",
        Settings: "same-bots-drain-realism-and-tick", Opponents: "", Start: [0, 0, 0], Goal: [100, 0, 0],
        End: end, Seconds: 10, Active: 10, Stuck: 2, Falls: end === "fall" ? 1 : 0 };
}
const exported = Rows => ({ Version: 1, Rows });

test("integrity comparison counts failed paths, separates interruptions, and reports success-only time without claiming improvement", () => {
    const baseline = exported([row("a", "success"), row("b", "fall"), row("c", "path_failure"), row("d", "interrupted")]);
    const trained = exported([row("e", "success", "trained"), row("f", "success", "trained")]);
    const result = compareIntegrity(baseline, trained, "crossing"), group = result.Challenges[0];
    assert.equal(group.Baseline.Attempts, 3);
    assert.equal(group.Baseline.CompletionRate, 1 / 3);
    assert.equal(group.Baseline.FallsPerAttempt, 1 / 3);
    assert.equal(group.Baseline.PathFailures, 1);
    assert.equal(group.Baseline.Interrupted, 1);
    assert.equal(group.Baseline.MedianCompletionSeconds, 10);
    assert.equal(group.Trained.CompletionRate, 1);
    assert.equal(group.Trained.StuckSecondsPerAttempt, 2);
    assert.match(result.Interpretation, /no in-game improvement is inferred/);
});

test("nonmatching physical conditions, duplicates and mixed frozen policies reject misleading comparisons", () => {
    const initial = exported([row("a", "success")]), changed = row("b", "success", "trained");
    changed.Settings = "realism-enabled";
    assert.throws(() => compareIntegrity(initial, exported([changed])), /conditions differ/);
    assert.throws(() => integrityGroups(exported([row("a", "success"), row("a", "fall")])), /duplicate/);
    assert.throws(() => compareIntegrity(initial, exported([row("b", "success"), row("c", "success", "trained")])), /one frozen policy/);
});

test("training records cannot masquerade as evaluation and zero completions do not produce zero-second times", () => {
    const training = row("a", "success"); training.Mode = "training";
    assert.throws(() => integrityGroups(exported([training])), /No frozen/);
    const result = compareIntegrity(exported([row("a", "fall")]), exported([row("b", "timeout", "trained")]));
    assert.equal(result.Challenges[0].Baseline.MedianCompletionSeconds, null);
    assert.equal(result.Challenges[0].Trained.P90CompletionSeconds, null);
});
