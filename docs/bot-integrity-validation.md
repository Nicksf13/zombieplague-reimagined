# Reproducible integrity evaluation in Garry's Mod

This procedure compares an untrained policy with a policy trained using the
corrected code. Local tests do not establish improved game performance. Run the
procedure before reporting completion, fall or timing improvements.

Before comparing policies, run the separate
[short attribution audit](bot-learning-session-audit.md). It explicitly exercises
both active learning and frozen evaluation with real outcomes, and measures
supersession/unattributed rates without classifying pending experiences as lost.
The [2026-10-18 active audit](bot-learning-session-2026-10-18.md) now records real
parameter updates. Its frozen phase and the controlled policy comparison remain
pending; active updates alone do not establish a performance improvement.

## Preserve production knowledge

Do not reset or restore checkpoints over the live server. Keep the verified
pre-change backup described in [learning integrity](bot-learning-integrity.md).
For experiments, use a separate server installation or separate test data root.
Stop that test server before making every checkpoint copy, and preserve hashes
of the copied files. The earlier live snapshot preserves data but is not a
transactional checkpoint suitable for strict replay.

Use the same corrected gamemode build, map BSP and NAV files, engine build,
addons, class definitions and authored boost definitions in every experiment.
The simplest zig-zag navigation experiment uses no boost definitions in either
policy. Do not give the baseline existing learned boost scores.

## Create checkpoints T0 and T1

1. Start an isolated test server with fresh bot learning data. Disable automatic
   population filling in the Bots menu and set `zp_bot_training 0`. Explicitly
   create the same bot identity/profile, for example `zp_addaibot 1 aggressive`.
2. Stop the server cleanly and copy its complete `data/zombieplague/bots/`
   directory to checkpoint **T0** before any training. T0 has programmed rules,
   not learned estimates. Existing production data must remain outside this copy.
3. Make a separate working copy of T0. Run corrected training with
   `zp_bot_evaluation 0`, `zp_bot_learning 1`, and cohort `trained`.
4. For navigation training, use a fixed class/role and a recorded crossing
   schedule in normal rounds. A stationary human at the destination can give a
   zombie a pursuit objective without shooting. Record the number/direction of
   crossings and any interruptions. This is training, not the evaluation sample.
5. Stop the training server cleanly after the declared training budget and copy
   its data as checkpoint **T1**. Do not silently continue training after seeing
   evaluation results. Keep T0 and T1 immutable for all comparison runs.

T0 and T1 evaluation copies must have the same identity, role, class, variant,
equipment, initial health/armor/ammunition/breath and movement rules. Preserve
all learned files, including movement and place data, when copying T1. Do not
use the contaminated production checkpoint as the "untrained" baseline.

## Fix the navigation challenge

Record a manifest with map/BSP/NAV hashes, code revision, identity/profile,
class/variant, player/bot counts, spawn and goal coordinates, starting view,
resources, gravity, run/jump/crouch speeds, hulls, stamina flags/rates, fall-damage
rules, tick rate, timeout and sample interval. Record every addon that can affect
movement. Use a goal in the center of the destination platform, away from edges.

For `zp_training_zig_zag`, the repository VMF contains opposite spawn candidates
near `(256,-556,128)` and `(1791.2,-555.996,128)`. Verify them once against the
installed BSP and navmesh; then freeze the confirmed coordinates in the manifest.
Do not assume old `info_target` positions match the current crossing. The authored
fall pit is `trigger_hurt` named `zp_fall_hurt`; verify that name in the actual
compiled map. Generic pit damage should produce a `fall` outcome.

Use one living managed bot, with all human observers spectating and no living
enemies, for the first evaluation. Check the identity in the existing diagnostics.
Use a fixed role, for example the default zombie, on both checkpoints. Set it
through the normal class/admin controls before starting the benchmark.

Apply identical settings to both test copies, for example:

```text
zp_bot_training 0
zp_bot_evaluation 1
zp_bot_stats_cohort trained
zp_bot_stats_scenario integrity_zigzag
zp_bot_stats_difficulty fixed_default_zombie
zp_bot_stats_sample 0.5
zp_bot_stats_timeout 60
zp_run_should_drain 0
zp_realistic_mode 0
zp_run_drain 1
zp_zombie_should_run 1
sv_gravity 600
```

