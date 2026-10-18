# Locomotion learning

Managed AI bots have a movement learner independent of combat preferences.
It selects from programmed, feasible maneuvers and learns their observed value.
It also records traversal outcomes to adjust A* passage costs. It does not infer
new geometry, invent arbitrary button programs, imitate players or train aiming.

## Goals and checkpoints

The tactical controller supplies a goal and intent identity. Navigation keeps
explicit directed nav-area transitions and a final point. Intermediate success
requires being inside the destination area at the correct height, on the ground
or swimming when appropriate. Nearest-area lookup alone never establishes
arrival. Ladder traversal requires leaving ladder movement and entering the
destination area. Final arrival requires reaching the actual goal within 40
units. Moving targets retain their intent so pursuit can still accumulate trials.

Melee pursuit uses three-dimensional reach, so a human directly overhead still
needs a route. Floor association first uses
[`navmesh.GetNavArea`](https://wiki.facepunch.com/gmod/navmesh.GetNavArea), then a
nearest-area fallback with explicit elevation/distance checks. A nearby lower
floor cannot stand in for an unmapped upper floor. Intermediate arrival checks
the area's local ground height, allowing sloped areas with a different center
height. Moving to another destination area/floor invalidates the current path;
small movement within the same area updates the final point without discarding
the detour.

Existing directed connections can also use [controlled descents](bot-descents.md)
with class-aware fall risk, edge alignment, landing validation and visual
connection diagnostics. Nearby surfaces alone do not create a connection.

When forward ground probes fail on a narrow connected surface, navigation can
replace center-to-center steering with an alignment point and an entry point
through the shared boundary. `BotGroundTraversal` only considers existing
non-ladder transitions with boundaries within four units, a shared span wider
than one unit, and a local height change between -24 and +18 units. It clamps
the shared span to the player's hull margin and uses its midpoint when narrow.
Every candidate still requires ordinary local hull and ground validation;
missing floor support never authorizes walking into a gap. The fallback keeps
its crossing phase until checkpoint entry or route reset, avoiding alternation
between aligning and entering. Jumping and sprinting are withheld during this
approach, and speed is capped by checkpoint distance divided by 0.25 seconds.

### Precision on narrow paths

`BotPrecisionTraversal` anticipates narrow ground passages before a forward action
fails. It activates when either connected area is at most twice the standing hull
width (with a 48-unit minimum threshold), or lateral floor probes detect an edge
at the player or up to 32 units ahead. Activation remains stable for the current
directed transition. Ordinary wide ground, explicit jumps, ladders, swimming and
controlled descents retain their respective controllers.

Narrow shared boundaries use their midpoint. Alignment and entry offsets are
limited to half each area's depth so a right-angle turn cannot place an alignment
target on the beam's opposite edge. Precision approaches align within four units
before crossing. Players near the side of a thin area first correct toward its
centerline. The starting pace is at most 45% of class walk speed and 80 units/s;
distance to the checkpoint reduces it further. All movement uses normal player
inputs and the existing navmesh connections.

Precision actions include straight walking and validated crouching when needed.
Sprint, jump exploration and diagonal/side escapes are excluded. Floor support
is sampled at intervals of at most four units for ordinary local commands, using
a center probe and a small lateral margin of up to three units. This permits
legitimate beams narrower than a standing hull while rejecting intermediate holes,
steep support normals and floors more than 24 units below the expected surface.
The whole collision hull still must pass the ordinary obstruction trace.

The motor also checks support and hull occupancy on every `StartCommand`, rather
than trusting a plan for the full 0.2-second decision interval. Velocity feedback
counters lateral drift and excess forward speed. A stale unsafe command falls
back to a validated braking input or zero input; it never teleports, changes player
velocity directly or disables collision. Airborne players do not execute stale
precision walking commands.

If progress stalls for 1.2 seconds, the controller can retreat to a recently
validated point four to 24 units away, for at most 0.6 seconds with a two-second
cooldown. Every retreat is revalidated against current support and obstacles.
Temporary player/prop occupancy waits instead of triggering random recovery or
permanent passage failure. Unresolved static obstructions still reach the existing
replanning logic. Route, physics and realm lifecycle resets clear temporary state;
persisted learning and map files are preserved.

Regression tests exercise narrow right-angle turns in both directions, support
holes, braking, recentering, occupancy and recovery. An inertial movement
approximation checks that command/plan timing can finish the simulated course;
it does not model Source friction, collision impulses, real navmesh generation or
the compiled `zp_training_zig_zag` map. Validate those in Garry's Mod, first with
one bot and then with opposing or following bots, recording completed crossings,
falls and stuck time under the same class and server physics.

Navigation diagnostics describe the current transition rather than retaining
the first route edge or reporting a placeholder zero height. A found graph path
does not imply an executable local action: when no action is available, the
panel distinguishes missing floor ahead, player/movable-object occupancy and
static obstacles. Temporary occupancy continues to suppress permanent passage
failure learning. Descent diagnostics retain their geometric phases and path.

Search distinguishes complete routes, partial frontiers, reachable approaches,
missing coverage and unreachable goals. A bounded search can supply a connected
prefix and continue from its frontier. An exhausted disconnected search may
supply a closer reachable approach, but completing it never counts as reaching
the requested goal. Known failures stop direct pursuit and delay retries for
five seconds. Missing coverage only permits local motion within conservative
vertical limits, with the existing water recovery exception.

Three movement-learner replans without a checkpoint invalidate a stalled route
temporarily. Reaching a checkpoint resets that count. When pursuing an
unreachable enemy, perception suppresses that target for five seconds and can
select another visible enemy. During a valid route, the last observed target
position remains available for up to twenty seconds after sighting; this also
covers the short gap between partial-route segments. Hidden target coordinates
are never refreshed. Pursuit keeps one learning intent across loss of sight,
and progress toward a stair checkpoint can earn reward while straight-line
distance to the enemy increases.

Progress is measured against a stage frontier and remaining route length, not
only straight-line distance to the ultimate goal. Frontier and completion ledgers
prevent repeated backtracking from earning the same bonuses for one intent.
Target motion alone supplies no progress. Teleport-sized deltas, long observation
gaps, excessive horizontal knockback, freezing, scope and physics changes cancel
unobserved movement neutrally. Confirmed human damage to a hunting zombie's
executed jump is retained as negative feedback even if knockback or death cancels
the pending trial. Goal changes start new ledgers.

## Actions and rewards

Candidates include advance, reverse, lateral/diagonal movement, jumping and
diagonal jumps, ducking and ducking diagonally, sprinting, swimming upward and
ladder approach/climbing. Directions are relative to the next checkpoint;
ordinary player movement is transformed against actual view direction. No
position, velocity, health or class property is overridden to complete a trial.
Normal movement looks ahead at eye height; ladder/water orientation takes
priority while needed. Direction buttons accompany analog movement, so existing
sprint breath rules observe the input correctly.

The local controller uses actual standing/duck hulls and checks obstacles and
ground before offering candidates. Reverse/lateral recovery is available after
stall detection. Jump and duck trials are offered when relevant to obstacles,
nav attributes or recovery. Sprint is withheld when the class cannot run faster
or human breath is low under active drain rules. Ground checks do not reject
swimming or attached ladder movement merely because no floor is immediately
ahead. Nav ladder connections must exist; automatic generation/repair is not
performed. Without a known dry exit, water recovery can attempt ascent, but it
cannot guarantee discovering a usable shoreline without navigation coverage.

When both `zp_run_should_drain` and `zp_realistic_mode` are disabled, sprint has
priority over ordinary walking on clear ground more than 64 units from the next
local target. Its prior exceeds the bounded learned walking advantage, so old
walking estimates do not require a history reset. Safe candidate exploration
remains available. The preference does not apply to obstacle recovery, required
jumps/crouching or airborne movement. Precision passages, controlled descents,
ground-transition checkpoints, ladders and water retain their existing speed
controls. Class run speed and sprint eligibility remain authoritative; enabling
either mode restores the normal stamina-aware selection priorities.

Trials normally last at least 0.45 seconds; airborne jump continuations can last
up to 1.5 seconds. Approximately 10% of eligible selections explore another safe
candidate. Rewards include bounded new stage/route progress, +0.5 for a new
checkpoint, +1 for the goal and +0.5 for observed water exit. No-progress trials
receive time penalties and an additional -0.45; traversal timeouts cost -0.5 and
request replanning. Actual breath decreases cost reward when sprint drain is
active. Attributed fall damage supplies a failed-crossing outcome; unassigned
fall/drowning damage is recorded without guessing an action owner. Positive
progress stays in escrow until stage completion. Expiry, interruption and a
foreign controller are distinct outcomes; see [learning integrity](bot-learning-integrity.md).
Hostile bullets do not mark movement passages as failures. Trial rewards are
clamped to +/-2 and estimates move 20% toward a target clamped to +/-1.

Human damage received by an airborne zombie during pursuit also penalizes the
specific jump maneuver, provided the bot actually issued its ground jump input.
Selecting a jump without executing it, walking off a ledge, being pushed into the
air without jumping, swimming and ladder climbing do not qualify. The controller
requires a fresh pursuit plan, a playing round and active, unfrozen AI. Human
bots, zombie retreats, friendly hits and unapplied damage do not receive this
additional movement feedback. Ordinary combat damage feedback remains separate.

Damage is accumulated for the active jump trial and charged to its original
takeoff context, including diagonal jumps. Positive progress/arrival bonuses
cannot offset a hit jump's exposure cost: its reward is at most zero before
subtracting `min(1, damage / 100)`, followed by the existing no-progress timing
penalty. This uses damage amount rather than hit count; a headshot's greater
applied damage therefore has a greater cost up to the cap, without changing
weapon damage or knockback. A forced-motion cancellation commits the injury
before discarding movement deltas, so getting launched cannot turn into a reward.
Only the maneuver estimate changes; bullets never teach that the navmesh passage
itself is impassable. Injury totals and action rewards appear in the existing
Movement diagnostics, using the same map/class/variant/identity persistence.

The learner chooses finite maneuvers. A short reverse action may help a later
jump without immediately reducing goal distance; delayed credit across arbitrary
long action sequences is not provided by this foundation.

## Context and route costs

Experience is separated by persistent bot identity, map, human/zombie class and
normal/Nemesis/Survivor variant. Context also includes active walk/run speed,
jump power, gravity, standing/duck hull dimensions, crouch speed, movement mode,
directed passage, obstacle type and low/normal breath. Temporary abilities
therefore do not silently reuse incompatible physical expectations. Class
labels such as Heavy are not treated as independent physical mass parameters.

After at least three observations, repeated failures and slow traversal increase
a passage's A* cost. Positive costs preserve the distance heuristic. The
direction and physics signature matter: climbing one way does not establish
success in the other direction. Player/physics-prop blockers are recorded as
temporary; a stage that encountered one does not teach a permanent map cost.

Path search remains bounded to 128 visited areas, 1,024 examined connections and
256 queued areas; ladders and adjacency are bounded per node. Dry-exit search
visits at most 64 areas. At most two bot plans run per Think, with the existing
soft time budget. Engine trace/search cost and intended bot population require
in-game profiling.

## Persistence and inspection

Movement data lives in
`data/zombieplague/bots/movement/<scope-hash>/<navmesh-hash>/<identity>.json`.
The navmesh fingerprint is computed on controller startup from the installed
`.nav` file. Reload/restart after regenerating navigation; old revision files
remain preserved. Tactical experience uses the separate cross-map store described
in [Adaptive bots](adaptive-bots.md#persistence-and-ownership). Movement experience survives
combat personality changes and restores when returning to its scope.

Each version 1 movement file contains an explicit scope/identity/navigation
revision, at most 256 action estimates, 128 passage records and cumulative
metrics. An optional `Places` member adds up to 64 independent shelter/hunt
records; older files without it remain valid. See [Shelters](bot-shelters.md).
Input is limited to 128 KiB and validated on load. Corruption disables
writes to that file for the current instance. Saves retain a verified previous
`.bak.txt` and pending state on failure. Saving follows the existing periodic,
round-end and shutdown lifecycle. Only estimates/counters are persisted; player
trajectories and commands are transient diagnostics.

`zp_bot_learning 0` freezes movement estimates, route-cost updates and movement-action exploration
while retaining metrics and applying prior experience. `zp_bot_ai_enabled 0`
stops input and cancels pending trials. During unfrozen preparation, movement
can learn while combat remains inactive.

Open F4 > Administration > Bots > Movement. Inspect the projected checkpoint
route, actual input keys/view, learned action bars, passage successes/attempts
and mean time, reward, progress, stalls, breath, movement-related damage, recoveries,
water exits and ladder completions. Combat and Movement tabs update in place.
Details expands full counters when narrow screens shorten labels. Diagnostics
are private to admins, bounded and validated; full maximum-length pages remain
below the network budget.

## Validation

Simulations cover elevated targets, stair detours, wrong-floor endpoints,
partial routes, reachable approaches, unreachable-target selection, bounded
pursuit memory, changed movement choices after failures, checkpoint/goal
arrival, wrong-floor rejection, anti-farming, moving goals, neutral cancellation,
physics changes, persistence and corruption, learned alternative routes,
temporary blockers, duck hulls, jump capabilities, sprint breath input, swimming,
ladder ascent/descent, damage attribution and detached client state.

In GMod, exercise these cases with installed SWEPs, real doors/props, several
classes, low/high gravity, vertical ladders and a pool with a navigable exit.
Check smoothness, jumping timing, ladder attachment/dismount, drowning feedback,
resource consumption, saved scope restoration and tick/network cost. Automated
tests do not establish reliable traversal on a real map or improved match skill.
