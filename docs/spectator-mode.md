# Voluntary spectator mode

F4 offers **Enter spectator mode** to participants and **Return to the match**
to spectators. Visibility follows the player's replicated team and is rechecked
when an option is activated. These controls use the active main-menu theme.

The server handles `zp_spectate` and `zp_join` for the requesting player only.
Both commands reject arguments and invalid callers and share a two-second
per-player cooldown. They require no administrative privileges.

Entering spectator mode removes the player through the existing round manager,
including last-human/last-zombie replacement and round-end checks. The player
is unfrozen, silently killed if alive, disarmed and placed in roaming spectator
mode. Nightvision, flashlight, light and special-role flags are cleared.
Existing spectator controls remain available.

The server-only `ZPVoluntarySpectator` flag prevents automatic participation,
including repeated server-status requests, until an explicit return. Round
preparation only spawns participants, so observers remain outside later rounds.
This choice lasts for the current connection; reconnecting uses normal joining.

Returning registers the player as a human participant. `PlayerCanSpawn` and the
current round's respawn callback decide whether spawning is allowed immediately.
Otherwise the player stays dead until normal respawn or round preparation.
The menu does not grant an extra life during rounds that prohibit respawn.

Runtime simulations cover opt-out, round preparation, invalid/stale requests,
cooldown, frozen players, role replacement, respawn rules and F4 visibility.
Verify roaming/follow camera controls and transitions on a live GMod server.
