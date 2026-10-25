# Authored safe points

Admins can open **F4 > Administration > Bots > Tools > Equip safe point tool**
to equip the dedicated `zp_bot_safe_tool` toolgun. Its action choices open on
the weapon screen after the server acknowledges equipment. Select Humans,
Zombies, or both to start marking. The boost tool remains a separate weapon.

- Left click marks the floor under the crosshair, using the chosen team scope.
- Aim at a saved marker and right click to open its contextual actions directly
  on the weapon. **Remove point #ID** is already focused; left click removes it
  and returns to placement. There is no separate selection step or second
  confirmation. Picking uses a 28-pixel crosshair tolerance around the floor
  sphere and vertical stem. Right click, R or Escape dismisses these actions.
- The mouse wheel changes team scope while marking, or navigates weapon options.
- R also opens the aimed point's contextual actions, or the general options when
  no point is under the crosshair. The general options offer marking the
  administrator's own position, returning to aim placement, removing the selected
  point, and ending editing. A contextual target remains fixed while the camera
  moves; opening actions again picks the new crosshair target.

All saved points have world markers, IDs, localized team labels and live distances
while the tool is active. Saved markers are visible through geometry; points
behind the camera have no screen label. Selection and crosshair hover highlight
the marker. A separate placement preview follows the floor under the crosshair;
the server still performs final validation. The weapon screen and HUD use the
active theme, including addon palettes. The editor creates no Derma window.

These points are shelter suggestions, not commands to camp or guarantees of
safety. Humans consider them while seeking cover; zombies can use them as cover
or investigation destinations between pursuits. The existing shelter policy
controls choice probability, holding duration, danger responses and learning.
Combat can take priority. No enemy locations are revealed by marking a point.

## Placement and use

The server captures the administrator's actual position or eye trace. Clients
never submit coordinates. A living administrator must point at stable world
geometry or a static prop, within 4096 units of their eyes. Placement requires a
floor normal of at least 0.7, a containing navigation area within 24 vertical
units, and room for the administrator's standing or crouching hull. Blocked and
underwater navigation areas are rejected. Points must be at least 32 units apart.

The catalog adds matching-role points to its existing bounded search of nearby
connected navigation areas. Authored candidates receive a preference and may
qualify without native hiding flags or two nearby walls. Each bot still checks
its own hull, floor, usable exit, class traversal limits and known threats.
Final path feasibility remains the navigator's responsibility. Missing or
poorly connected navmesh still needs repair. These are destination hints and do
not create navigation links or teach a jump.

Same-role reservations spread bots across destinations. A deleted point ends
an ongoing visit without awarding a fake failure. Existing learning uses a
separate `safe:<id>:<coordinates>` identity; deleting and adding never reuses an ID.

## Persistence and protocol

Each map stores at most 32 points in
`data/zombieplague/bots/safe-points/<SHA256(map)>.json`. The versioned file records
the map, next ID, roles and coordinates. Files are validated before use. Invalid
files are preserved and editing is refused, with an English console diagnostic.
Writes verify a staging file and retain the previous successful contents in
`.bak.txt` before replacing the active JSON. Failed writes do not publish a new
in-memory list or revision. The backup can be restored manually after a disk
failure; there is no automatic fallback that silently overwrites an invalid file.

The server checks administrator permissions, packet length, protocol version,
rate limits, an active temporary tool lease and edit revisions. A conflicting edit returns the latest list for
review rather than applying an obsolete change. Replies are request-correlated
and validated; late replies after switching weapons, permission loss or closure are
ignored. Polling only runs during an editing session. Timed-out mutations
are never replayed automatically; status polling reconciles the list.
An explicit removal during a pending status request waits for that reply while
retaining its original point ID and edit revision. It cannot be replaced by
another click or silently rebased over somebody else's edit. A remotely removed
target closes its contextual actions instead of selecting a replacement.

Closing, death, permission loss or five seconds without a heartbeat releases
the server's temporary weapon. The previous weapon is restored when applicable.
Equipment acknowledgments allow asynchronous weapon selection, but placement
and deletion always require the server's actual active tool. The screen material
override is restored after each viewmodel draw, close and reload.

Local regressions cover storage, validation, permissions, stale edits, geometry,
role filtering, danger rejection, contextual removal, cancellation, tool cleanup,
world markers, input debouncing and themed weapon screen lifecycle. Actual
movement, rendering and destination quality require validation in Garry's Mod.
