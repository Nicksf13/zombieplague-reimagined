# Shelter and hiding-place investigation

AI bots can choose a shelter or investigation destination alongside their
existing combat and movement policies. Humans can travel to cover, guard an
entrance and leave. Zombies can inspect likely hiding places between pursuits.
This is a goal-selection layer; it does not replace pathfinding, combat rules
or the locomotion learner. Generational evolution is not part of this change.

## Candidates and validation

`sv_bot_place_catalog` owns a realm-wide cache and same-role reservations.
Nearby candidates come from
[`CNavArea:GetHidingSpots(1)`](https://wiki.facepunch.com/gmod/CNavArea:GetHidingSpots).
Where native points are absent, a few projected nav-area corners can qualify
after geometry checks. This does not identify every mapper-designed hideout.

Administrators can also add role-scoped shelter suggestions through
**Bots > Tools > Safe points**. See [Authored safe points](bot-safe-points.md)
for placement, storage and safety checks. These candidates participate in the
same bounded search and visit policy, with an initial preference.

Search visits at most 48 connected areas, examines 48 connections per area,
queues at most 128 areas and returns at most 32 distinct point identities.
Points are keyed by area ID and coordinates rounded to 16-unit cells. Cache
size is limited to 96 areas, with a sixty-second lifetime. Water, nav blockers,
unsafe drops and climbs outside the active class capabilities are excluded.

At most six shortlisted candidates receive geometry validation per choice.
Checks use the player's standing/duck hulls, nearby floor and a class-usable
exit. Native points receive a cover preference; inferred corners require two
nearby blocked directions. Human candidates under a known threat must also
break that threat's line of sight and stay away from it.

Remote geometry traces ignore all player bodies. They query map/prop geometry,
never occupancy of unseen enemies. Reservations only coordinate bots of the
same role: a zombie cannot infer a hidden human from its reservation. Existing
perception supplies all enemy sightings and remembered positions.

## Variety and lifecycle

Choice opportunities occur every 8–14 seconds. Human selection probabilities
are 20% for aggressive, 35% cooperative, 65% defensive and 75% cautious bots.
Zombies always consider an eligible investigation. Known-threat human escape and
zombie repositioning bypass the quiet human lottery and retry at most once per
second; a failed quiet opportunity does not delay urgent cover. Selection randomizes
among the top three valid candidates; learned preference contributes at most
0.35 in either direction. A recent human sighting can bias a zombie's search
for up to 45 seconds, using only the last observed position.

After arrival, humans guard for 6–14 seconds; zombies inspect for 2–4 seconds.
They look toward connected entrances at eye height. Required crouching remains
active while stationary and its actual input is visible in movement diagnostics.
Combat, compromised cover or substantial damage can interrupt a visit. A nearby
threat does not cancel travel to still-viable cover. Zombies can use cover during
repositioning; ordinary pursuit takes priority over hiding-place patrols. Human shelter plans can continue
after losing sight of a threat.

Every completed/interrupted visit imposes a 35–65 second point cooldown and
at least 5–9 seconds before another selection opportunity. Reservations last
45 seconds and release when the visit ends. Travel attempts time out after
25 seconds; unreachable navigation ends the visit. Freeze, scope changes and
other resets cancel pending reinforcement neutrally. Teleport-sized deltas or
observation gaps over one second also cancel without claiming success.

## Learning and persistence

`sv_bot_place_learning` records visits started, actual human finds, observed
escapes into cover, deaths/infections, empty completed inspections, incoming
damage and sampled holding time. Quiet survival supplies no positive reward.

Once per visit, a zombie can earn +0.8 for actually seeing a human near the
investigated point. A human can earn +0.6 only after arrival and three continuously observed seconds of protection,
with no recent hostile damage, geometric cover and over 320 units of separation. Damage subtracts
up to one normalized-health unit per event; death/infection subtracts one.
An empty zombie inspection costs 0.15; failed navigation costs 0.25. On visit
completion the estimate moves 20% toward the accumulated reward clamped to
[-1, 1]. Round completion retains already-earned outcomes before saving.
Interrupted quiet stays do not fabricate positive samples.

Up to 64 place records live in the optional `Places` member of version 1
movement memory, separated by persistent bot identity, map, role, class,
variant and navmesh fingerprint. Old files without the member remain valid.
Existing verified backups, corruption protection and periodic/round-end/
shutdown saving apply. Personality changes retain place experience.
`zp_bot_learning 0` freezes estimates while metrics and ordinary exploration
continue. Combat, passage and place rewards remain separate.

F4 > Administration > Bots > Movement shows the purpose, destination marker,
visit/find counters and current learned value. Holding time is displayed while
guarding/inspecting. Expanded details include the reason, coordinates, escapes,
deaths, empty checks, damage and observed holding time. The optional `Place`
diagnostic is bounded, validated and copied before exposing client state.

## Ladder changes and engine validation

`sv_bot_ladder` separates entry, attached climbing and exit steering. Entry
projects onto the source floor near the ladder face, including ladders whose
upper endpoint extends above the landing. Attached view faces the ladder's
normal while looking up/down. Movement waits for horizontal aim alignment and
uses forward input without arbitrary strafing. Exit uses the destination floor
height; a crouched destination does not remove every climb candidate. Dynamic
props still block the maneuver. All motion uses normal player commands.

Simulations cover role-specific visits, optional personality choices, cooldowns,
reservations, hidden-player isolation, rewards, cancellation, persistence,
network/client validation and ladder entry/turning/landing/crouching.
In GMod, verify shelter suitability, entrance scanning, interruptions, route
coverage, crouched clearance, ladder attachment/dismount and tick cost at the
intended bot count. Automated tests do not establish reliable physical traversal
or increased match skill on a real map.

Place identities now use a `v2:` prefix to isolate the changed outcome semantics.
Old records remain readable, subject to the existing 64-record retention bound.
Endpoint cover and two straight-route samples estimate exposure; actual NavMesh
access is checked by the navigator. This is not a full tactical route optimizer.
See [decision contracts and evaluation](bot-objectives.md) for hearing, temporary
investigation memory and the engine scenario matrix.
