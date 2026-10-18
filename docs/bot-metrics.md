# Bot metrics and scoped learning

Each managed bot identity has independent tactical action/profile estimates for
`(role, class ID, variant)` across all maps, and cumulative metrics for
`(map, role, class ID, variant)`. Variants are normal, nemesis and
survivor. Stable IDs come from the class definition or its registry key;
display names are not scope identifiers. The last-resort fallback for an
unregistered legacy class is its name. Profile learning remains individual to
each bot; it is not a population-wide policy for all aggressive or cautious bots.

The controller finishes the previous decision before rebinding after infection,
cure or class changes. Human infection penalties belong to the previous human
scope, while successful infections belong to the attacker's zombie scope.
Returning to a previous scope restores its experience and counters. Merely
changing scope never counts as a death, water escape or successful movement.

## Admin panel

Open F4 > Administration > Bots > Add AI bots. Admins can inspect up to 16 managed bots per
page; superadmins can choose 1–16 AI bots per request and add them using the
existing `zp_addaibot` server command. The themed quantity dropdown retains its
selection across polling, theme changes and reopening the menu. The menu exposes
AI bot creation only; legacy idle-bot console commands remain available. Server
permission, multiplayer and available-slot checks still apply.
Idle test bots and other addons' bots are excluded. The themed panel updates once
per second while visible and stops requesting data on navigation, closing or
permission loss. Cards update in place to preserve scrolling. Text uses native
localization in every supported catalog.

Each card shows an animated decision flow with six signal nodes (profile,
health, threat, distance, group and experience), four behavior nodes, and the
action actually selected. Solid edges favor an action; dashed edges discourage
it. Edge thickness represents the magnitude of the server's score contribution.
The active path pulses while the bot has a fresh active decision. Candidate bars
show signed preference scores, not probabilities. Outcome bars below the flow
show positive and negative episodes; the Details button expands the original
movement, resource, combat and reward counters without losing scroll position.

This is a visualization of rules and contextual-bandit estimates, not a neural
network. Profile contributions include role defaults and individual bias, using
the profile currently selected by that bot's adaptive profile learner. The card's
profile label reports this active choice; the initial preference used at creation
is retained separately. The graph shows action scores under the active profile,
not the profile-selection weights themselves.
Combined predicates are attributed to their first matching signal, retaining
the original total. A decision held briefly or chosen for exploration can differ
from the highest current score. The chosen path always follows the actual action.
Inputs and scores refresh with the existing one-second polling; pulses are a
client animation, not individual server learning steps. Animation stops after
2.5 seconds without a fresh snapshot, and searching/cleared plans have no
fabricated decision graph. No decision traces are persisted.

The panel displays the current scope and its accumulated metrics, not a browser
of historical maps/classes. Historical scopes stay on disk and are restored
when used again. Entity ID and route state are live diagnostics; cumulative
counters and learning use the persistent bot identity slot, never SteamID64.

| Measurement | Meaning and limits |
| --- | --- |
| Action and reason | Attack, defend, retreat or group; profile, existing learned estimate, exploration or searching without a visible enemy. |
| Learning samples | Nonzero decision outcomes incorporated into tactical estimates for the current scope. |
| Last reward | Most recently completed nonzero outcome in memory; not restored as a live state after restart. |
| Action outcomes | Episode count, positive/negative results and bounded reward balance per action. Neutral episodes are excluded. |
| Active/action time | Time between active observations, attributed to the preceding action. Gaps longer than one second are discarded. |
| Distance | Sampled world-unit distance, excluding teleport-sized deltas. This is not exact traveled distance between observations. |
| Route progress | Signed reduction in remaining route length for a stable goal and route. Replans and large movement deltas are excluded; moving away subtracts progress. Moving targets and waypoint shortcuts still make this an estimate. |
| Arrivals | Crossing within 40 route units of a stable destination. Teleports and route replacements do not count. |
| Replans | Route searches attempted, including failed searches and local fallback when navmesh is unavailable. |
| Blocked/stuck time | Steering reports a blockage, no safe steering direction exists for a distant goal, or requested movement yields less than five units per second. This is a movement heuristic, not proof of bad geometry. |
| Recoveries | Movement over ten sampled units after a blocked observation. |
| Water time/exits | Time at WaterLevel >= 2 and observed transitions to WaterLevel < 2. An exit does not prove the bot deliberately escaped. |
| Running | Speed input observed together with movement; time in seconds. It does not guarantee run speed was reached. |
| Breath spent | Observed decreases in the existing breath resource; regeneration is excluded and may conceal consumption between samples. |
| Drain enabled | Current human sprint-drain rule and positive `zp_run_drain` setting. Zombies use their normal gamemode resource rules. |
| Combat | Actual accepted hostile damage, kills, deaths and successful infections during active rounds. Self/same-team damage is excluded. |

