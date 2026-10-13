# Weapon selection

The weapon menu filters the enabled server catalog by display name and family.
Search is case-insensitive, trims surrounding whitespace and combines with the
family filter. Filtering is local and does not send network requests. The search
field survives list updates so typing does not lose the caret. The open menu
captures keyboard input for search; Escape closes it.

After an acknowledged selection, both manual and spawn menus advance to the
first missing nonempty slot in primary, secondary, melee order. Already selected
slots are skipped. Search and family filters reset on slot changes. Both menus
close after the server confirms the last missing choice. Opening a manual menu
with an already complete loadout still allows changing selections. Invalid
choices, throttled requests and preference acknowledgments do not advance it.

## Families

All 154 built-in registrations explicitly declare `Family`. The supported values
are `smg`, `machinegun`, `rifle`, `sniper`, `shotgun`, `pistol`, `revolver`, `melee`, and `other`.
The menu offers only families present in the current slot's enabled catalog.
Secondary weapons have separate pistol and revolver families (29 pistols and
11 revolvers across the supported registrations). The scoped Raging Bull remains
a revolver; the .357 Desert Eagle remains a pistol. Precision weapons include the
HL2 crossbow and the primary-slot Contender. Family affects filtering, never slot
rules, damage, availability or delivery.

M9K classifications follow the author's [Small Arms](https://steamcommunity.com/sharedfiles/filedetails/?id=128093075),
[Assault Rifles](https://steamcommunity.com/sharedfiles/filedetails/?id=128089118),
and [Heavy Weapons](https://steamcommunity.com/sharedfiles/filedetails/?id=128091208)
lists where available. This places Honey Badger/PDR/USC among SMGs, M14 among
rifles, and Remington 7615P among precision weapons. ArcCW variants use their
in-game role, including the AUG Para SMG; its upstream pack is
[ArcCW Counter-Strike+](https://github.com/necoarctic/ArcCW-CS-).

Addon definitions may provide the same optional `Family` field. Unclassified or
invalid addon families fall back to `pistol` for secondary, `melee` for melee,
and `other` for primary. The shared protocol validates incoming family metadata.
Missing family metadata in older version-1 replies uses the same fallback.

## Remembering choices

Save choice is enabled by default, preserving the existing loadout behavior.
The preference belongs to the connected player, like the existing weapon choices;
it is not a disk-backed profile. A bounded version-1 `ZPWeaponMenuRemember` request
contains version (8 bits), request ID (31 bits), and preference (1 bit). The server
rate-limits it and acknowledges with a `preferences` reply and authoritative
snapshot. The control remains disabled while a request is pending. An omitted
`Remember` field in an older snapshot defaults to true.

Disabling this preference leaves current inventory, per-life delivery flags and
current selections intact. `RoundManager.Prepare` clears all three selected weapon
definitions before the next round's spawn. Human loadout then supplies the existing
fallback crowbar, and the normal spawn prompt asks for available missing choices.
Class conversions and respawns within the same round preserve its choices.
Re-enabling the preference retains those choices at subsequent round boundaries.

Lua runtime tests cover filtering in all three themes, retained search controls,
manual and automatic progression, preference validation and round clearing.
Real VGUI focus, scrolling and engine weapon delivery still require GMod testing.
