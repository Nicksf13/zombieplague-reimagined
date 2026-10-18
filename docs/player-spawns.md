# Player spawn queue

Building updates the workspace, not a separate Garry's Mod installation. Verify
that the running copy includes `sv_player_spawns.lua` and `sv_spawn_occupancy.lua`,
and that its `sv_player.lua` includes the selector. An older installed copy can
continue using the base random selection even when workspace tests pass. Restart
the map after installing the generated files.

`player/server/sv_player_spawns.ts` owns the server's `GM:PlayerSelectSpawn`
implementation. Spawns consume a shuffled queue of unique locations. Human
players and bots follow the same selection path. `sv_spawn_occupancy.ts` owns
physical occupancy checks and immediate reservations for the current server tick.

The gamemode uses one shared pool across humans and zombies, matching its
existing non-team-based configuration. If an addon enables `GM.TeamBased`, the
selector uses `team.GetSpawnPoints` with a queue per team, falling back to the
generic map pool when that team has no usable configured points. Reservations
are shared across team queues so overlapping team registrations cannot allocate
the same space to two players while their spawns are still being processed.

The generic pool includes the base gamemode's HL2, GMod and TF spawn families,
CS spawn entities, and classes registered through
`scripted_ents.GetMember("gmod_player_start", "SpawnPointClasses")`.
`info_survivor_position` is excluded as in the base selector. Entities are
deduplicated by position (coordinates within one unit), and removed or
out-of-world entities are discarded. Separate spawn entities at the same
coordinates do not increase the map's physical capacity.

Before consuming a point, the selector checks the player's full standing hull
against live players and current reservations, then calls `IsSpawnpointSuitable`
with `bMakeSuitable=false`. Selection immediately reserves that volume. Repeated
requests for the same player within the tick reuse the same safe reservation
instead of consuming more points. This works before the engine publishes the
player's new position. Pending players' old positions are ignored when their
reserved destination is elsewhere; a body already at the destination still
contributes its current hull, including size changes during spawn.

Occupied points remain pending while a suitable point exists. If the remaining
queue is rejected, the full pool is searched without resetting consumption or
dropping reservations. Physically free positions take precedence over overlaps
even if a suitability hook rejects them all. This matters when the stock check
still sees the previous life at an unused point during round preparation.
If no free volume remains, the fallback prefers a location not yet reserved;
overlap is still possible when the map has insufficient physical capacity. The
selector never requests the base behavior of killing occupants to clear space.

Reservations reset on the next server tick, when published player positions
become authoritative. Nearby spawn volumes that overlap are rejected while a
free alternative exists. The capacity is usable physical space, rather than the
number of entities: tightly packed points can fit fewer players. Other addons
that override `PlayerSelectSpawn` can bypass selection. A deferred `PlayerSpawn`
check now validates actual live-player hulls after the spawn wave finishes. If the
engine or a synchronous addon placed a player on another player despite the
selection, the spawning player is moved to a free queued spawn, one unit above
its origin. Safe final positions are preserved. The check runs once per spawn,
never during subsequent combat movement; map transitions, spectators, deaths,
disconnects, superseded checks and map cleanup invalidate or skip it. When no
free spawn exists, it does not move a player from one overlap to another.

Point ownership also compares the reserved location directly, so a temporary
zero-sized hull cannot allocate the same point through another team queue.

`PostCleanupMap` clears the queues. Round preparation already calls
`game.CleanUpMap()` before spawning participants, so each round starts with a
fresh queue without retaining removed entities or reservations. Explicit and
voluntary spectators do not consume points. All other players, including their
first engine spawn, receive a normal allocation; selection no longer depends on
the `FirstSpawn` flag changed by `PlayerSpawn`. Map transitions leave the
player's position to the engine.

Regression tests in `tests/player-spawns.test.mjs` and
`tests/player-spawn-occupancy.test.mjs` cover distinct selections, overflow,
cleanup, first/spectator spawns, transitions, team overrides, duplicate locations,
overlapping hulls, repeated callbacks and delayed position publication. The
two-point training scenario uses the local VMF's positions `(1792, -556, 128)`
and `(256, -556, 128)` with previous-round bodies still visible to the stock
occupancy check. Editor tests open both TypeScript modules. Tests simulate GMod;
actual engine timing and the installed map still require in-engine validation.
`tests/player-spawn-placement.test.mjs` additionally uses all six coordinates
from the local `zp_training_zig_zag.bsp` entity lump and simulates final engine
positions that disagree with the selected points. It verifies overlap repair,
capacity exhaustion, stale checks, and that normal movement remains untouched.

API references: [PlayerSelectSpawn](https://wiki.facepunch.com/gmod/GM:PlayerSelectSpawn)
and the [base selector](https://github.com/Facepunch/garrysmod/blob/master/garrysmod/gamemodes/base/gamemode/player.lua).
