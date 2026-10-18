# Bot progress statistics

Statistics observe the existing AI; they do not create learning or change its
training rewards. Open **F4 > Administration > Bots > AI progress history**, or run
`zp_bot_statistics` as an admin. **Bots > Add AI bots** still provides live
decision and movement diagnostics. No external service is required.

## Individual progress graph

Select a saved bot identity, its human or zombie team, and a statistic. The first
available identity is selected automatically. Bot choices include active bots,
recent records and identities in the durable archive, including disconnected bots.
Identity numbers refer to the existing saved AI slots, rather than temporary
entity indices. Replacing a bot in the same slot continues that identity's history.

Changing the bot or team requests fresh data; rapid selections are coalesced into
the latest request. Changing the statistic redraws the current filtered report.
The additional version, scenario, difficulty and date-prefix fields apply when
**Refresh** is pressed. **Back** returns to the Bots submenu.

Available statistics are navigation success, median and P90 arrival times, stuck
time as a percentage of active navigation time, kills, deaths, dealt/taken damage
per active minute, round win percentage and average combat-record reward. Kills
and deaths are totals within each minute bucket. Arrival times include successes
only; undefined denominators produce gaps, rather than fabricated zeroes. Combat
metrics use combat records to avoid counting navigation observations twice.

The graph refreshes every two seconds while open and plots minute buckets,
without adding daily, session or raw summaries. Its horizontal axis accounts for the UTC offset in each stored
label. Each archived context has its own line, keeping training, evaluation,
roles, classes, maps, conditions and code versions separate. The legend identifies
each line and its latest value/sample count. Missing minutes are not connected.
Single observations remain visible as points. These descriptive trends do not
constitute evidence of learned improvement on their own.

The existing bounded report and network limits still apply. Hidden groups are
reported below the graph; narrow the filters or use the server JSON export for a
larger history. Existing raw and hourly archive formats remain available. Inputs,
dropdown popups and graphs follow the active theme palette.

`statistics/minutes-v1.json` stores up to 2,000 trial/minute segments using the
same verified 8 MiB storage boundary as raw history. A live segment is replaced
in place as counters advance; polling never adds observations. At a minute
boundary, subsequent counters belong to a new segment. Damage/minute uses that
segment's active seconds, and reward is averaged per combat segment. Navigation
success and arrival duration are credited only to the completion minute. Round
results are credited once to the final combat segment. These descriptive windows
do not drive policy-comparison inference. Collection performs no per-sample file
writes, and saves preserve verified backups. Existing hourly archives are retained
and serve as a fallback for bots without minute data; old hours cannot be expanded
into accurate minute history. Automatic polling preserves filters and native
controls, ignores stale replies, and stops on closing or permission loss.

## What the AI actually learns

These are native player NextBots controlled through `StartCommand`. The gamemode
implements perception, bounded A* routing, steering, recovery, aiming and button
inputs. NextBot does not automatically solve these routes. The engine executes
player movement, collision, physics and weapon behavior.

| Learner | Mutable knowledge | Ownership and persistence |
| --- | --- | --- |
| Tactics | Context/action values and contextual profile preferences; 20% updates toward bounded outcomes | Individual identity, role, stable class and variant; shared across maps in `bots/learning-v3.json` |
| Movement | Action values and passage attempt/success/failure/time estimates used as route costs | Individual identity, map, role/class/variant and navmesh revision in `bots/movement/` |
| Shelters | Shelter/hunt outcome values | Individual map/physics context, stored inside movement memory |
| Cooperative boosts | Pair/physics-specific outcome values and authored boost points | Shared map store in `bots/boosts/`; not individual tactical learning |

All paths above are relative to `data/zombieplague/`. Deaths and respawns preserve
knowledge. Role/class changes select another context. Map changes retain tactics
and select map-specific movement/shelter/boost data. Verified periodic saves
preserve knowledge across restarts. Invalid learning files are preserved by the
existing storage owners. See [adaptive bots](adaptive-bots.md),
[locomotion](bot-locomotion.md) and [shelters](bot-shelters.md).

Programmed actions, perception range, aim rules and available movement options
are not learned. An improvement on a familiar map is not evidence of new-map
generalization. Balanced K/D between two learning opponents proves neither
improvement nor stagnation.

