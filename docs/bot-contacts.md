# Allied bot contacts and marked shelter discovery

## Configuration and behavior

`zp_bot_contact_radius` controls how far managed bots share enemy sightings with
same-role allies, in map units. The default is `900`; `0` disables sharing. Values
are clamped to 0–32768 at runtime, with a finite-value fallback to 900. The server
settings editor accepts integer values in that range and applies changes live.
Open **Main menu > Administration > Server settings > Bots** to change the radius;
editing bot settings requires a superadmin. For example, the server console can use:

```text
zp_bot_contact_radius 1400
zp_bot_contact_radius 0
```

Only an actual visual acquisition by a managed bot can create a report. Each bot
publishes at most once per 0.5 seconds for its current target. A report contains a
detached last-observed position, the observation time and the reporter identity.
It expires six seconds after observation. The shared store retains at most 64
reporters. Both humans and zombies report only to their own role.

Range is measured from the listener's current position to the reporter's position
at observation time. Walls do not block this team communication. Reports never
query an unseen enemy's live position, create a firing target, update aim, increase
visible enemy counts or relay through another recipient. Death, infection, leaving
round participation, bot resets and round completion invalidate relevant reports.
Disabling sharing clears buffered reports when the next bot plan reads the setting.

Direct visual memory takes priority. An otherwise unaware zombie investigates a
received position before grouping, hiding-place patrol or wandering, and prefers
running subject to normal traversal restrictions. A new report more than 160 units
from the current shared destination can redirect the investigation. Refreshes can
extend a shared investigation to at most twelve seconds from its start, always
bounded by the current report's expiry. Losing the report also ends that shared
investigation. Arrival, failure and timeout use the existing 25-second regional
inspection fence. A report alone cannot earn combat or place-find rewards.

Humans use received positions to withdraw and avoid compromised shelter choices.
Shared information remains separate from firsthand memory, so it cannot establish
a confirmed escape reward. Actual attacks require the recipient's own visibility,
reaction delay, aim alignment and a fresh line-of-fire check.

Recordings expose a separate `Contact` object with reporter, observation time and
position. Activity exports include `Contact:received` and
`Investigation:contact:started`; these are descriptive events, not learned rewards.

Gunshot and footstep hearing are configured independently with
`zp_bot_hearing_gunshot_radius` (default 1400) and
`zp_bot_hearing_footstep_radius` (default 380). Both accept 0–32768 map units,
with zero disabling the respective category. See [hearing and investigation](bot-objectives.md#hearing-and-investigation)
for supported sound events, wall attenuation and approximate regional clues.

Bots can also [clear destructible route obstructions](bot-breakables.md) through
ordinary weapon input while retaining their destination.

## zm_canals shelter investigation

Read-only inspection found nine authored human destinations in the installed map
data, on elevations around 128, 256, 376, 384 and 436 units. The installed NAV file
contains 297 areas and one ladder. Its version-16 structure was read using the
[Valve NAV serialization implementation](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/server/nav_file.cpp).
These counts describe the inspected local files, not every installation of this map.

Replaying that graph in the local Lua simulator from `(0, -700, 0.03125)` found
complete eleven-step routes to saved points 5 and 6 on the 256-unit floor, while
the old place catalog returned neither destination. The automatic search used a
48-entry visit budget, counted duplicate queued areas, and required marked points
to be encountered during that same local search. Thus an existing ascent route
could never become a shelter objective from that position.

Marked discovery now resolves each destination on its own floor before filling
the bounded catalog with automatic spots. Selection checks the normal class-aware
pathfinder; disconnected routes, unsupported ascents, blocked/underwater areas,
wrong floors and unsafe endpoints are still rejected. Automatic search also
deduplicates area identities when enqueuing them. Existing points, reservations
and saved learning are preserved. The corrected catalog includes points 5 and 6
from the reproduced start; partial routes to other destinations still require
continuation and physical validation.

Local regressions cover long connected ascents, overlapping floors, disconnected
destinations, report range changes, expiry, no relay, lifecycle invalidation,
shared investigation, running and firsthand attack acquisition. The build and
test suite also check server/client types, editor project discovery, server cvar
coverage and all 32 localization catalogs.

No engine match or installation update is established by these simulations. In
GMod, verify actual ascent and ladder attachment, cover suitability under fire,
navigation timing with the intended bot count, and a two-zombie encounter where
only one zombie can initially see the human. Test both radius changes and `0`
during that encounter. The fix addresses confirmed destination discovery; it
does not prove that every elevated marker has a physically usable route.
