# Radar

The radar is available to humans and zombies. The server decides who has access,
which contacts may be revealed, and when those samples expire. Clients draw their
own position locally. Hostile positions remain attack or scan snapshots; allied
positions update periodically while allied identification is enabled.

## Activation and purchases

Open the administration menu, then Settings, Radar. The radar
availability field changes `zp_radar_mode` immediately:

| Value | Basic radar | Extra item |
| --- | --- | --- |
| `0` | Disabled | Hidden and unavailable |
| `1` | Requires purchase | Grants basic access and starts a scan |
| `2` (default) | Available to everyone | Starts a scan |

Both shops register the `ZPRadar` item. Disabled registrations stay discoverable
so changing the mode does not require a map reload. Purchases are validated and
charged on the server. In mode 1, basic access survives scan expiry, but ends on
death, spawn, team change, round end, disconnect, or a radar mode change. Another
scan may be purchased after the previous one ends. Purchases cannot stack.

The personal Settings menu offers Show radar (`zp_radar_show`, saved locally).
This only controls drawing; hiding the HUD does not pause a purchased scan.
Spectators do not receive radar contacts or scans.

`zp_radar_allies` defaults to `1` and displays perceived allies without requiring
an attack or purchased scan. Set it to `0` to hide those contacts. The toggle is
available in the administration menu under Settings, Radar, and applies immediately
without cancelling purchases or hostile samples. Allies are sampled every 0.5
seconds across the map, independently of attack and scan ranges. Their samples
expire after 1.5 seconds if updates stop. They require the viewer's normal radar
access and an active round; dead players, spectators and the viewer are excluded.

## Attack samples and scanning

Actual server bullet callbacks reveal a shooter's sampled position to enemies
with radar access in range. Zombie fists emit a server event on each real swing,
including misses. Holding attack during weapon cooldown does not emit a sample.
Players perceived as allies, dead players and inactive rounds produce no attack
contacts.

Attack duration interpolates linearly from the nearby duration to the distant
duration over the relevant detection radius. Distance includes height. Each
viewer gets an independently timed sample. Silent movement does not update it;
another attack replaces it. Markers fade over their remaining lifetime.
Simultaneous attacks are batched by a 0.1-second service tick, with at most one
attack snapshot per viewer per tick.

Purchased scans take server position samples at regular intervals, including
silent enemies within their radius. Only the buyer receives those samples.
Contacts use the perceived team's standard color: humans are blue (`HUMANS_COLOR`)
and zombies are red (`ZOMBIES_COLOR`), regardless of their relationship to the
viewer. Camouflage uses the imitated team's color. Hostile contacts fade with
sample age. The HUD shows the remaining scan time and a visual
sweep. A scan sample expires at the next pulse or scan
end, so the final pulse cannot extend the purchased duration. Existing scan
samples retain their source when a detected enemy attacks between pulses.

Detection uses distance, without wall occlusion or sound propagation simulation.
Addon firearms that use the engine's bullet callbacks work automatically. Native
crossbow bolts, RPG missiles, AR2 grenades and combine balls are also detected.
Other projectile-only addon weapons can emit
`hook.Run("ZPRadarGunshot", owner)` on the server after a real shot, passing the
weapon owner's player. Custom zombie melee weapons can emit `ZPRadarMelee`.

The human [decoy grenade](decoy-grenade.md) emits false attack samples at the
grenade's position. These use the same range, distance decay, floor markers and
human team color as gunshot contacts, with a separate ID from the thrower.

While either Camouflage class ability is active, the radar perceives that player
as belonging to the opposite team. Allied identification, attack samples and
purchased scans all use this perceived team: actual enemies see a friendly contact
when allied identification is enabled, while actual allies need an attack or scan
to detect a hostile contact. The player's own radar, purchases and actual gameplay
team remain unchanged. Self-detection is always excluded.

Activating, expiring or cancelling camouflage removes that player's previous
contacts from every radar. A new attack or scheduled scan pulse is required to
create another hostile sample; friendly contacts resume at the next allied update.
Death, spawn, team change, round end and disconnect clear
the disguise; changing radar availability preserves an active disguise. The
classes emit the server hook `ZPCamouflageChanged(player, active)`, and the radar
also handles the existing per-player ability reset event.

