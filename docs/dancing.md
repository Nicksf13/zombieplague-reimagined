# Player emotes

## Selection and controls

Hold **G**, point at an emote, and release the key to perform it.
**Settings → Keys → Emotes** changes the binding, including physical Mouse1–Mouse5,
and saves it with the other player preferences. The existing `Dance` preference
ID is preserved. Eight radial slots are shown per page; scrolling cycles between
two pages containing the sixteen native `act` options. The last page is retained
while the client is running. Release over the center or outside the ring, press
Escape, or right-click to cancel. A click on the mouse button that opened the
wheel does not immediately close it. Other actions and weapon scrolling are
suppressed while the wheel owns input.

Run `zp_emotes` to open a click-operated wheel, or `zp_dance` to perform the
original dance directly. A console-issued `zp_emotes` opens after the console
closes. The wheel uses the active theme's palette, rounded
segments for Classic/HL2/addon themes, and faceted segments for CS 1.6. Unsupported
emotes are disabled based on the current model; the server independently checks
availability again. No addon animations or assets are downloaded.

Death, team/model changes, chat, console, the game UI, focused editors, and
ineligible round states cancel selection without submitting a request. Existing
menus keep ownership of their cursor: the wheel does not open over them. Removing
the panel also cancels safely. Selection and cancellation clicks are consumed
until release so they cannot fire a weapon or another configured action.

The player cannot move, attack, or activate a class ability while performing an
emote. Mouse1 ends it early;
otherwise it ends with the model's animation. The cancellation click is consumed
until release. Mouse1 is detected physically, even if its usual attack bind has
been reassigned.

`player/client/cl_dance_camera.ts` provides a third-person orbit camera with hull
collision. The server captures pitch/yaw when accepting the emote and publishes
them before its deadline. That heading locks commands and body orientation;
mouse input only rotates the camera. The first camera input after opening is
discarded to avoid a cursor-warp delta from closing the radial selector.

Entry and exit share one 0.22-second smoothstep interpolation measured with
`SysTime`. Rendering twice at the same time does not advance the blend. Cancelling
during entry reverses from the current distance, and base-animation changes never
reset the camera. The camera waits for the local gesture slot to be initialized,
and hides the local body until it is at least a quarter of the way out. It does
not wait for a gesture to become the main sequence. The offset scales with model
size and collision ignores players, matching the intended Sandbox-style orbit.

During rendering, the body uses the captured yaw with zero pitch/roll.
`PostPlayerDraw` restores its previous render angles, including for remote
players. Both changes invalidate bone caches so a zombie cannot retain matrices
from its previous facing direction. Ending an emote hides the local body while
the camera returns to first person. `CalcView` alone completes the exit even if
`CreateMove` stops running. Death, spectator views, and model changes release it
immediately. The first-person viewmodel stays hidden during the blend.
The gamemode continues to reject unrestricted native
`act` taunts; this feature controls its own animation and state.

## Server authority and animation

`player/server/sv_dance.ts` owns validation, a per-player request cooldown, the
animation deadline, and command suppression. `player/shared/sh_emotes.ts` defines
stable IDs 1–16, native activities, and localization suffixes. `ZPDanceStart`
accepts an 8-bit catalog ID; an empty legacy request still selects dance (ID 1).
Other payload lengths and unknown IDs are ignored. Requests contain no client-selected
sequence, activity, or duration. Living human/zombie players may perform emotes while grounded and
outside vehicles, during waiting, preparation, or active play. Round freezes
and end-of-round/map-change states reject requests.

The server selects the catalog activity from the current model and derives the
duration from that sequence, capped at 30 seconds. Unsupported models receive a
localized notice. Networked activity, sequence, model, pitch/yaw, start time, and
deadline fields identify the animation in both realms, including late observers.

`player/shared/sh_dance.ts` applies the selected sequence once to
`GESTURE_SLOT_CUSTOM` through `AddVCDSequenceToGestureSlot` in both realms. Native
emotes contain weighted spline layers whose transparent frames need the player's
normal idle underneath; forcing these containers into the main sequence exposes
their reference pose. See the native
[gesture macros](https://github.com/robotboy655/gmod-animations/blob/master/macro_gestures.qci).
The base gamemode and weapon always retain their main activity and sequence,
including zombie idle/posture selection. The initial gesture cycle is calculated
from the replicated start time so late observers do not restart the emote.

While an emote is active, `UpdateAnimation` fixes base playback at 1 and neutralizes
aim/movement pose parameters. Bone-cache invalidation runs only in the client's
render hooks; the server does not expose that method. The gesture uses
its native playback and automatically finishes once. The server uses its deadline
to release controls; `GetSequence` and `IsSequenceFinished` describe the main
animation and cannot determine when the gesture finishes. Ending only clears the
owned gesture slot and all seven networked fields; it never resets the main
sequence or clears an unrelated gesture while idle.

The server clears movement, buttons, and impulses and locks the player's command
angles without changing `Player:Freeze`. Death, respawn, disconnect, team/model
changes, invalid movement conditions, and round transitions discard dance state.
This never clears a freeze owned by rounds or addons. Class ability requests
also check the server's dance state.

## Validation

`tests/dance.test.mjs` simulates gesture selection, timing, server controls,
cancellation, invalid requests/models, late observers, lifecycle cleanup, and
preservation of the main sequence. `tests/dance-camera.test.mjs` measures camera
positions/angles during entry, exit, reversal, repeated renders, collision, model
scaling, cursor warps, orientation, and physical Mouse1 behavior. Zombie model
fixtures exercise these contracts without claiming to reproduce their actual
bone animation assets.
`tests/emote-wheel.test.mjs` covers radial hit testing,
both pages, key/mouse release, cancellation, panel cleanup, input ownership,
unsupported entries, all built-in themes, and addon palettes. Binding and localization
suites cover the action and translated emote labels in all 32 catalogs.
Actual animation playback, native camera collision/orbit, and multiplayer event
ordering still require an in-engine check.
