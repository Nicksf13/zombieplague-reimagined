# Close-contact and idle-search regression fixes

The reported engine symptoms were stationary zombies and inactive face-to-face
contacts on `zm_canals` with two humans remaining. The following defects were
reproduced in local Lua simulations. This does not establish which defects
accounted for every stationary bot in that engine session.

## Confirmed execution defects

- The melee destination stopped closing at 65 units, then requested a 20-unit
  sidestep. Ordinary navigation considered that sidestep already reached within
  its 40-unit arrival radius. The native zombie fists have `HitDistance = 40`, so
  this could leave a zombie outside actual contact despite apparently facing
  its opponent. Melee closing now derives its stopping distance from validated
  weapon reach, with a conservative default, and uses an explicit contact arrival
  tolerance. It does not increase weapon damage or physical attack reach.
- Local hull probes discarded every candidate whose complete movement sweep hit
  a player, even if the beginning of the sweep was free. A zombie could stop
  before reaching melee contact or an ally's actual collision boundary. Grounded
  candidates can now use the collision-free prefix minus a two-unit margin.
  Invalid fractions, `StartSolid`, `AllSolid`, jumps, world/prop obstructions and
  missing ground do not gain this exception. Precision braking remains active.
- Wandering picked only one adjacent area's center. Dense, small areas could all
  be inside the arrival radius, producing no exploration input. Search now visits
  connected areas and selects a viewpoint more than 80 units away, preferring
  less recently visited candidates. Isolated large areas can supply projected
  viewpoints. No enemy position or occupancy is consulted.
- Choosing the nearest human afresh each pass let two similar-distance humans
  repeatedly reset target acquisition and reaction. A visible target now stays
  selected unless another is materially closer (a 1.35 distance ratio). Brief
  same-target occlusion up to 0.6 seconds retains the existing reaction deadline;
  sustained visual loss or a new target still requires normal reaction.

Movement prefixes use the engine's documented
[trace fraction and solid flags](https://wiki.facepunch.com/gmod/Structures/TraceResult).
They remain ordinary player input subject to server collision and floor checks.
Attack eligibility continues to check fresh line of fire, alignment and reaction.
A nearby visible contact is no longer erased solely because navigation lacks a
connection; a far unreachable target can still be temporarily ignored.

`AttackRangeReached` and `AttackRangeSeconds` now require an eligible issued attack
command. Being within a fixed 95-unit radius alone no longer counts as reaching
an attack opportunity; real hits/infections still require engine outcomes.

## Search and learning contracts

`sv_bot_search.ts` owns temporary geometry visits. Each search examines at most
48 areas and 256 connections, queues at most 128 area identities and keeps at
most 96 visits. A failed search destination has a 20-second retry fence. Ordinary
route planning still validates class capabilities, blocked areas and fall risk.
Lifecycle resets clear visits; route replanning does not erase search history.

Contact movement estimates have a `:contact` context suffix. Existing saved
knowledge is preserved; the more precise contact completion rule does not reuse
ordinary arrival estimates. Tactical outcomes still require issued execution,
and infection/damage must come from real game hooks. An attempted swing or a
shortened movement probe does not invent an infection or successful hit.

## Engine retest

Build and update the local game installation, then fully restart the server.
Reproduce the remaining-two-human scenario on `zm_canals` with frozen evaluation.
Check that zombies continue to search, close the last part of a melee approach,
and attack after reaction/alignment. Keep real obstructions, unsupported drops,
friendly blocking, foreign controllers and stale-plan gating distinct in exports.

Use the existing `zp_bot_activity_export`, `zp_bot_stats_export`, and short
`zp_bot_learning_trace_export` captures described in
[the evaluation procedure](bot-objectives-evaluation.md). Check actual infections
and position changes, not just the presence of attack/movement buttons.

The local installation contained a `zm_canals.nav` and matched the pre-fix motor
and controller artifacts when inspected. No active GMod process was available
for this retest. Real collision timing, map-specific route coverage and planning
load at the reported bot population remain engine validation tasks. Existing
two-plans-per-Think/2 ms budgeting and stale-plan suppression must still be checked
if many bots remain idle after these fixes.

## Local validation

The build generated 416 runtime Lua files. All 759 tests passed, including
regressions for melee closing, safe movement prefixes, search progress, target
retention, reaction timing and attack-opportunity accounting. Type checking and
editor project checks passed through the normal build and test workflow.
`git diff --check` passed. These checks simulate GMod; no engine match or external
game installation update was performed.
