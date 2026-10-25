# Bot weapon handling

Human bots choose between firing, reloading, changing existing equipment and
withdrawing, and can choose to buy reserve ammunition through the extra-item shop.
The weapon controller supplies normal player input; it never gives weapons,
ammunition or instant reloads directly. Zombie loadouts retain their existing handling.

## Ammunition and selection

The controller reads the active weapon, inventory, magazine and reserve for each
weapon's primary ammo type. A firearm without a magazine uses its reserve directly.
Registered melee weapons and native crowbars/stunsticks are melee; tools and the
gamemode's grenade throwers are excluded from automatic combat selection.
Registered firearms without a primary ammo type or magazine can fire without ammo.

A loaded firearm stays equipped. An empty firearm with reserve reloads when the
observed threat is farther than 320 units and no damage was recently observed.
A nearby visible threat or recent damage makes a loaded alternative preferable.
If all firearms are empty, a weapon with reserve remains eligible for reloading.
Reload input is pulsed at most once every 0.8 seconds while the magazine is empty.
A firearm with no reserve never receives a reload request.

After switching away from an empty but reloadable firearm, the bot remembers it.
Once pressure ends and the new weapon has been equipped for at least 0.6 seconds,
it can return to reload the original firearm. It does not immediately switch back
while a close enemy or recent damage still makes that unsafe.

A requested selection blocks attacks until `GetActiveWeapon()` confirms it.
Selection requests retry at most every 0.4 seconds. A refusal lasting 1.5 seconds
temporarily excludes that candidate for three seconds so other equipment or a
reload can be tried. Removed equipment cancels pending selection. State is local
to each bot and clears on reset, removal and suppressed combat input.

## Extra-ammo purchase decisions

Only managed, living, unfrozen human bots in active play consider buying
`ZPExtraAmmo`. Its registered server price, enabled state, `CanBuy` restrictions
(including `zp_clip_mode`) and the bot's current ammo-pack balance apply. The bot
uses `ExtraItemsManager:BuyItem`, preserving normal item callbacks, charges and
notifications. It never grants itself ammo or deducts a made-up price.

An empty magazine with reserve only needs a reload. A purchase requires a firearm
whose magazine and reserve are both exhausted, and which the existing extra-ammo
item can refill: a choosable primary/secondary firearm with a positive magazine
size and a valid primary ammo type. Unregistered extra weapons, clipless weapons,
tools and grenades alone cannot justify spending on this item.

When no firearm is usable or reloadable, replenishment is urgent and the bot can
spend its last affordable purchase. With a usable alternative, it keeps fighting
during nearby visible danger or recent damage. Once that pressure ends, it buys
only if enough packs remain for another purchase at the same price. This is a
contextual equipment/economy decision, not a purchase on every empty magazine.

Decisions are checked at most once per second; actual attempts have a ten-second
cooldown. If a purchase reports success without increasing any eligible depleted
weapon's reserve, further attempts against the same item and depleted inventory
are blocked until that inventory changes, ammunition recovers, or the bot resets.
Cooldowns and failure records use player entities, not bots' shared SteamID64.
The new reserve still needs the normal weapon reload, and purchase interventions
are marked separately in execution diagnostics.

## Withdrawal and learning

An empty inventory of loaded firearms causes withdrawal when pressure makes
reloading unsafe, or when no firearm has reserve at all. A known ally can supply
the destination only if it increases distance from the observed threat; otherwise
the bot requests a destination away from that threat. Existing navigation, cover,
traffic and cooperative traversal still determine feasible movement.

With all firearm ammo exhausted, an owned melee weapon is a last resort. Humans
still withdraw rather than pursuing an enemy with melee, and swing only within
the existing reach, aim and line-of-fire checks. Normal ammo pickups restore
firearm/reload eligibility. No enemy position is obtained beyond perception.

These are deterministic equipment rules, independent of `zp_bot_learning`.
Weapon-related overrides are recorded as tactical interventions so forced reloads,
switches and withdrawals do not teach the existing tactical/profile learner that
its original choice was executed. Weapon preference learning is a separate future
step; this change adds no weapon learning records or persistence schema changes.

## Validation

`tests/bot-ammo-purchase.test.mjs` uses the actual item and purchase manager to
validate charging, delivery, affordability, tactical/economy choices, restrictions,
ineffective purchases, cooldowns, bot isolation and normal motor reload input.
`tests/bot-weapons.test.mjs` simulates ammo exhaustion, reserve by ammo type,
safe reloads, urgent switches, actual equip confirmation, failed/removed selections,
returning to reload, clipless/infinite firearms, tool exclusion, withdrawal and
melee reach. Runtime tests also cover integration with the controller and zombie
behavior. Editor project tests open both new server modules.

Local simulations do not validate SWEP deploy/reload timing or a real match.
In Garry's Mod, verify primary-to-secondary switching during an approaching zombie,
safe primary reload after disengagement, retreat with both ammo pools depleted,
and an extra-ammo purchase followed by a normal reload when packs are available.