| Cvar | Default | Unit / behavior |
| --- | --- | --- |
| `zp_radar_allies` | `1` | Show perceived allies; `0` hides them immediately |
| `zp_radar_shot_range` | `2500` | Gunshot radius, Source units |
| `zp_radar_melee_range` | `350` | Zombie swing radius, Source units |
| `zp_radar_mark_min` | `0.4` | Distant marker duration, seconds |
| `zp_radar_mark_max` | `3` | Nearby marker duration, seconds |
| `zp_radar_scan_duration` | `10` | Purchased scan duration, seconds |
| `zp_radar_scan_interval` | `1` | Time between position samples, seconds |
| `zp_radar_scan_range` | `3000` | Scan radius, Source units |
| `zp_radar_price` | `10` | Ammo packs, identical for both shops |

Changes apply to subsequent detections/pulses; scan duration is fixed at purchase.
Changing the mode clears all purchases, scans and contacts. Reversed minimum and
maximum marker durations are sorted so distance still shortens the marker.
Network input is bounded and validated; no client message can reveal a position
or grant a purchase. A missing client material prevents charging for the item.

## Map overviews

Use the [in-game overview generator](radar-overview-generation.md) to render map
textures and height layers through Garry's Mod: `zp_radar_generate` uses
`cl_leveloverview` and native rendering. Then package the printed export folder
with `scripts/install-radar-overview.mjs`, deploy the resulting content, and reload
the map. The radar does not load images directly from the export directory.
A map needs an installed overview or a valid native overview before its radar
becomes available.

Layer selection uses the player's feet height, with a 16-unit hysteresis margin
around each boundary. Ordinary jumps keep the previous layer until landing.
Stairs, ladders, swimming and noclip can change it as height changes. Heights
outside configured layers fall back to the full overview. Single-image maps
continue to use the original behavior without a floor label.

The HUD displays the selected level and total layer count. All contacts use a dot
on the displayed floor, a downward triangle below it, and an upward triangle above
it. Layer boundaries retain the 16-unit height tolerance. Without a configured
layer, contacts more than 64 units above or below the viewer use triangles.
Hostile shapes use only the height saved at the attack or scan pulse, preserving
sample expiry and preventing silent movement from updating a marker's floor
information. Allied shapes use the most recent periodic sample.

The server tries these sources in order:

1. `data/zombieplague/radar/<map>.json` (local override).
2. `resource/zombieplague/radar/<map>.json` (shipped content).
3. `scripts/overviews/<map>.txt`, then `resource/overviews/<map>.txt` (native KeyValues).

Custom JSON uses this contract:

```json
{
  "Material": "zombieplague/radar/example.png",
  "X": -4096,
  "Y": 4096,
  "Scale": 8,
  "Size": 1024,
  "Layers": [
    { "Material": "zombieplague/radar/example_lower.png", "MinZ": -1000000, "MaxZ": 128 },
    { "Material": "zombieplague/radar/example_upper.png", "MinZ": 128, "MaxZ": 1000000 }
  ]
}
```

`X`/`Y` are the upper-left world coordinates. `Scale` is world units per texture
pixel and `Size` is the square image resolution. World +X points right and +Y
points up. PNG/JPG paths are relative to `materials/`; VMT names omit `.vmt`.
The server distributes the selected material with `resource.AddFile` and sends
validated metadata to clients. Without a valid material/configuration, the radar
and extra item stay unavailable for that map. Invalid overrides fail closed.

`Layers` is optional. Up to 64 layers may be registered, each with a material and
a non-overlapping `[MinZ, MaxZ)` feet-height range. They share the full overview's
alignment, scale and square resolution, and are sorted from low to high. Gaps are
allowed and use the full overview. Every configured layer image must exist on the
server and load on the client before a radar purchase is enabled. The server
distributes the complete stack together. No new cvar is required for floor changes.

Native files use `material`, `pos_x`, `pos_y` and `scale` with a 1024-pixel square.
Presentation options such as native zoom/rotation and multi-floor sections are
not applied. Images must follow the world alignment described above.

The older `scripts/generate-radar-overview.mjs` remains a separate offline
schematic utility. Its `scripts/radar/maps/<map>.json` recipes are not inputs to
the in-game generator. Running the legacy script writes the same destination
files and can replace an installed native capture. Use the in-game generator and
installer for textured overviews. Check actual marker alignment and room visibility
in GMod before distributing generated content.
