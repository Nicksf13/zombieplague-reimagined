# Clearing destructible route obstructions

Bots can attack a nearby destructible wall or prop that blocks their current
navigation step. Previously the navigator only issued use input for doors;
other obstructions went through ordinary avoidance and recovery.

The navigator supplies an entity hit by its obstruction hull trace. `BotBreaker`
accepts `func_breakable`, `func_breakable_surf`, `prop_physics`,
`prop_physics_multiplayer` and `prop_dynamic` only when they have positive finite
health and `m_takedamage == 2`. Unbreakable-glass brush material is excluded.
The [engine breakable implementation](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/server/func_break.cpp)
uses that damage field to distinguish ordinary damage from trigger-only objects.
The field is read through [Entity:GetInternalVariable](https://wiki.facepunch.com/gmod/Entity:GetInternalVariable).
Unsupported addon entities and surfaces without positive health remain ordinary
obstacles. This behavior does not make solid world geometry destructible.

Only an exposed surface within 96 units of the bot's eyes qualifies. The surface
and intervening collision are checked again for every command, so a teammate
stepping into the line suppresses attacks. Visible enemy combat, recent incoming
damage, water, airborne traversal, cooperative boosts and traffic control take
priority. Frozen, disabled and inactive-round command gates still apply.

Zombies use their equipped melee weapon and approach only to its validated reach,
with slow movement subject to the existing collision and ground-support checks.
Humans use their normal equipped weapon, switching/reloading and ammunition gates.
Normal aim alignment, acquisition delay and alternating primary-attack presses
remain active. The bot never removes the entity, invokes its break input, changes
its health, grants ammunition or deals damage directly. The weapon and engine
decide whether an attack actually damages or destroys it.

Actual health reduction renews a four-second progress deadline. Four seconds
without damage, or twenty seconds total, abandon the attempt and impose a
twenty-second entity retry fence (at most sixteen retained exclusions per bot).
This bounds attempts against damage filters or unsuitable weapons. Lifecycle
resets discard temporary attempts and exclusions. A destroyed or cleared obstacle
ends the action on the next plan and ordinary navigation resumes.

The destination remains unchanged, including an active shelter visit. Temporary
breaking explicitly substitutes motion/tactical execution, cancels pending movement
credit, and does not count as a combat success or a learned movement outcome.
Recordings include the current `Breakable` entity index; activity exports include
`Breakable:started`. Both are diagnostics rather than rewards.

Local Lua simulations cover detection, native attack input, actual melee reach,
human reload handling, indestructible/trigger-only objects, aim/reaction, friendly
blocking, progress timeouts, shelter preservation and resuming after destruction.
In GMod, verify actual breakable materials, damage filters, weapon animations,
near-surface collision and team traffic on the target maps. The NavMesh still
needs a usable connection through the passage; breaking does not create one.
