export function evaluationRequested(): boolean {
    const cohort = GetConVar("zp_bot_stats_cohort")?.GetString();
    return cvars.Bool("zp_bot_evaluation", false) || cohort === "heldout" || cohort === "retention";
}
export function learningAllowed(): boolean { return !evaluationRequested() && cvars.Bool("zp_bot_learning", true); }
