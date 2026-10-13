# Extra items shop

The Extra items option in F4, `zp_extras`, and `/extras` open a themed shop with
only the player's current team's items, localized names, Ammo Pack prices, authoritative balance
and per-item availability. Clicking an enabled card purchases that item. The
shop stays open after acknowledgment, updates the balance and follows the new
team when buying an infection or cure item. There are no team-selection tabs.
The server sends only the current team's catalog; spectators receive an empty
catalog. Client presentations also filter entries by the local player's team,
including mixed catalogs from older replies. A local team change immediately
hides the previous catalog and schedules a fresh request after 300 ms; late
replies from the old team remain hidden. The catalog
refreshes every two seconds while open and idle, including round restrictions.
Reload list also requests a fresh snapshot. Closing or changing themes never
repeats a purchase; a late reply cannot reopen a closed menu.

Classic, HL2 and CS 1.6 use their active palette. Addon themes may implement
`CreateExtraMenu`, or use the default shop with their palette. Opening another
menu closes the shop. Purchase controls are disabled while awaiting a reply;
dead players and spectators cannot buy. Server validation also rejects forged
purchases for the other team. Disabled items show the life, rule or balance restriction.
Unavailable addon items are omitted through `ShouldBeEnabled`.

Version-1 `ZPExtraMenuCatalog` requests contain an 8-bit version and 31-bit request
ID. `ZPExtraMenuBuy` contains version, request ID, team kind and item ID. The
server ignores client price/balance fields and checks the exact registered item,
current team, life state, enabled status and nonnegative integer server price.
The existing `ExtraItemsManager.BuyItem` checks `CanBuy` and current balance,
delivers the item, registers cleanup, plays purchase audio, deducts Ammo Packs
and sends the existing localized notification. It now additionally returns a
purchase result; existing callers can continue ignoring the return value.
Special-role restrictions remain those of each item's `CanBuy` implementation.

`ZPExtraMenuReply` returns a result and refreshed snapshot, except for rate-limit
replies. Requests are rate-limited to one every 250 ms per connected player.
The last 16 purchase receipts acknowledge retries without delivering or charging
again. A monotonic purchase ID prevents replay even after receipt eviction.
Disconnect clears the session. Catalogs contain at most 128 entries, stay within
a conservative 48,000-byte budget and report truncation. Both realms validate
wire types, strings, prices, balance, IDs and availability enums. Client timeouts
never retry purchases automatically; refreshing a catalog only reads state.

Lua simulation tests cover prices, balances, team/life/rule checks, unavailable
addons, malformed requests, duplicate and old purchases, conversion items,
cleanup/audio, menu transitions, themes, timeouts and catalog bounds. The full
suite also checks editor project discovery and all 32 native catalogs. Real
VGUI interaction, item effects, weapon delivery and persistence during gameplay
still require Garry's Mod validation.
