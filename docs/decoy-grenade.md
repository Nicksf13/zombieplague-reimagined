# Decoy grenade

The human extra-item shop registers `ZPDecoyGrenade` as Decoy grenade, priced at
8 ammo packs. Buying equips `zp_decoy_grenade_thrower`. Primary attack throws one
grenade; a successful server spawn consumes its clip and removes the spent
weapon after the throw animation. Failed throws preserve the grenade. Zombies,
dead players and players outside an active round cannot buy or throw it.

The projectile `zp_decoy_grenade` inherits `zp_grenade_base`. It reuses the base
physics, collision callback and one-shot arming timer in `ARM_ON_HIT_MODE`.
The first impact arms a 0.75-second delay; the overridden `Explode` starts the
decoy rather than an explosion. A three-second fallback arms projectiles in water
or without a collision callback. The native HL2 grenade models require no CS
content or external assets.

For ten seconds after arming, the grenade randomly alternates between single shots
and bursts of up to five shots. Shot spacing varies from 0.12 to 0.28 seconds;
pauses between bursts vary from 0.45 to 1.65 seconds, quantized by the service's
0.1-second tick. Each shot produces a muzzle flash, three short orange glow sprites
and a small fading smoke puff. It creates no bullets, explosion damage or infection effects. The
source remains the physical grenade, including if it continues to roll.

Completing the active duration triggers one small native `Explosion` effect with
its explosion sound at the grenade's final position. This is a client visual/audio
effect, with zero magnitude: no damaging explosion entity or blast-damage call is
created. The grenade and radar contact are removed before the final effect.
Cancellation by death, infection, disconnect, round end or external removal does
not trigger this final explosion.

A successful throw plays a pin-pull sound once on the server. Impacts at speeds
of at least 40 Source units per second play a bounce sound, at most once every
0.15 seconds. Softer contacts still arm the grenade through its base callback.
The standard pin-pull and HE bounce files bundled with GMod are preferred; native
HL2 handling audio is used if those files are unavailable. Client prediction does
not replay the server's handling or impact sounds.

## Weapon sound capture

The server snapshots the current firearm before giving the grenade and refreshes
that snapshot when the player switches from a firearm to the decoy. HL2 firearms
use their native shot sound scripts. Addon compatibility reads `Primary.Sound`,
`ShootSound`, `FireSound` and `Primary.FireSound`, including bounded flat sound
lists and inherited weapon fields. Melee weapons are excluded by their lack of a
primary ammo type. Unsupported weapons fall back to another carried firearm,
then to `Weapon_AR2.Single`.

The selected sound is frozen at throw time. Changing guns afterwards cannot alter
an already deployed decoy. Addons with dynamic sound hooks, attachments or sound
fields outside these conventions may require a specific adapter. Sound playback
uses the engine's [Entity:EmitSound](https://wiki.facepunch.com/gmod/Entity:EmitSound)
API from the grenade entity.

## Radar and lifetime

Each fake shot creates an ordinary hostile attack sample for living zombie
viewers who have radar access. Its range and distance-based expiry use
`zp_radar_shot_range`, `zp_radar_mark_min` and `zp_radar_mark_max`. The sampled
position and height belong to the grenade; the thrower's real position is never
copied into a fake shot. The radar renders a blue human contact with its normal
height marker. Humans do not receive a fake friendly contact, even when allied
identification is enabled. Purchased scans continue to sample real players.

Grenades have their own contact IDs, so a real shot and a decoy can coexist.
Disabling the radar stops false contacts while sound playback continues. Removal
or expiry immediately clears existing contacts and cancels the base arming timer.
Death, infection, disconnect or leaving the active round removes the grenade on
the next 0.1-second service tick; the round-end hook clears all deployed decoys.

One player may hold or deploy one decoy at a time. The server also limits deployed
decoys to 32. These limits apply to server purchases and throw validation.

## In-game verification

Build and install the complete gamemode, including its generated Lua, then restart
the map. As a human in an active round, equip a firearm, buy the decoy from extra
items, and throw it with primary attack. With a zombie player nearby, verify the
shot sounds, grenade physics, muzzle flashes and a blue contact at the grenade's
position. Compare above/below markers across floors and repeat with different
native and addon firearms. Local tests simulate the engine; playback quality,
animation and physical collision still require Garry's Mod.
