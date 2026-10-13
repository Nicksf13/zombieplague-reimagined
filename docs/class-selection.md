# Class selection

The Classes option in the F4 menu, `zp_classes`, and `/classes` open the human
and zombie selector. Classes appear as a scrollable list of cards, like weapons.
Clicking a card selects that class; the menu closes only after a successful
server acknowledgment. Each card has a separate down/up arrow that expands or
collapses its description and characteristics without selecting or sending a
network request. Multiple cards can stay expanded for comparison. Expansion
resizes existing rows and preserves the scroll panel rather than rebuilding it.

Details show health, armor, walking/running speeds, crouch speed multiplier,
gravity, jump power, damage multiplier, battery, oxygen, model scale, footstep
and fall-damage flags, and ability power/cost/activation consumption. These are
class attributes; server-wide rules may override footstep and fall-damage flags.
Classic, HL2, CS 1.6 and addon themes use the active palette. Addons may provide
`CreateClassMenu`; otherwise the default presentation uses their palette.

The first ordinary human conversion and first ordinary infection prompt for the
corresponding class. Prompts run after conversion, rechecking alive/team/special
role state. Bots, Nemesis and Survivors do not receive automatic prompts. Human
class selection precedes the missing-weapon prompt. Escape closes the menu; an
unconfirmed choice is requested again on the next conversion or spawn.

The first explicit choice applies to the current life when the player is alive
on that team and has no special role. It preserves the remaining health and
human armor fractions, human inventory, and spent breath. It updates physical
attributes, model, ability state and zombie class equipment without replaying
infection or loadout. Later changes, choices for the other team, and choices
made while dead or in a special role use the existing `SetNextHumanClass` and
`SetNextZombieClass` paths. They apply at the next corresponding conversion or
spawn. The most recent choice remains across rounds in the current connection;
there is no disk-backed profile. Disconnecting clears the selection session.

Version-1 requests use `ZPClassMenuCatalog` (8-bit version and 31-bit request ID)
and `ZPClassMenuSelect` (version, request ID, team kind and class ID). Replies use
`ZPClassMenuReply`; `ZPClassMenuMissing` carries the team kind, while
`ZPClassMenuOpen` requests a manual menu. Catalogs contain at most 64 definitions,
bounded strings and scalar attributes with a conservative 48,000-byte budget,
without model paths, callbacks or class instances. Both realms validate wire data.
The server rate-limits requests,
requires exact enabled registry matches and retains the last 16 receipts to
make retries idempotent. Invalid IDs never use the class manager's random fallback.

Lua runtime tests cover first choices, deferred choices, equipment, health and
armor preservation, team/role gates, network rejection, expansion and selection,
themes and menu transitions. Editor project discovery, all native catalogs and
the complete test suite are checked locally. Actual VGUI focus, popup cleanup,
scrolling, model changes and gameplay require validation in Garry's Mod.