## Start training and evaluate

Use a multiplayer server with a navmesh and enough player slots. Server convars
and the following experiment commands are controlled through the server console
or the usual administrative tools. See [training sessions](bot-training.md) for
population, spectators and round timing.

```text
zp_bot_stats_scenario stairs_a
zp_bot_stats_difficulty standard_loadout
zp_bot_stats_cohort trained
zp_bot_evaluation 0
zp_bot_training_count 2
zp_bot_training 1
```

Difficulty is a recorded experiment label, not a difficulty modifier. Set real
class/loadout and round conditions separately. Keep the server clock correct.

For frozen evaluation:

```text
zp_bot_evaluation 1
zp_bot_stats_scenario stairs_a
zp_bot_stats_cohort trained
```

The controller clears pending plans and creates validated deep copies of tactical,
profile, movement, passage and shelter parameters for each evaluated identity and
scope. New scopes are copied when first used. Exploration in the tactical and
movement learners is disabled. Boost updates and boost point editing are blocked;
their existing scores remain fixed. Frozen copies are discarded on leaving
evaluation; evaluation movement counters do not replace training memories.
The training orchestrator can keep `zp_bot_learning` enabled without bypassing
these guards. Reward observations continue during evaluation.

Set `zp_bot_stats_cohort heldout` for reserved scenarios, or `retention` for old
skills. Both force evaluation even when `zp_bot_evaluation` is zero. Declare
reserved scenarios before entering them; there is no automatic content-based
train/test split. Training and evaluation cohorts are never pooled for inference.
Changing experiment labels, learning mode or measurement settings interrupts
active attempts before collecting under the new configuration.

### Navigation without opponents

Disable automatic training/population filling, keep observers spectating, and
leave one managed living bot without living enemies. Enable evaluation, then as
a superadmin or from the dedicated console run:

```text
zp_bot_training 0
zp_bot_evaluation 1
zp_bot_benchmark 1 1200 -350 64
```

Arguments are identity slot and destination x/y/z in map units. The command drives
the existing navigator and motor; it does not teleport or modify movement rules.
It works while waiting for a normal round and suppresses combat inputs. Frozen,
dead or missing bots, global freeze time and living enemies reject the request.
An enemy joining during the attempt interrupts it. Completion, timeout, missing
navigation or failure stops the benchmark. Repeat after resetting the bot to the
same starting conditions through normal game/admin controls. There is no spawn
teleporter or automatic multi-scenario runner.

For combat, evaluate frozen opponents and record a fixed reference label with
`zp_bot_stats_opponent checkpoint_reference_1`. Preserve that opponent's actual
parameters and conditions between comparisons. The label is an experiment
declaration, not verification that an external addon or human is deterministic.
The default `uncontrolled` prevents navigation improvement/regression inference
when opponents are present. Combat totals remain descriptive.

### Checkpoints and reproducibility limits

`Policy` fingerprints identify the learned parameters, including shared boost
values. They are not replayable checkpoint files. This implementation freezes
copies in memory and compares retained results from earlier parameter versions;
it does not hot-load an old policy or provide a fixed scripted combat opponent.
To rerun an old checkpoint, preserve the existing learning/movement/boost files
with the server stopped and restore them in a separate stopped-server test copy.
Keep live training data and statistics exports intact. A fixed reference can use
a separate preserved, non-learning server copy.

Evaluation does not seed or replace the global engine RNG. Random destinations,
shelter scheduling, profile timing, weapon spread, physics, addons and human input
still limit reproducibility. Alternate sides, roles and starting positions using
the same predetermined schedule for every version. Compare matching conditions
within each schedule position, including old, trained and held-out scenarios.
This implementation does not automatically execute that schedule.

## Attempts and measurement

Navigation starts with an observed destination/intent. A change of intent or a
destination displacement over 100 units interrupts the old attempt. A completed
intent does not create repeated successes at every sample. Missing NavMesh is
recorded once even when no destination can be selected. A successful arrival is
within 40 units and 24 vertical units of the initial destination while grounded
or swimming. Teleport-sized movement and sampling gaps interrupt navigation.
There is no straight-line path-efficiency metric.

