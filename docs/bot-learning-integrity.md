# Learning attribution integrity

This change corrects experience ownership and finalization. It does not replace
pathfinding, steering, precision, traffic negotiation or cooperative boosts.
See [the engine validation procedure](bot-integrity-validation.md) before claiming
that a policy improves navigation in Garry's Mod.

## Ownership and outcomes

`sv_bot_motion_experiences.ts` owns bounded, individually identified movement
experiences. An action interval ending is not proof of crossing success. Positive
progress stays in escrow until the stage is completed. Replacing an unfinished
stage discards its unresolved positive balance without inventing a failure.
Known negative observations remain distinct from unknown interruptions.

Finalization uses these outcomes:

| Outcome | Meaning |
| --- | --- |
| `success` | A checkpoint/goal or a grounded exit from water was observed. |
| `failure` | Attributed fall, observed stall failure, or confirmed damage to an executed pursuit jump. |
| `interrupted` | No sufficiently known terminal result; no automatic negative update. |
| `superseded` | Another controller prevented evaluating the selected action. |
| `observed` | A local interval with a known intermediate result; positive crossing progress remains pending. |

An experience updates at most once. Damage callbacks use bounded receipts keyed
by the engine damage object and recipient/channel. The death handler processes
the lethal event before closing experiences; the subsequent post-damage hook
cannot apply it again. The same receipt also prevents duplicate damage and kill
observations across repeated hooks.

## Fall attribution

`sv_bot_motion_causality.ts` requires a commanded ground movement followed by an
observed departure within 0.35 seconds and a plausible positional displacement.
The departure owns the fall, even if the action interval expires or the stage is
replaced while the bot is airborne. A new airborne choice does not become the
owner merely because it is current when damage arrives.

Observation must remain fresh within 0.35 seconds. The airborne ownership window
is bounded to 12 seconds; landing has a 0.2-second settlement window. Recent
ground commands retain their receipts for 0.35 seconds. Known successful stage
rewards wait while a possible owner from that stage is unsettled.

External horizontal speed above 150% of class run speed, observation gaps,
teleport-sized displacement, foreign movement controllers, physics changes and
role/lifecycle boundaries invalidate causality. Hostile player damage also fences
fall attribution because its displacement cannot safely be inferred from damage
alone. Confirmed jump exposure is retained separately.

These are conservative observations, not a complete causal physics model.
Unobserved pushes, map scripts and unusual physics still need engine tests. If
the evidence is insufficient, damage is counted, the limitation is recorded,
unresolved progress is discarded, and no recent action receives guessed blame.
Drowning is recorded without guessing a movement owner.

`DMG_FALL` and the explicitly authored `trigger_hurt` named `zp_fall_hurt` are fall
events. The latter exists in `maps/zp_training_zig_zag.vmf` and uses generic damage.
Arbitrary acid/crush/hurt volumes are not automatically treated as falls. Falls
without applied damage or the explicit marker are not detected by this mechanism.

An attributed failed crossing has a reward of at most -1 before the existing
[-2, 2] clamp, regardless of partial progress or provisional arrival bonuses.
Other unresolved positive experiences from that failed stage are discarded.
The original passage receives the failure only when eligible; temporary
player/prop occupancy still prevents permanent passage-cost learning.

## Selected decisions and actual commands

`BotBrain` retains the selected tactical action and its experience ID.
`motor.request` describes its requested destination/behavior and range-related
interventions. `motor.destination` remains as a compatibility wrapper.
`motor.apply` reports the actual issued forward/side input, world direction,
buttons and view yaw. These are commands, not a claim about physical displacement.
Runtime tactical episodes also require an issued command for their exact decision
ID before accepting reward. Consequences arriving before execution, or with no
active episode, are logged as unattributed rather than assigned to a new choice.
Standalone learner tests may supply direct domain outcomes without that adapter.

`BotExecutionTracker` links the tactical ID, movement ID and stage. Requests keep
the semantic destination behavior, local candidate and waypoint separately.
Interventions record their controller, reason and duration when they end or the
bot is cleared. Command records are coalesced to at most five per second.

