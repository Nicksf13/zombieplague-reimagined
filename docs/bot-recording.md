# Recording bot incidents

Open the administrative menu, choose **Bots → Bot diagnostics**, and start
recording before reproducing an incident. Only superadmins can see and use these
controls. Capture is disabled by default and continues when the menu closes.
When a bot stops unexpectedly, save the recent history. Saving leaves recording
running. Stop recording when finished. Stopping retains the buffer for saving;
starting a new recording clears that buffer. Map changes/server restarts discard
unsaved history. Capture is independent of training and evaluation settings.

The menu displays the retained duration and the path of the last successful
export, relative to the server's `garrysmod` directory. Send that JSON file for
analysis. On a dedicated server it must be retrieved from the server, rather
than the client's data directory. No report is uploaded automatically.

## Evidence and limits

Every 0.5 seconds the server serializes an immutable snapshot containing:

- All players, including unmanaged bots, humans and spectators (up to 128):
  entity/user IDs, team, life state, position, velocity, view angles, grounded,
  frozen and water state, movement attributes, hull, weapon, ammo and melee reach.
- Managed bots: persistent bot ID and scope, policy ID, plan/reaction deadlines,
  next planning time, perceived target and position, destination and immediate
  steering point, navigation status and bounded traversal details, waiting/stuck
  flags, boost and decision/experience IDs.
- Optional `Waypoint` retains the current local navigation target even when
  collision prevents a movement choice. Compare it with the final `Goal` and
  offered `Steering` point when diagnosing traffic direction or alignment.
- Optional `Traffic` describes an active passing reservation: passer/yielder
  entity IDs, readiness, age in seconds, time since either participant last
  moved, and the next parking point. Missing traffic data does not mean no
  player collision occurred; following traffic may simply wait for a leader.
- Optional `BlockedProbe` on a bot with no movement choice identifies a rejected
  forward planning hull segment, with entity/class, world and StartSolid flags.
  It does not capture every motor-side rejection or establish which map geometry
  must change.
- Optional `BlockedSupport` records a rejected precision-planner floor check:
  the short segment (`Start`/`End`), failing `Sample`, traced `Floor`, and
  `Reason` (`missing`, `height`, `slope`, or `player`). Floor coordinates on a
  miss describe the trace result, not a confirmed surface. This field covers
  precision planning, not ordinary ground probes or per-command motor checks.
- The most recently issued bot movement/buttons, command timestamp, command gate,
  attack gate and controller interventions. These are issued input, not proof
  that the engine moved the player or registered a hit. Later addon hooks can
  still change a command after this observer.
- Nearby solid entities, including props and doors: entity ID, class, model,
  position, orientation, local collision bounds, solid type and collision group.
  The collector checks at most 2,048 entities per sample, rotates its scan, and
  retains at most 128 within 512 units of a live managed bot's origin or the
  entity's center. `Obstacles.Limited` marks partial scans. Large objects whose
  origin and center are both outside that radius can be absent.

Static world brushes and compiled static props are not reconstructed from entity
samples; interpreting them requires the same map/assets. Bounds give context,
not a full collision mesh or proof that an entity caused a block. This design
uses the engine's [entity bounds](https://wiki.facepunch.com/gmod/Entity:OBBMins)
and [solid type](https://wiki.facepunch.com/gmod/Entity:GetSolid).

The circular buffer retains at most 600 samples, five minutes, or 8 MiB of
serialized frames, whichever limit is reached first. Each sample is capped at
256 KiB; oversized/failed samples are counted as dropped. Busy servers can retain
less than five minutes. Actual sample timestamps expose pauses in server
execution; capture never invents missing frames. `PlayersOmitted`,
`DroppedFrames` and obstacle limits must be considered when interpreting gaps.

Reports include schema version, map, session, code identifier, save time and
learning/evaluation flags. Entity IDs can be reused; pair player entity and user
IDs and follow persistent bot IDs across samples. Player names and Steam IDs are
not collected. Reports use unique filenames under
`data/zombieplague/bots/diagnostics/recording-*.json`; saving never replaces a
previous report and is limited to once per ten seconds. Files remain until the
server owner removes them. A failed write does not report success or erase the
in-memory history.

## Reading an incident

Find successive samples with little displacement while the bot is alive. Check
`Input.Time` and `PlanAt` before interpreting commands: old input does not imply
that it was repeatedly issued. `Input.Gate` distinguishes expired/missing plans,
frozen players, disabled AI and inactive rounds. Compare `NextThink`, timestamps
and other bots to identify potential planning delays.

Fresh movement input with no displacement suggests a collision or external
movement constraint. Compare the destination, steering point, navigation reason,
other players, obstacles and controller interventions. A waiting flag or traffic
intervention can explain intentional yielding. Neither alone proves a bug.

For a visible opponent without attacks, check `ReadyAt`, aim and `Input.AttackGate`:
reaction wait, aim alignment, line-of-fire blockage, melee envelope, reload and
alternating button presses have separate reasons. An `issued` attack can still
fail inside the weapon or engine. Half-second sampling can miss short commands,
damage events or brief contacts; reproduce in-engine to verify any resulting fix.

The recorder never supplies its all-player or obstacle observations to bot
perception, navigation, policy selection, or reward attribution. It does not
change collision, weapon reach or movement behavior.

## Validation

The build generated 420 Lua 5.1 files and all 768 tests passed. Coverage includes
JSON validity, historical position isolation, recording lifecycle, time/byte
limits, obstacle filtering, failed writes, server permissions and rate limits,
attack gates, client acknowledgments and closed replies, theme rebuilding,
localization in all 32 catalogs, editor projects and client distribution.
`git diff --check` passed. These are local simulations; no GMod session or external
installation update was performed.