Combat records cover active-play periods, independent of navigation. Preparation
and isolated benchmarks do not create combat periods. Death, respawn, infection,
class changes, inactivity and administrative shutdown close records. Respawn
retains `Bot` and `Incarnation` and advances `Life`; replacement retains a saved
identity slot but receives a different incarnation. Map/server boot creates a
new session. Round numbers are local to that session.

Navigation terminal causes are `success`, `fall`, `enemy`, `environment`,
`unknown`, `timeout`, `interrupted`, `path_failure` and `missing_nav`. Interruptions
are not execution failures. Infrastructure failures are reported separately and
excluded from the execution-success denominator. Always inspect their counts:
excluding them is not evidence that navigation is reliable end to end.

`fall` means confirmed fall damage, not every intentional downward movement.
It closes navigation once; subsequent death callbacks cannot add another failure
to that attempt. Combat death remains a separate observation. Distances use
sampled displacements, exclude teleports and underestimate curved movement between
samples. Stuck time uses blocked steering or requested movement below the
configured speed. Recovery requires subsequent sampled movement over ten units.
Replans count increases observed after the initial route observation.

Damage/minute divides actual accepted damage by sampled active seconds. Kills and
deaths are event observations. Round wins/losses are credited once per identity,
role and round, including a dead participant; administrative/drawn outcomes do not
become navigation failures. Assists and shooting accuracy are not available from
the current instrumentation and are deliberately not fabricated.

Reward components retain their existing namespaced contributors: `tactical`,
`motion`, `place`, and `boost`. Clamping adjustments are explicit. Boost feedback
belongs to the initiating climber; shared boost scores are not individual samples.
The combined reward is bookkeeping across independent learners, not a new common
optimization objective. Learner episodes crossing a navigation boundary contribute
to the attempt active when feedback is emitted; raw components are not causal
credit assignments to whole routes. Inspect rewards beside actual outcomes.

## Daily/hourly history, retention and uncertainty

Every record contains UTC epoch timestamps and a formatted local date/time.
`zp_bot_stats_utc_offset` defaults to `-180` minutes (São Paulo, UTC-03:00).
The offset is explicit in each label; it is fixed and does not apply automatic
daylight-saving rules. Filtering a period uses prefixes such as `2026-10-17` or
`2026-10-17 14`. Day/hour attribution uses the attempt's start, including attempts
crossing midnight. Game durations use `CurTime`, not the wall clock.

Recent raw records default to 2,000 entries. A separate durable hourly archive
survives raw-event pruning, and daily summaries merge hourly sufficient statistics.
Archive windows are descriptive and can include different destinations and
parameter versions. They stay separated by identity, code/reward version, map,
scenario, difficulty, role, class/variant, equipment, physics, navmesh and settings.
Mixed-policy buckets have an empty `Policy`; exact parameter-version filters omit
them. These windows never drive improvement classifications. UI `≈` marks
descriptive groups. Blocks of 100 and per-session summaries use retained raw data;
blocks are not independent experimental replicates.

Raw medians/P90 use sorted successful durations and the nearest-rank method.
Archived medians/P90 use 96 logarithmic bins with 0.1-second initial upper edge
and factor 1.1; reported bin upper edges overestimate durations by at most 10%
above 0.1 seconds within the supported timeout range. Archived quantiles are
approximate. With zero successes, stored duration summaries are zero and must be
read with the adjacent zero-success count, never as a fast completion time.

For success, fall occurrence and timeout, each session supplies a proportion over
eligible attempts. The interval uses equal session weights, not pooled attempt
weights: `mean(session proportions) ± sqrt(log(80)/(2 * sessions))`, clipped to
`[0,1]`. These conservative two-sided Hoeffding intervals have 97.5% coverage if
sessions are independent and comparable. Two version intervals have at least 95%
simultaneous coverage by the union bound. No tick is an independent observation.
Session dependence across server boots remains an experimental-design limitation.
Archive cluster overflow widens bounds to `[0,1]`.