| Learner | Intervention contract |
| --- | --- |
| Tactical action | A foreign controller that prevents evaluation invalidates the episode's action update; its original label is preserved. |
| Tactical profile | The same episode cannot update the profile either. Randomly forced actions retain their existing profile-credit guard. |
| Local movement | Compatible traversal remains the implementation of the chosen movement. Actual braking, unsafe-support refusal, unavailable sprint, expired jump input, traffic, boost input or command gating supersedes the local attempt neutrally. |
| Passage cost | Requires a known stage result; unassigned falls and externally substituted movements do not invent a passage failure. |
| Place selection | Foreign movement ends unresolved visits neutrally. Already observed find/escape outcomes remain valid. Ordinary visits still learn their own place outcomes. |
| Cooperative boost | Own executed boost attempts keep their existing outcome contract. Command gating cancels the pair neutrally; traffic still refuses busy pairs. |

Scope changes and death clear active causal references. Confirmed consequences
are finalized in their original scope before selecting another role's knowledge.
An old command's decision ID cannot invalidate a newer tactical episode.

## Diagnostics

Server console / superadmin setup:

```text
zp_bot_learning_trace_bot 1
zp_bot_learning_trace 1
```

The default is off. Records are technical JSON prefixed with `[ZP learning]`.
Each includes session, bot, role, scope and time. Experience records include ID,
state, action, stage, reward components/total, outcome/reason, before/after value
and whether an update occurred. Execution records link decision and movement
IDs. Unattributed outcomes explicitly record their limitation and `Updated=false`.

Use `zp_bot_learning_trace_export` after an attempt to save the last 512 records
to `data/zombieplague/bots/diagnostics/learning-trace-v1.json`. `Dropped` reports
ring-buffer truncation. Keep the server console log for longer captures. Filter
one bot when investigating a complete decision-to-update chain. There are no
routine debug file writes, and the ordinary menu/network protocol is unchanged.
Disable tracing after the investigation with `zp_bot_learning_trace 0`.

For a complete short capture, see the
[session audit](bot-learning-session-audit.md). Diagnostic extensions add effective
learning/evaluation mode, record sequences, environmental incident receipts,
ground-command/departure times, specific movement-intervention causes, and
read-only manual/boundary markers with pending-ID snapshots. The existing
512-record ring remains bounded; use a full console capture for longer windows.
These fields do not change reward or causality acceptance rules.

The [2026-10-18 real active capture](bot-learning-session-2026-10-18.md) now
documents actual updates, pending balances and a detected fall without local
ownership. Its frozen engine phase and any measured navigation improvement
remain pending.

## Existing knowledge and validation boundary

The saved knowledge schema and file locations remain compatible. There is no
automatic migration, reset, retrospective relabeling or claim that old estimates
are clean. Old action/profile values and passage costs may contain the previous
attribution errors. Old statistics remain available and use their old reward
fingerprint; new attempts use `integrity-v2` and include drain/realism flags, bot
count and tick interval in their recorded settings.

Before implementation, all 802 files under the installed bot data directory were
copied and SHA-256 verified into
`.tools/learning-integrity-backups/20261018-005316-819/`. The manifest records the
source and hashes. This is a verified per-file live snapshot, not a claim of a
transactionally consistent stopped-server checkpoint. Live knowledge was not
rewritten or reset. Create stopped-server experiment checkpoints as described in
the validation procedure.

Regression tests exercise causal late falls, stage interruption, partial reward
composition, supersession, lifecycle boundaries, duplicate hooks, the authored
fall pit, evaluation freezing and diagnostic bounds. They simulate GMod. Actual
engine hook identity/timing, physics, map compilation and measured improvement
remain engine validation tasks.

## Local validation record (2026-10-18)

`npm test` passed all server/client/test TypeScript checks, rebuilt 369 Lua files,
and passed all 540 tests. The focused integrity/runtime regression run passed
56 tests before the complete suite. `git diff --check` reported no whitespace
errors. These results cover the simulated behavior described above, including
the requirement for an issued tactical command before assigning its reward.

Relevant regression files are `tests/bot-learning-integrity.test.mjs`,
`tests/bot-execution-integrity.test.mjs` and
`tests/bot-integrity-analysis.test.mjs`; existing motion, retreat, lifecycle and
place tests also run in the complete suite. There is no measured Garry's Mod
comparison yet. Follow the separate engine procedure to validate real callback
timing, causal observations and navigation outcomes.