Also fix `zp_falldamage` and the class's fall rule to the same values. The marker
pit detects generic applied pit damage even when ordinary fall damage is disabled.
Do not change these settings mid-attempt. Start fresh evaluation sessions after
checkpoint restoration. Cohort `trained` labels the challenge set, not the policy's
amount of training; use the same cohort for T0 and T1 comparisons.

`zp_bot_evaluation 1` freezes copied parameters and disables the tactical and
movement learners' random exploration. Ordinary random scheduling is not globally
seeded. The isolated benchmark bypasses wandering and place selection and has no
opponent, reducing unrelated randomness. It does not change Source physics.

## Execute the fixed schedule

1. Restore T0 into a stopped test copy and start the same map/settings. Place the
   single bot at the recorded start, with zero initial velocity and recorded view
   and resources, using the same admin fixture for every attempt. Perform fixture
   positioning before issuing the benchmark, never during an active attempt.
2. A server-console fixture may use the actual engine player's `SetPos`,
   `SetEyeAngles`, `SetVelocity(-GetVelocity())`, `SetHealth` and `SetBreath` in the
   isolated test only. Do not add teleportation or healing to the AI itself. Wait
   for the bot to be grounded and stationary; verify the starting state.
3. Run `zp_bot_benchmark 1 GOAL_X GOAL_Y GOAL_Z`, substituting the frozen numeric
   coordinates. The command clears old plans and uses the existing navigator.
   It rejects dead/frozen bots, enemies, missing identities and non-evaluation mode.
4. Let the attempt terminate as success, fall, timeout or path failure. Record
   interruptions and missing navigation separately. Reset the fixture only after
   termination. A death requires the normal respawn/class setup before repeating.
5. Use at least 30 predetermined attempts per direction for each checkpoint,
   divided across several fresh sessions. Apply the same direction/start schedule
   to both. Alternate checkpoint order across sessions to reduce order effects.
6. Restore T1 into a stopped test copy and repeat exactly the same schedule.
   Do not substitute training episodes or multiple samples from one attempt for
   independent evaluation attempts. Keep raw exports before the 2,000-record
   buffer can discard them.

Run a short traced attempt first, using `zp_bot_learning_trace_bot 1` and
`zp_bot_learning_trace 1`. Confirm the decision-to-command-to-update chain and
that evaluation records have `Updated=false`. Export its trace after termination.
Then disable tracing for the timing runs, identically on both policies.

## Export and compare

Use the history menu's export or `zp_bot_stats_export`, with identity/scenario/
role filters. Each export writes
`data/zombieplague/bots/statistics/export-v1.json`; copy it under a distinct name
before exporting another checkpoint. Keep T0 and T1 exports separate.

From the repository, run this read-only comparison:

```powershell
.\.tools\node-v24.21.0-win-x64\node.exe scripts/analyze-bot-integrity.mjs T0-export.json T1-export.json integrity_zigzag
```

The tool requires evaluation navigation rows and identical recorded conditions,
including corrected code, movement flags, bot count, tick interval, start and goal.
It rejects duplicate trial IDs and multiple policy fingerprints in one challenge.
It reports each direction/challenge separately:

- completion rate: successes / attempted crossings;
- detected falls per attempted crossing;
- median and P90 completion time among successes;
- stuck seconds per attempt and stuck fraction of active time;
- timeouts and path failures, with interruptions/missing NAV listed separately.

Path failures count as failed attempts. Zero successes produce undefined times,
not an artificial zero-second result. Check interruptions rather than ignoring a
checkpoint with many invalid trials. Do not rank policies by reward totals.

Actual falls without applied fall/pit damage require an external observer count;
compare that count with detection. Do not report detector silence as zero real
falls. Raw physics/hook behavior still needs in-engine validation.

Reserve a second route/direction configuration as `heldout` and an old route as
`retention`; both force frozen evaluation. Keep each challenge comparable between
T0 and T1 and never train on the reserved route after inspecting its results.
Report measurements and uncertainty across sessions. The comparison script is
descriptive and does not automatically claim statistical significance or an
in-game improvement.