Only matching frozen navigation conditions are classified. Initial resources,
start/destination, identity and opponents must match. Success intervals must be
separated upward, with no worse median/P90 or observed fall rate, for evidence of
improvement. Separated downward success intervals indicate possible regression;
everything else is inconclusive. These are per-comparison exploratory statements,
not family-wide guarantees after searching many scenarios. Reward increases with
no higher observed success trigger a separate warning. Incompatible reward
configurations are not compared. Reward compatibility conservatively requires
identical source bytes for the modules owning reward calculations; unrelated
navigation changes can still be compared.

## Configuration, storage and export

| Convar | Default | Bounds / meaning |
| --- | --- | --- |
| `zp_bot_stats_sample` | 0.5 | 0.1–1 seconds between movement samples |
| `zp_bot_stats_stuck_speed` | 5 | 0–100 units/second |
| `zp_bot_stats_timeout` | 30 | 1–600 seconds per navigation attempt |
| `zp_bot_stats_block` | 100 | 10–1,000 raw attempts per block |
| `zp_bot_stats_retention` | 2000 | 100–2,000 closed raw records |
| `zp_bot_stats_days` | 90 | 1–3,650 days; archive also capped at 4,096 hourly groups / 8 MiB |
| `zp_bot_stats_utc_offset` | -180 | -720–840 minutes |

Snapshots are buffered and flushed by the existing 30-second save, round end and
shutdown. No sample writes files or sends network traffic. Unchanged snapshots
do not rewrite files. `statistics/history-v1.json` is capped at 8 MiB plus up to
128 pending records within that same file limit. `statistics/timeline-v1.json`
has its own 8 MiB cap. Each verified previous file has a `.json.bak.txt` backup;
failed writes retain memory for retry. Invalid input is preserved and disables
writes to that store until repair/restart. Restart recovers pending raw snapshots
as interruptions; a crash can lose the last unflushed interval. Hourly aggregates
contain terminal events included in their own last verified flush, so recovered
pending raw interruptions can be absent from the archive. The two files are not
one atomic filesystem transaction. Raw and archive pruning counts are exported.

Admins can filter bot, exact code/policy hash, scenario, difficulty, role
(`human`/`zombie`) and date/hour. Requests require valid admin players, bounded
payloads and at least one second between requests. Replies are private and at
most 48,000 JSON bytes. The UI shows up to 120 groups per collection and 20 recent
events, reports hidden groups, rejects stale replies and times out after five
seconds. Full retained raw records and filtered archive summaries are exported
server-side (up to 32 MiB), without sending the file over the gameplay network.

Use the panel's **Export JSON** button or:

```text
zp_bot_stats_export
zp_bot_stats_export "1" "" "stairs_a" "" "human" "2026-10-17"
```

The result is `data/zombieplague/bots/statistics/export-v1.json`. Copy exports to
retain longer history before configured pruning. Console export arguments follow
the six UI filters in order; empty quoted arguments leave a filter unrestricted.

### JSON version 1 field contract

The export envelope contains `Version`, `TimelineQuantileFactor`, `Report`, `Rows`
and `Timeline`. `Rows` contains recent closed raw records; `Timeline` contains all
matching retained daily/hourly summaries, including history older than `Rows`.
`Report` is the bounded UI snapshot, not an additional observation set.

| Raw fields | Meaning |
| --- | --- |
| `ID`, `Session`, `Round`, `Bot`, `Incarnation`, `Life` | Event, boot, round, saved identity slot, attachment and active-life identifiers |
| `Kind`, `Mode`, `Cohort` | Navigation/combat; training/evaluation/observation; trained/heldout/retention |
| `Code`, `Policy`, `Rewards` | Runtime AI source fingerprint, starting learned-parameter fingerprint, conservative reward-source fingerprint |
| `Map`, `Scenario`, `Difficulty`, `Role`, `ClassID`, `Variant` | Experiment and role/class context |
| `Equipment`, `Resources`, `Speed`, `Jump`, `Health`, `Physics`, `Navigation` | Weapon classes, initial health/armor/breath/magazine/reserve observations, run speed, jump power, maximum health, physics key and navmesh hash |
| `Reference`, `Opponents`, `Settings` | Declared fixed reference, complete initial opponent composition/parameter/position fingerprint (empty when absent), canonical measurement/rule settings and RNG limitation |
| `Start`, `Goal` | Three coordinates in game units; empty goal only when unavailable |
| `Started`, `Timestamp`, `EndedAt`, `RecordedAt`, `Day`, `Hour`, `UTCOffset` | Game start time, UTC start/end epochs, formatted start time and local calendar buckets/offset |
| `Seconds`, `Active`, `Distance`, `Stuck`, `Replans`, `Recoveries`, `Falls` | Elapsed/observed/stuck seconds, sampled distance and event counts |
| `Kills`, `Deaths`, `Dealt`, `Taken`, `Win` | Combat observations; win is 1, loss -1, uncredited/drawn 0 |
| `Reward`, `Components`, `End`, `Detail` | Observed reward sum, component map, terminal category and machine-readable reason |

