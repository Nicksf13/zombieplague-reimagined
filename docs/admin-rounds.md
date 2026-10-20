# Administrator round controls

The administrator menu's **Start round** page lists definitions registered with
`RoundManager:AddRoundType`, including addon modes. Entries follow the definition's
`Order`, with the ID as a tie breaker. Legacy `Name` localization keys are resolved
through the native catalogs; literal addon names are displayed as supplied.

Starting is allowed only while waiting for players, restarting, or preparing a
round. The minimum is the greatest of two players, `zp_min_players`, and the mode's
`MinPlayers`. `ShouldBeEnabled`, when supplied, must allow the mode. `Chance` affects
automatic selection only, so zero-chance modes can still be started manually.
Unavailable entries remain visible and disabled. The open page refreshes every
two seconds and also provides a manual refresh button.

The scoreboard player menu opens with a right click on a row or a left click on
its name. Administrators can select a living human participant as the first zombie,
Nemesis, or Survivor before the round starts. Nemesis and Survivor use the normal
mode setup, including infecting the other participants in Survivor mode. During
an active round, only infection is offered: it changes the selected human into a
normal zombie without incrementing the round number, resetting its timer, or
firing the first-zombie event. Infecting the last human uses the normal end check.

Manual starts from waiting/restarting run the normal preparation once. Starts
during preparation keep player positions. Starting releases freeze time, removes
infection countdown sounds, and replaces the preparation timer with the round
timer. Finishing rounds, map votes, and map changes reject manual starts.

## Network boundary

All permissions, target membership, life state, phase, and mode eligibility are
checked on the server. Scoreboard targets use connection `UserID`, including bots,
instead of entity slots or shared bot Steam IDs. Requests are rate limited per
administrator, and disconnects discard that state.

- `ZPAdminRoundsRequest`: version (8 bits), sequence (16), action (1; list/start),
  followed by the registered mode ID for a start.
- `ZPAdminRoundsReply`: version (8), sequence (16), feedback localization key,
  entry count (16), then ID, name, minimum players (16), and eligibility (boolean)
  for each entry. The client rejects stale replies and malformed catalogs.
- `ZPAdminPlayerRound`: version (8), role (2; zombie/Nemesis/Survivor), UserID (32).

The automated Lua simulations cover selected and random mode setup, permissions,
invalid targets, phase changes, minimums, addons, timers, themed presentation, and
localization. Actual input, rendering, and gameplay still require Garry's Mod.