Observation continues with `zp_bot_learning 0`: outcomes and movement remain
measurable, while tactical estimate updates and exploratory choices are frozen.
The locomotion learner has its own rewards, action estimates and passage costs;
these never update tactical estimates. Stuck feedback belongs to locomotion.
See [Locomotion learning](bot-locomotion.md) for checkpoint rewards, water/ladder
control, active physics contexts and persistence. Combat feedback continues to
drive the tactical contextual bandit.

Movement counters also cover exploration during the unfrozen infection
countdown. That phase has no combat decisions or tactical rewards. Waiting,
freeze time, round end, restart and map changes still suspend observation.

## Storage and network contracts

Version 2 map metrics live in `data/zombieplague/bots/metrics/<SHA256(scope-key)>.json`.
The length-prefixed key includes map, role, stable class ID and variant. Each file
also contains the explicit scope, up to 64 identity records, empty tactical
estimate/behavior tables and metrics. Loading verifies the scope, numeric bounds, profiles
and schema. A missing metrics file can read counters from the legacy
`bots/scopes/` record; saving writes only the new metrics path.
Each file is limited to 512 KiB. Invalid files are left unchanged and disable
writes for that scope for the current instance; other scopes remain independent.
Verified previous contents are backed up as `.json.bak.txt`; failed writes retain
dirty in-memory state for retries. Saving runs every 30 seconds, at round end and
shutdown. Legacy version 1 data is preserved and only provides profile defaults.

Tactical estimates now have one owner across all maps:
`data/zombieplague/bots/learning-v3.json`. The displayed map and cumulative metrics
remain local, while tactical sample counts and learned decision contributions
include experience from every map for that identity/role/class/variant. See
[Adaptive bots](adaptive-bots.md#persistence-and-ownership) for migration, schema
limits and independent retry/corruption handling.

`ZPBotMetricsRequest` is version 1: UInt8 version, UInt31 request ID, UInt2 page.
The server checks the exact 41-bit size, validity and admin permission before
reading, and limits each player to one request per 0.75 seconds. Replies are sent
only to the requester. `ZPBotMetricsReply` contains at most 16 diagnostic rows
and at most 64 total bots. Client parsing checks scopes, enums, totals, duplicate
IDs, numeric bounds, pending request ID and page. Late replies cannot reopen the
menu. Requests time out after five seconds and resume polling.

An optional `Decision` field adds bounded live inputs, decision age/hold state
and per-action score decompositions. Every score is checked against the sum of
its contributions, and grouping eligibility must agree with ally availability.
This additive field does not change existing request IDs, channels or persisted
version 2 learning data. Maximum-length full pages are checked against the net
message budget in tests.

## Validation

Runtime simulations cover signed progress, inactive gaps, teleport exclusion,
water exits, breath consumption, recovery, scoped reloads, legacy preservation,
corruption, backup retries, infection/cure attribution, paused training,
permissions, rate limits, stale replies, pagination and themed card reuse. Visual
tests cover actual score inspection, signed connections, stale animation,
details expansion, Unicode truncation, compact screens and native labels.

In GMod, verify a multiplayer match with a navmesh: inspect attack/retreat,
run-drain toggles, water entry/exit, a blocked doorway, death, infection, cure,
class changes and server restart. Confirm that each scope resumes its own totals
and samples, the panel updates without resetting scroll, and network/tick costs
remain acceptable at the intended bot count. Simulations cannot validate engine
physics, SWEP behavior, actual rendering or improved playing skill.

The Movement tab adds a projected route (current position, next checkpoints and
goal), actual directional/jump/duck/sprint inputs and vertical view indication,
per-action learned values, current passage success evidence and timing, overall
traversal results, progress, reward, breath, recoveries, water exits, ladder
completions and environmental damage. Arrows denote actions relative to the next
checkpoint; the W/A/S/D row shows actual view-relative inputs. Motion data is an
optional validated field on the existing private, paginated admin reply.

Shelter/hunt diagnostics add an optional validated `Place` field. The Movement
tab identifies patrolling, shelter travel, guarding, hunting or inspecting,
marks the chosen point, and shows visit/find evidence and remaining holding
time. Details include coordinates, selection reason, damage, escapes, deaths
and empty inspections. Client state clones point arrays. See
[Shelter and hiding-place investigation](bot-shelters.md) for reward, persistence
and reservation rules.