Summary fields identify `Key`, `Session`, `Block`, `Period`, conditions and
`Descriptive`. They include `N`, `Eligible`, `Success`, `Falls`, `Timeouts`,
`Interrupted`, `Infrastructure`, `Median`, `P90`, `Active`, `Stuck`, `Kills`,
`Deaths`, `DealtPerMinute`, `TakenPerMinute`, `Wins`, `Losses`, `Reward`, `Sessions`,
`Low`/`High`, `FallLow`/`FallHigh`, and `TimeoutLow`/`TimeoutHigh`. Conditions include
`Kind`, `Mode`, `Policy`, `Scenario`, `Role`, `Map`, `Difficulty`, `ClassID`, `Cohort`,
`Code` and `Challenge`. Report fields include raw `Total`/`Dropped`,
`TimelineDropped` (hour groups), `Truncated`, `Groups`, `Timeline`, `History` and
`Comparisons`. Fractions and interval bounds are 0–1, not percentages. Different
collections overlap and must not be summed as independent observations.

## Example report — FICTIONAL DATA ONLY

These values illustrate interpretation and are not measurements of these bots.
Times below represent approximate archived quantiles. Same map, identity,
human class, equipment and difficulty; UTC-03:00.

| Started window | Scenario/cohort | Attempts / sessions | Success | Falls | Timeouts | Median / P90 | Mean reward |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-10-17 10:00 | stairs_a / trained | 100 / 1 | 60/100 | 20 | 20 | ~12.9s / ~25.2s | 0.30 |
| 2026-10-17 11:00 | stairs_a / trained | 100 / 1 | 75/100 | 15 | 10 | ~10.7s / ~20.8s | 0.45 |
| 2026-10-17 12:00 | new_map_a / heldout | 100 / 1 | 58/100 | 22 | 20 | ~11.7s / ~25.2s | 0.50 |

The trained-route trend looks better descriptively. One session per version
still produces uninformative intervals; the result remains inconclusive. The
held-out result has no matching earlier checkpoint in this example and provides
no evidence of generalization. Higher reward there is not proof of better play.
Use multiple independent, matched sessions and inspect failures, interruptions,
infrastructure and successful times together before drawing a conclusion.

## Validation and source boundaries

`sv_bot_statistics` collects events; `sv_bot_statistics_store` owns raw snapshots
and exports; `sv_bot_statistics_timeline` owns durable temporal aggregates;
`sh_bot_statistics_analysis` validates and analyzes data; the statistics service
owns permissions/network/commands; the two client modules own the themed view.
The learning gate protects all learner entry points, including shared boosts.

Run `npm run build` and `npm test`. Regression simulations cover terminal causes,
duplicate events, respawn/role identity, missing navigation, teleport/gap
exclusion, restart/retry/corruption, frozen parameters, held-out guards, matching
conditions, confidence limits, retention, calendar history, permissions and UI
themes. Simulations do not demonstrate skill improvement or a validated match.
In GMod, validate actual movement/physics, no-adversary execution, round
transitions, weapons, rendering, checkpoint restoration, filesystem capacity and
CPU/network costs at the intended bot population.

The change adds the eight statistics/learning-gate modules under `bots/`,
`types/bot-statistics.d.ts`, `types/server-bot-statistics.d.ts`, the statistics
regression suites and their helper. Integration updates `sv_bots`, the bot
controller/contexts and existing learners/boost stores, the admin presentation,
realm entry points, `migration.json`, generated-output ignores and client project
includes. All 32 native catalogs contain the new labels. Existing runtime,
localization, download-order and editor-project checks cover these integrations.
