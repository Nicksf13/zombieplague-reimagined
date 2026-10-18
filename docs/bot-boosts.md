# Cooperative bot boosts

Admins and superadmins can open **F4 > Administration > Bots > Get boost tool** to
equip the temporary `zp_bot_boost_tool` SWEP. It uses the built-in toolgun models
and starts in selection mode, or resumes that admin's unfinished draft. F4 only
equips the weapon; the editor creates no Derma windows. The editor stores up to 32 directed,
three-point maneuvers per map:

- Blue: the supporting bot's crouched position.
- Yellow: the climbing bot's jump point, 40–128 units from the support on the same
  floor (at most 18 units of elevation difference).
- Green: the upper destination, 24–192 units above the base and within 192 units
  horizontally. These editing bounds are not a guarantee that a class can jump
  that far.

All saved boosts have visible markers, directed arrows and numbered labels,
including through map geometry. Selected and hovered boosts are highlighted;
other boosts use quieter markers. Aim at any point and left-click to select the
nearest marker within 28 screen pixels and immediately start editing its draft.
The saved-ID list on the weapon also starts editing and closes its menu after server
confirmation. Selecting the current draft resumes it without overwriting unsaved
changes. Selection alone changes no saved coordinates.

**Right-click** toggles selection/editing directly on the SWEP. With a selected
saved boost it starts editing; during an edit it pauses and resumes that draft
without saving, discarding or opening a menu. **Mouse wheel** cycles the active
role forward/backward while editing, and wraps between all three points. It never
switches weapons while the tool is active, including during selection, a paused
draft or a pending request. While the weapon menu is open, the wheel navigates
actions instead of changing the placement role. Input is not intercepted without
permission or an equipped tool.

**R** opens and closes the menu on the toolgun screen: New, Save, Select a saved
boost, Test, Delete, End editing and Back to tool. Scroll to highlight an action
and left-click to confirm it; right-click returns from the ID list or closes the
main menu. Holding reload toggles only once until released. Escape only closes an
open tool menu and retains its normal game behavior. The HUD mirrors the focused
action, instructions and full feedback for readability on small weapon screens.
All saved IDs fit a scrolling window, with focus retained by ID during polling.
Disabled actions remain visible in the theme's muted color and send no request.
Delete names its target and requires confirmation. New/edit/select/test/delete actions encountering unsaved changes
offer Save, Discard and Cancel. A failed save retains the draft and cancels the
queued action. Both confirmations start on Cancel and stay on the weapon screen.
Right-click, R or Escape cancels the queued choice without altering the draft.
Selecting another ID enters editing once that choice succeeds.

While editing, aim at the floor to see a live colored footprint, body outline
and connections to the other draft points. Left-click places the selected role.
Capture advances to the next missing role after server confirmation. Completing
or adjusting valid points keeps the tool in aiming mode and indicates readiness
to save; the player opens R to save. The support outline
is crouched; the jump-point and destination outlines are standing guides, not
class-specific clearance guarantees.
End editing or changing weapons releases the tool. The SWEP handles prediction
and explicitly forwards callbacks to the client in singleplayer, without global
attack-binding interception.

