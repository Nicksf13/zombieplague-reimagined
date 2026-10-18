# Automatic AI bot population

Superadmins can configure **F4 → Administration → Bots → Add AI bots → Automatic bot filling**.
Enable filling, select the desired occupancy, and save. Occupancy counts real
players and bots together; it is not a fixed number of bots. The default choice,
**Maximum supported**, follows the server slot count while reserving one slot.
Filling is disabled until explicitly enabled and saved.

On a 32-slot server with an occupancy target of 31:

| Real players | Managed AI bots | Available slots |
| --- | --- | --- |
| 0 | 31 | 1 |
| 1 | 30 | 1 |
| 2 | 29 | 1 |

Choosing 30 instead leaves two slots available. The supported target is bounded
by `min(64, game.MaxPlayers() - 1)`, preserving the existing managed AI limit.
Real players connecting but still loading also count toward occupancy. The menu
polls the authoritative counts once per second without replacing its controls.

The population timer runs every 0.25 seconds and creates at most two bots per
tick. A real `PlayerConnect` event can release one managed bot immediately,
before the connecting count updates. Refilling waits at least two seconds after
an admission and one second after a disconnect. Pending asynchronous bot kicks
are tracked to prevent duplicate kicks and replacement before disconnection.
After an aborted connection, native connecting counts allow filling to resume.

Only AI bots attached to this gamemode's bot controller are removed. Existing
manually added managed bots participate in automatic filling. Idle test bots and
bots owned by other systems count toward occupancy but are never removed. Dead
managed bots are removed first, followed by the highest managed identity IDs.
Pending learning is finalized and saved before kicking. Manual AI creation also
respects the reserved slot and connecting clients while filling is enabled.

Disabling filling leaves current bots in the match. Singleplayer and builds with
`BOT_MODE` disabled do not fill. If real players or unmanaged bots alone occupy
all slots, filling cannot create a free slot without removing those occupants;
it never kicks them or bypasses the server's connection rules.

## Persistence and protocol

Settings are global to the server and loaded on subsequent map or server starts
from `data/zombieplague/bots/population.json`:

```json
{ "Version": 1, "Enabled": true, "Target": 0 }
```

`Target: 0` means the maximum supported occupancy. Explicit targets are integers
from 1 to 64, further constrained by current server capacity when saved through
the menu. A revision prevents one admin from silently overwriting another's
changes. Writes are verified before applying settings; the previous valid file
is backed up as `population.json.bak.txt`. Invalid files remain untouched and
disable automatic filling until repaired outside the menu.

`ZPBotPopulationRequest` accepts only superadmins and exact versioned payloads:
40 bits for reads and 79 for saves. Saves include the revision, enabled flag, and
target. Requests are limited to one every 0.25 seconds per real player.
`ZPBotPopulationReply` carries a 119-bit snapshot with current settings and
human, bot, connecting, and free-slot counts. Client drafts survive status polls;
save acknowledgments use the server's verified settings.

## Validation

Local Lua simulations cover startup filling, admissions, concurrent loading,
aborted connections, departures, delayed kicks, permission and revision checks,
capacity limits, persistence failures, manual creation, and themed menu polling.
Engine validation still needs a dedicated multiplayer server with several real
clients, especially for connection timing, bot kick delivery, and visual layout.
