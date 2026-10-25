# Evaluating bot decisions in Garry's Mod

See [decision contracts and diagnosis](bot-objectives.md) for the implemented
behavior and the confirmed defects.

## Engine training and evaluation procedure

Use an isolated multiplayer test installation with sufficient slots, a valid BSP
and NAV, and the built local gamemode. Disable the conflicting Workshop gamemode
as described in [the development guide](typescript-migration.md). No GMod match
was executed for this change.

1. Stop the test server and preserve a hash-verified complete copy of
   `data/zombieplague/bots/`, including shared tactics, movement/place memories
   and boost definitions/results. Keep production data outside the experiment.
2. Create immutable **T0** and a working training copy. For an untrained baseline,
   create fresh data only in that isolated copy. Existing versioned checkpoint
   data is also usable if both branches start from exactly that checkpoint.
3. Run a predeclared training budget on the working copy:

   ```text
   zp_bot_stats_cohort trained
   zp_bot_evaluation 0
   zp_bot_learning 1
   zp_bot_training_count 4
   zp_bot_training 1
   ```

   Training enables AI/learning and maintains the requested bot count. Normal
   infection rounds still determine roles. It does not isolate a fixed opponent;
   self-play training alone is not evidence of improvement.
4. Stop the server cleanly at the declared budget and preserve **T1**, including
   all learning files. Do not train further after inspecting heldout results.
5. Evaluate separate working copies of T0 and T1. Disable automatic population
   filling in the existing menu. Apply identical classes, variants, identities,
   resources, boost definitions, spawns/view, tick rate, addons and fixed opponent
   behavior. Use the same human reference actor/loadout and declared input sequence,
   or the same immutable reference bot checkpoint in both copies. Merely setting
   an opponent label does not install or freeze that opponent separately.

   ```text
   zp_bot_training 0
   zp_bot_stats_cohort trained
   zp_bot_stats_scenario pursuit_under_fire
   zp_bot_stats_difficulty fixed_default
   zp_bot_stats_opponent reference_R0
   zp_bot_evaluation 1
   zp_bot_ai_enabled 1
   ```

   `zp_bot_evaluation 1` freezes all copied learners and exploratory choices,
   including reference bots. `zp_bot_learning 0` alone does not establish the
   explicit evaluation mode. If needed, `zp_addaibot 1 aggressive` creates a
   managed bot; choose role/class using existing admin controls before the trial.
6. Run a short diagnostic capture with `zp_bot_learning_trace_bot 1` and
   `zp_bot_learning_trace 1`. Confirm requested movement, commands, observed
   outcomes and `Updated=false` in evaluation. Disable tracing identically on
   both policies for timing runs. Use at least 30 predetermined attempts per
   scenario/direction across fresh sessions and alternate checkpoint order.
7. Export `zp_bot_stats_export`, `zp_bot_activity_export`, and (when enabled)
   `zp_bot_learning_trace_export`. Preserve each file under a distinct checkpoint,
   session and scenario name before another export overwrites it. Respect raw
   statistics retention and the 512-row trace limit.

For isolated navigation with one living bot and no enemies, use frozen mode and
`zp_bot_benchmark 1 GOAL_X GOAL_Y GOAL_Z`. It rejects living enemies and is not a
combat fixture. [The existing integrity procedure](bot-integrity-validation.md)
documents initial-state fixtures and the read-only `scripts/analyze-bot-integrity.mjs`
comparison. The analyzer requires identical code and conditions; do not use it
to present a code revision comparison as learned-policy improvement.

## Required scenario matrix and interpretation

| Scenario ID | Controlled observation |
| --- | --- |
| `pursuit_under_fire` | Zombie commands continue under a fixed shooter's fire; distinguish knockback, lost visual contact and command gating. |
| `numerical_disadvantage` | Two/three visible reference humans; compare bounded repositioning, renewed approach and melee contact. |
| `human_shelter` | Fixed chase toward a validated hiding point; count starts, arrivals, sustained protection and infections. |
| `visual_loss` | A fixed corner/door breaks sight; the human continues fleeing and the zombie visits the static snapshot. |
| `sound_investigation` | Hidden native gunfire/steps, silent control and occluded/out-of-range controls; require an actual visual encounter for a find. |
| `jump_obstacle` | Clear ground, low obstacle, nav jump and impossible obstacle; compare requested/issued launches and grounded progress. |
| `boost_access` | Existing authored point for both roles, including escape; test absent support, cancellation, wrong landing, timeout and resumed intent. |

`activity-v1.json` in `data/zombieplague/bots/diagnostics/` is bounded descriptive
telemetry by session, bot, role/class/variant, scenario, reference label and
evaluation mode. It includes under-fire seconds by state (command without
progress, intentional wait, no command, gated, airborne, forced/damage-uncertain,
foreign override), jump requests/issuances and observed landing outcomes, place
starts/arrivals/confirmed escapes, investigation starts/empty/expired/unreachable
checks/real encounters, boost starts/completions/failures/interruption, observed
survival seconds, infections and time to the first eligible issued attack per encounter.
It does not prove that a launch caused the observed movement. Gaps over 0.75
seconds are reported as unobserved, not counted as safe survival or a stuck policy.
Foreign intervention duration and its exact decision owner remain in the trace.

Activity exports aggregate within a session and do not contain a complete
experimental manifest or per-attempt timing distribution. Pair them with the
ordinary statistics export and the frozen condition manifest; export before
changing checkpoint/settings. They cannot independently establish equivalence.
`Dropped` and interrupted/unobserved counts must accompany every comparison.

Report stuck-under-fire seconds per observed under-fire second, launches per
minute and per obstacle attempt, arrival/escape/find/boost completion rates per
started attempt, infections per zombie active minute, human survival, and median/P90
time to attack range or traversal completion from raw attempts/trace. Keep failures,
missing navigation and administrative interruptions visible. More aborted attempts
must not improve the result by shrinking the denominator.

Separate three claims: **defect correction** (regressions plus controlled engine
captures under neutral equivalent starting estimates), **training benefit** (T0
versus T1 under the same corrected code and immutable reference), and **transfer**
(the same frozen checkpoints on predeclared untrained maps/routes, with cohort
`heldout` or `retention`). Those reserved cohorts force evaluation. A changed
code/reward fingerprint, drifting opponent, missing manifest, too few completed
attempts, truncated trace or overlapping uncertainty makes the result inconclusive.
Reward totals or K/D between two evolving opponents do not establish improvement.