The toolgun's built-in screen shows the selected boost, selection/editing mode,
all three colored roles with the active role highlighted, placement checks,
unsaved/saved state and pending/error feedback. A single 512×512 render target
and unlit material are reused. Only the viewmodel's screen submaterial is
overridden during its draw; the previous override is restored afterward and on
close. A later addon override is preserved. Native toolgun materials and other
viewmodels are never rewritten. Camera, viewport and clipping state are restored
even if painting fails. The implementation uses the native screen material name
from [Facepunch's toolgun screen](https://github.com/Facepunch/garrysmod/blob/master/garrysmod/gamemodes/sandbox/entities/weapons/gmod_tool/cl_viewscreen.lua).

Full instructions and errors appear near the top right on wide screens, away
from health and round HUD cards. Compact layouts center this panel at the top
to preserve the ammo-pack card at the right. The screen and panel use the active
theme, and every new/changed caption is present in all 32 language catalogs.

The client preview checks surface direction, static surface type, range and
shared distance/height rules. Invalid surfaces or dimensions use a red outline.
The server identifies the affected role and reports actual/allowed measurements,
missing points, floor support, navigation coverage, stale drafts, capacity and
storage failures. Test failures distinguish disabled AI, inactive rounds, freeze,
missing free allies, cooldown/busy state, unreachable approaches, class reach and
body-space obstruction. Messages wrap without splitting UTF-8 characters.
Capture and edit-toggle failures stay in the tool display instead of forcing the
quick menu open, so the player can correct the same point immediately.
Final capture uses the server's eye trace and floor check; clients never submit
trusted coordinates. Only upward-facing
world/static-map surfaces within 4096 units of the editor are accepted. Each
point also needs actual floor support and a nearby nav area on its own floor.
Save before testing. Selecting a saved boost copies it into its own draft;
**New boost** starts a separate draft. Removal cancels an active maneuver at that
point. World markers and labels are visible only while the authorized editor is
open and its tool is equipped. Capture also requires
that the server recognizes the editor's active tool session.

Equipping requires a living, non-bot admin and works for both human and zombie
teams. Authorization is checked on the server for every request and weapon pickup.
The tool cannot damage players and has no ammunition, purchase or ordinary loadout
registration. It grants no special participation or immunity during a live round.
Ending editing removes only this tool and restores the previous
weapon only if it still exists and the tool was active. Existing loadouts are
never recreated. Death and permission loss release the tool; a five-second lease,
renewed by editor polling, also cleans up abandoned sessions. Ending retains the
server-side draft for reopening during the same connection; disconnect clears it.
Saved points remain compatible with existing storage. Requests preserve the packet
layout and operation IDs. The UI selects through edit operation 9; selection-only
operation 12 remains available for compatibility. Snapshots add
validated optional selection/editing/dirty state and a bounded structured issue.
The draft's original revision is retained across polling; concurrent catalog edits
require an explicit discard/reload instead of silently overwriting another admin.

The weapon menu, focused/disabled rows and HUD use the current Classic, HL2,
CS 1.6 or addon palette and geometry. Polling updates outcomes and phases once
per second without resetting the focused action or saved ID. Point labels and feedback use every native language
catalog. No additional fields are added to the existing 16-bot metrics packets.

## Pairing and execution

**Test with bots** chooses two available managed AI bots on the same team near
the selected point. Testing requires an active round, no freeze and enabled AI.
Humans and zombies use the same maneuver with their own physics and same-team
partners. Human players and idle test bots are never moved by this feature.

Automatic attempts are considered when a requested goal has no executable
ordinary route. Navigation must reach the approach from the climber and the
base from the support. The destination must have a complete ordinary route to
the original goal. This is a coordinated intermediate maneuver; native navmesh
connections are not modified. Enemy coordinates still come only from existing
perception and its last-observed-position memory.

One realm-wide `BotBoostManager` owns at most four pairs. A bot participates in
one pair at a time, and same-team pairs reserve their point. Candidate searches
consider at most four nearby points and four nearby partners per point; ordinary
pathfinding retains its existing bounded work. The first candidate's ally
selection favors successful class-pair experience. Retry checks are throttled
and failed attempts impose a fifteen-second point/team cooldown.

The supporting bot approaches the blue point and holds crouch. Once both bots
are positioned and crouching is observed, the climber jumps onto the support.
Within 48 units of the assembly points, precise hull/ground-checked movement
closes the ordinary navigator's 40-unit arrival tolerance. Support must be
within 12 units and the climber within 16 units of its approach before mounting.
Only actual `GetGroundEntity() == support` contact advances to the final jump.
The climber waits for its next jump opportunity, jumps toward the green point
and crouches while airborne. Support remains crouched until completion.

Feasibility uses live hull dimensions, jump power, gravity, speed and a bounded
airborne-crouch height estimate. Floor, standing/ducked occupancy and horizontal
reach are checked before pairing. Local hull traces block real obstructions.
The partner is omitted from prediction traces so its body does not prohibit
the intended mount; engine collision still applies to ordinary player commands.
No collision override, teleport, velocity injection, extra jump power or other
player-stat change is performed.

A fifteen-second deadline bounds the whole attempt. Freeze, team/class/physics
changes, disconnects, disabled AI and observation discontinuities cancel it
neutrally. Loss of support or a wrong-floor landing ends a performed attempt as
a failure. A coordination token also invalidates a partner's stale input plan
immediately when the pair ends.

## Outcomes and storage

Success requires a recorded final jump input, a subsequent airborne phase and
grounded arrival within 32 units of the destination, within 12 units of its
height, off the supporting player. Merely reaching the XY coordinates or
landing on the floor below is insufficient. No pending trial is counted as an
outcome if neither jump input was actually executed.

Points and class-pair outcomes use a separate version-1 JSON file at
`data/zombieplague/bots/boosts/<map-hash>.json`. Existing combat, locomotion and
shelter files remain compatible. Outcomes are keyed by the point coordinates,
map-specific storage, navmesh fingerprint, both roles/classes/variants and both active
physics signatures. Editing a point changes its definition key; old experience
cannot silently become experience for new geometry. Up to 128 outcome records
are retained. A success/failure updates its value 20% toward +1/-1. With
`zp_bot_learning 0`, counters continue while estimate updates stop.

Edits are committed to the live graph only after a verified write. Previous
contents are backed up and verified before replacement. Invalid files are left
unchanged and disable writes for that instance. Failed learning saves retain
pending in-memory changes for the next periodic, round-end or shutdown save.
Messages validate permission, exact request size/version, request IDs, revision,
operation and selected ID. Stale edits require a fresh revision. Snapshot parsing
bounds and copies all arrays, positions, references and counters.

## Validation and engine test

Local tests exercise capture authority, access control, stale revisions,
malformed snapshots, persistence and failed writes, same-team pairing, class
reach, contact/launch/landing phases, wrong-floor failure, neutral cancellation,
input-token invalidation, class/map separation, learning disabled, weapon-screen
menu navigation and confirmations, live aim previews, role cycling, prediction replay,
singleplayer callback forwarding and temporary weapon cleanup. Editor regressions
also cover ordinary admin access, all-point visibility, immediate editing from
both selection paths, wheel isolation from weapon switching, current-draft resume,
save/discard/cancel continuations, named deletion, exact error measurements,
draft recovery after timeouts and concurrent catalog changes. They simulate the
engine; they do not establish
that player-on-player collision and crouch-jump timing work on a real ledge.

In GMod, start with a broad upper platform about 64–80 units above a flat base.
Check toolgun selection and previews in both singleplayer and multiplayer,
including invalid walls/sky/props, changing weapons and opening the R menu.
Check wheel navigation, left-click confirmation, right-click back, holding R,
all saved IDs, disabled actions and both confirmations without any Derma popup.
Create a new draft from the R menu and place the jump point about 64 units from
the support. Leave clearance for two players
and ensure navmesh coverage on both floors. Add two allied AI bots, leave freeze
time, select the saved point and start its test. Observe assembly, mount, final
jump and landing in the editor. Verify actual support contact, midair crouch,
ceiling rejection, combat knockback and cancellation before trying narrow
ledges or more demanding class combinations. Profile the bounded route checks
under the intended bot count before raising limits.
