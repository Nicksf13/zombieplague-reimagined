# Connected descent traversal

Bots can execute directed navmesh descents through an explicit edge approach,
departure and landing. This addresses bridges and platforms whose areas are
connected but whose height change or unsupported departure was previously
rejected. It does not create navmesh connections, teleport bots or enable
unbounded exploration of gaps.

## Route eligibility

The old fixed 100-unit descent limit is replaced by `fallRisk`. The estimate uses
the player's live `ShouldTakeFallDamage` rule and the gamemode's current base
formula: `max(0, ceil(0.2418 * sqrt(2 * gravity * drop) - 141.75))`.
Gravity comes from the active server setting and player gravity multiplier.
Fall-damage immunity therefore applies to the active class and server rules.

A drop must be no more than 768 units and its estimated damage must be less than
current health and no greater than the smallest of 100 damage, 15% of current
health and 10% of maximum health. Routes with expected injury receive additional
cost, favoring a safer alternative when available. Custom addons that change the
base fall-damage formula may require adapting this estimate.

Direction still matters. Pathfinding only follows existing outgoing adjacency
or ladder connections. Ascents retain the existing jump-height checks. The same
fall rule applies when choosing adjacent wandering destinations and evaluating
available shelter exits.

## Execution and validation

Descents greater than 24 units use `BotDropTraversal`:

1. Find the nearest departure boundary toward the destination. If needed, test
   the center direction and four cardinal exits, including platforms underneath
   an overlapping source area.
2. Choose an alignment point inside the source, an exit beyond its boundary
   using the player's hull width, and a landing inside the destination area.
3. Check horizontal travel against conservative walking reach during the fall.
   Confirm floor support, floor height, an upward ground normal when supplied,
   standing hull clearance and eight swept hull segments along the descent.
4. Approach the alignment point using normal ground checks. Once aligned,
   permit forward movement across the validated departure and steer toward the
   landing while airborne. Alignment slows near its checkpoint; departure pace
   follows the landing distance and estimated fall time to reduce overshooting.
   These phases do not request sprinting or jumping or modify class speeds.
   If the current or destination area requires crouching, crossing retains the
   forward crouch action instead of filtering out every movement candidate.
5. Count the transition only after actual grounded entry into the destination
   area at its floor height. A lower area merely being nearest is not arrival.

Normal forward probes shorten near a checkpoint, so reaching an alignment point
does not demand floor support another 48 units beyond it. Immediate-ground
checks are bypassed only during a validated descent's crossing/landing phases.
Ordinary local movement still avoids unsupported cliffs. Geometry validation
ignores player bodies to avoid making conclusions about hidden opponents;
ordinary movement collision checks still respect players and dynamic props.

Health and fall risk are checked again before departure. A bot already airborne
continues toward its landing rather than cancelling because its health changed.
A changed pursuit goal cannot replace an active airborne descent. Landing on
the wrong floor or taking more than fifteen seconds fails the traversal. Freeze,
scope/physics changes and controller resets discard the transient plan.

A geometrically rejected connection is excluded locally for five seconds, with
at most 128 exclusions per navigator. The next plan can use another existing
connection before declaring the target unreachable. These exclusions are not
written into the navmesh or persisted as permanent passage failures. Search,
geometry candidate and swept-trace counts remain bounded; real-map trace cost
and airborne steering require engine profiling and tuning.

## Learning and diagnosis

Alignment, departure and landing feed the existing locomotion learner while
retaining the original directed passage and pursuit intent. Stage frontiers
handle changing local waypoints; a passage bonus still requires actual arrival.
Geometric rejection is not a completed movement trial. Actual traversal stalls,
progress, falls and damage continue through the existing feedback rules.
Progress compares both observed positions against the same current waypoint,
so switching from alignment to departure cannot manufacture backtracking.
Observed vertical velocity and gravity allow normal falling deltas even with
slow departure input; teleport-sized deltas and forced horizontal pushes remain
excluded from progress feedback.
Persistence remains separated by identity, map, role, class, variant and active
physics/navmesh revision; saved experience is not erased or converted.

F4 > Administration > Bots > Movement shows connection IDs, traversal phase,
signed height change, estimated fall damage and a projected waypoint path.
Reasons distinguish missing coverage, absent outgoing connections, movement
reach, unsafe falls, invalid landing, obstructions, stalled traversal and bounded
search frontiers. Details retains full text when the compact projection clips a
translated label. All labels use the active theme and native language catalogs.

Navigation diagnostics are optional, validated and copied at server/client
boundaries. A packet contains either the ordinary route projection or the
descent/rejection projection for each bot. Sending both is rejected, keeping a
maximum-size 16-bot page below the existing 500,000-bit client limit.

## Validation

Local simulations cover connected 200-unit descents, original takeoff context,
directional connectivity, immunity/health/gravity risk, missing or steep support,
obstructed hulls, alternative routes, overlapping floors, long narrow bridges,
crouch-required departure input,
wrong-floor landings, diagnostic validation, translated rendering, detached
client paths and worst-case network size. Existing elevated-target, ladder,
jump-damage and locomotion tests remain relevant.

In GMod, verify the reported source/destination IDs and rejection reason on the
actual bridge. Exercise alignment on the narrow beam, leaving its collision hull,
airborne steering, landing under fire, class changes and temporary prop/player
blockers. Simulations do not establish that the pictured map has been traversed
successfully in the engine.
