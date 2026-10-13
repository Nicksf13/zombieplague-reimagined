# Map environment

By default, Zombie Plague disables sounds from `ambient_generic` and all three
`env_soundscape` variants, replaces the sky with `sky_borealis01`, hides the sun
disc (`env_sun`), and darkens overall lighting. The configuration belongs to the
server and applies to all players, including those joining after the map starts.
The BSP file and its assets remain intact.

## In-game administration

Administrators can open **F4 → Administration → Server settings → Server weather and time**
to edit these six server convars. Controls load the current server values rather
than client defaults. **Save changes** validates and saves the entire form;
lighting, skybox, brightness, exposure, and cycle changes then apply during play.
The cycle still takes priority over fixed night mode while enabled.
The section controls sky and lighting; it does not add rain or other weather effects.

Map audio changes require reloading the map to take full effect. When the saved
audio setting differs from its value at map startup, the menu marks a reload as
pending. **Restart map now** becomes available only after the server acknowledges
a save that requires a reload, with no unsaved edits remaining. Reading settings
alone never enables this action. Reloading the form clears its restart authorization;
another changed configuration must be saved before restarting from this menu.
Its confirmation warns that the current map will restart for everyone and the
current match will be interrupted. Cancel leaves the map running. Confirm reloads
the same map with `changelevel`; it does not restart the server process.
If the restart authorization expires, reload the form, review the values, and
save a changed configuration before trying again.

Every request is checked for administrator privileges on the server. Only the
six listed convars can be changed; malformed values, excessive requests, and
saves based on an outdated configuration are rejected without partial writes.
**Save changes** is enabled only when the form differs from the loaded values;
reverting an edit disables it again. Equivalent numeric formatting does not count
as a change. Disabled action buttons use muted text.
**Reload settings** reads the current server values and discards unsaved edits
without restarting the map. Its tooltip explains this behavior. In the weapon
menu, **Reload list** fetches the available weapons and saved selection without
changing that selection; it also has an explanatory tooltip.
The restart confirmation is a modal using the active theme's palette and corner
style, with explicit cancel and restart buttons. Closing the menu or changing the
theme dismisses it without restarting the map.
On a save error, reload and review the values before retrying.
Archived convars retain their existing persistence behavior;
map configuration files and `server.cfg` can override them when the map loads.
Menu and protocol tests simulate GMod; layout, focus, and the actual map reload
still require verification in the engine.

## Console and startup options

All six options also appear on Garry's Mod's **Start New Game** screen, under
Zombie Plague settings, in both singleplayer and multiplayer. Select the gamemode
before configuring it. Custom skybox, night brightness, and nighttime ambient
brightness are text fields grouped at the beginning of the gamemode options.
The native menu groups controls by type: using `Numeric` for ambient brightness
placed it below the other two fields, alongside round limits and timers.
Brightness values remain numeric and are validated on the server;
to test a darker environment, enable night mode, set night brightness to `b`,
and reduce nighttime ambient brightness from `100` to `10`.
Restart GMod after updating `zombieplague.txt` to reload this list.

You can also configure these options in the server console or in `garrysmod/cfg/server.cfg`:

```cfg
zp_map_mute_ambient 1
zp_map_night 1
zp_map_skybox ""
zp_map_night_brightness "c"
zp_map_night_exposure 100
zp_map_day_cycle 0
```

| Convar | Behavior |
| --- | --- |
| `zp_map_mute_ambient` | `1` silences the map's ambient entities; `0` keeps the original audio. |
| `zp_map_night` | `1` darkens the map and hides the sun; `0` keeps the original lighting. |
| `zp_map_skybox` | Name of a skybox installed on clients. An empty value uses `sky_borealis01` with night mode enabled or keeps the original sky with night mode disabled. |
| `zp_map_night_brightness` | A letter from `b` (darkest) to `m` (normal brightness). Defaults to `c`; invalid values fall back to `c`. |
| `zp_map_night_exposure` | Additional ambient brightness percentage for supported materials, from `0` (no ambient brightness) to `100` (default). Values outside the range are clamped, and invalid text falls back to `100`. |
| `zp_map_day_cycle` | `1` enables a 24-hour cycle based on the server's local clock; `0` (default) uses the fixed mode defined by `zp_map_night`. |

The cycle is optional and appears as **Day/night cycle by server clock** on the
server creation screen, including in singleplayer. Restart GMod after updating
`zombieplague.txt` for the new checkbox to appear. It can also be enabled during
a game with `zp_map_day_cycle 1` in the server console.
It takes priority over `zp_map_night` while active; disabling it restores
the fixed mode and its values without overwriting existing settings.

Time comes from `os.date("*t")` on the server, using the operating system's
time zone on the machine hosting the game, including dedicated servers.
One real hour equals one hour of the cycle. Players' clocks and time zones
have no effect. Brightness follows a squared cosine curve between the
configured nighttime minimum and the map's original brightness:

| Server time | Brightness |
| --- | --- |
| 00:00 | Minimum defined by night brightness and exposure |
| 06:00 / 18:00 | Minimum plus 25% of the difference to the maximum |
| 19:23 | Minimum plus approximately 10% of the difference to the maximum |
| 12:00 | Original map brightness |

To reach zero ambient brightness at midnight, set night exposure to `0`;
this does not prevent the flashlight and night vision from lighting their area.
The server checks the clock every 30 seconds and synchronizes the multiplier
for materials, players, and first-person hands/weapons. The engine's light style
also follows the cycle, in 12 bands from `b` to `m`. When the band changes,
clients rebuild lightmaps and prop lighting; between these changes, only the
continuous multiplier is updated. This prevents static objects from retaining
the daytime style and avoids rebuilding caches on every 30-second check.
Time is checked again for late joiners, including after an empty server resumes
from hibernation, and round cleanup reapplies the current state.

With no custom skybox and the cycle enabled, the procedural `painted` sky remains
active throughout the 24 hours. Colors follow the sun's elevation: blue during
the day, warm tones near the horizon, and very dark blue at night, when stars
become visible. Colors, dusk intensity, and star visibility are updated every
second, without abruptly switching textures at 06:00/18:00.
Setting a custom skybox keeps the chosen texture even with the cycle enabled.
When leaving procedural mode, the original `env_skypaint` parameters are restored.
The sun moves during the game: every second, the server updates `env_sun`'s
normalized `m_vDirection`. Its arc crosses the horizon at +X at 06:00,
the zenith at 12:00, and the horizon at −X at 18:00; at night, it stays below
the horizon and is hidden. This requires neither a map change nor the client clock.
This is a simplified orbit without latitude or seasons. The procedural sky
follows the sun's direction and avoids a second stationary sun painted into the texture.
If `env_sun` or `env_skypaint` is missing, the controller creates the required
entities after `InitPostEntity` and recreates them after cleanup. Disabling the
cycle restores the original directions and removes only entities it created.
The custom skybox takes priority at all times; any sun discs baked into its
texture remain fixed. Shadows and light directions baked into the BSP do not
move with the sun: the cycle adjusts their intensity without recalculating
the map's directional lighting.

The convars are archived. Brightness can be adjusted during a game with
`zp_map_night_brightness "b"` in the server console: lighting is updated for
connected players without reloading the map, as long as night mode is enabled.
Rapid edits are batched before updating lights.
The change combines the engine's light style with reduced `$color2` and
`$envmaptint` on world materials using `LightmappedGeneric` or
`WorldVertexTransition` (including their `_DX9` variants). These shaders render
the projected flashlight in a separate additive pass, without the base pass's
color modulation. This allows the environment to darken without multiplying
the final image that already contains the flashlight. Compatibility with this
separation in GMod still needs confirmation in the engine, especially on `gm_construct`.

Materials are collected both from the world model's list and directly from its
BSP surfaces, without applying changes twice. The supplementary catalog reads
texture and entity references from the BSP: it includes overlays, decals, and
the world's `detailmaterial`. On `gm_construct`, grass uses
`detail/detailsprites` with the `UnlitGeneric` shader; graffiti uses separate
`LightmappedGeneric` materials outside the surface list. Darkening includes
`UnlitGeneric` and its `_DX9` variant when they appear in this catalog, while
preserving sky materials. The reader accepts only the two required lumps,
uncompressed, with bounded sizes and offsets within the file. If the BSP is
missing or this data is incompatible, surface collection continues.
No map data is written. `$color2` stores the material tint;
`$color` remains available for engine modulation. After changing tint and
reflections, `IMaterial:Recompute` rebuilds the rendering state cached by the
shader. Changing only the vectors, as in the previous implementation that
remained bright during the user's test, does not guarantee this update.
The catalog also reads the BSP's static model dictionary (`sprp`) and resolves
its materials once with `util.GetModelMeshes`. This covers distant facades using
`UnlitGeneric` that are absent from the wall texture table, such as the city
backdrop cards on `gm_construct`. The same shader filters still apply;
`VertexLitGeneric` and its DX9 variant also receive modulation when the material
belongs to a distant scenery static model in the BSP (a name containing `_skybox`
or the `props_buildings` folder), since its baked lighting may ignore model
lighting suppression. Player materials outside this catalog and the 2D sky
are not tinted by this collection. Modulating prop materials may also reduce
their response to the flashlight; it is not equivalent to `LightmappedGeneric`'s
separate pass. Materials shared with other models receive the same modulation.
Compressed lumps remain unsupported, and dictionary reads are bounded by the file size.

The `worldspawn` is identified with `IsWorld()`, since `IsValid(game.GetWorld())`
returns `false` in GMod. The old check stopped collection before finding any
materials, even when the configuration had been received correctly.
The test now reproduces this behavior and waits when the world is still `NULL`
or missing during loading.

With exposure at `100`, `b` applies a 25% multiplier to material parameters,
`c` approximately 32%, and `m` preserves their original values. Exposure
multiplies this result: `10` leaves one tenth of those values, and `0` zeros
ambient modulation on supported materials. This does not mean every pixel
in the scene becomes black: the flashlight, emissive materials, water, and
other shaders may remain visible. Night vision keeps this multiplier:
enabling it does not restore the map's daytime appearance.

Players and other models receive manual ambient lighting during the opaque
and translucent passes: `render.SuppressEngineLighting` disables lighting
calculated by the engine, and `render.ResetModelLighting` applies the server's
multiplier to all six ambient lighting faces. This replaces the models'
daytime lighting without darkening their textures with `$color2`. The intent
is to preserve the projected flashlight pass; the actual appearance still
requires testing in GMod. Manual lighting also replaces contributions from
the engine's local lights, so it does not reproduce the models' original
shadows and light sources.
The state is restored after each pass, before the HUD, at the end of the frame,
on Lua refresh, and on map shutdown. Depth passes do not receive this override;
night vision keeps models darkened.

Local hands and the first-person weapon follow the same server multiplier.
Since they are drawn after the environment, the controller also applies
lighting in `PreDrawViewModels`, `PreDrawViewModel`, and `PreDrawPlayerHands`.
The state remains until `PreDrawEffects`, called after the complete viewmodel
pass, including attachments drawn by the SWEP. Restoration before the HUD
and at the end of the frame remains as protection if this pass is interrupted.
Hand and weapon materials are not tinted; flashlights and night vision
continue to use projected lighting. Addon weapons that impose their own
lighting may require integration.

Night vision uses a single local `ProjectedTexture`, oriented by the shoot
position and eye angles. Its cone is 120 degrees, with a range of 750 units
and brightness of 0.6, retaining the class color (green, red, or blue).
It illuminates through the projected pass without depending on ambient tint,
which may be zero. The old night vision `DynamicLight` was removed because
it depended on restoring materials across the entire map to work in that case.
Special class lights continue to use their existing path.
The light is reused while active and removed when night vision is disabled,
the local player becomes invalid, Lua is refreshed, or the map shuts down.
Projection shadows are disabled to avoid occupying flashlight shadow slots;
the light may illuminate objects behind obstacles within the cone. Its range,
brightness, and interaction with the flashlight still need visual evaluation in GMod.

The administrator controls exposure for all players, including late joiners.
The value appears on the server creation screen and can also be changed during
a game with `zp_map_night_exposure 10`, without rebuilding lightmaps.
Use `100` to return to the default night intensity. Light style `a` remains
blocked: it has issues with `DynamicLight` on the world; the controller keeps
the range compatible with these lights.

Enabling or disabling `zp_map_night` also updates lighting during the game;
disabling it resets the light style to `m` and restores materials.
**Reload the map to restore sounds**, since sounds are suppressed while
entities load. To restore the original environment, use `zp_map_mute_ambient 0`,
`zp_map_day_cycle 0`, `zp_map_night 0`, and `zp_map_skybox ""`, then reload the map.
Cleanup between rounds reapplies the configured environment.

Muting `ambient_generic` also silences music, sirens, and announcements that
the map author plays through this entity, including on escape maps.
Weapon, player, door, and effect sounds emitted by other systems retain
their normal behavior. Audio started by external scripts may require
specific integration.

The replacement affects the sky texture without replacing 3D skybox geometry.
Overall lighting also darkens interiors: sunlight already baked into the BSP
cannot be isolated. Material reduction includes reflections but does not
recreate shadows or nighttime cubemaps. Water, sky, and shaders other than
those listed do not receive this additional modulation. Multiplicative decals,
such as `DecalModulate`, retain their material and follow the darkened background;
tinting them black would also affect surfaces lit by the flashlight.
`UnlitGeneric` sprites do not gain flashlight lighting: with zero exposure,
they may become invisible. Emissive materials and custom addon shaders may
require specific handling.
Maps without sky surfaces will not display the new skybox.
Updating lights and props may cause a brief pause on large maps when joining,
during cleanup between rounds, or when adjusting brightness. Lightmaps are
not rebuilt every frame. `PreRender` checks configuration and night vision;
material parameters are written only when the multiplier changes;
`Recompute` also runs only on these changes, since it is expensive.
Original values are copied before the first adjustment and restored when
night mode is disabled, Lua is refreshed, or the map shuts down.
Addons that modify the same materials may require their own integration.

References: [engine.LightStyle](https://wiki.facepunch.com/gmod/engine.LightStyle),
[os.date and the server's local time](https://wiki.facepunch.com/gmod/os.date),
[replicated env_sun direction in the Source SDK](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/server/sun.cpp),
[env_skypaint and sun tracking](https://github.com/Facepunch/garrysmod/blob/master/garrysmod/gamemodes/base/entities/entities/env_skypaint.lua),
[render.RedownloadAllLightmaps](https://wiki.facepunch.com/gmod/render.RedownloadAllLightmaps),
[IMaterial:SetVector](https://wiki.facepunch.com/gmod/IMaterial:SetVector),
[IMaterial:Recompute](https://wiki.facepunch.com/gmod/IMaterial:Recompute),
[SurfaceInfo:GetMaterial](https://wiki.facepunch.com/gmod/SurfaceInfo:GetMaterial),
[render.SuppressEngineLighting](https://wiki.facepunch.com/gmod/render.SuppressEngineLighting),
[render.ResetModelLighting](https://wiki.facepunch.com/gmod/render.ResetModelLighting),
[GM:PreDrawViewModels and restoration in PreDrawEffects](https://wiki.facepunch.com/gmod/GM:PreDrawViewModels),
[GM:PreDrawPlayerHands](https://wiki.facepunch.com/gmod/GM:PreDrawPlayerHands),
[ProjectedTexture](https://wiki.facepunch.com/gmod/Global.ProjectedTexture),
[ProjectedTexture:SetEnableShadows](https://wiki.facepunch.com/gmod/ProjectedTexture:SetEnableShadows),
[Entity:IsValid and the worldspawn exception](https://wiki.facepunch.com/gmod/Entity:IsValid),
[flashlight pass in the Source SDK's LightmappedGeneric shader](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/materialsystem/stdshaders/lightmappedgeneric_dx9_helper.cpp),
[flashlight implementation in the Source SDK](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/materialsystem/stdshaders/BaseVSShader.cpp),
[light style `a` issue with DynamicLight](https://github.com/Facepunch/garrysmod-issues/issues/3626),
[EntityKeyValue](https://wiki.facepunch.com/gmod/GM:EntityKeyValue) and
[AcceptInput](https://wiki.facepunch.com/gmod/GM:AcceptInput).
Startup options follow the
[gamemode settings](https://wiki.facepunch.com/gmod/Gamemode_Creation#settings) contract.

For diagnostics, run `zp_map_environment_status` in the client console.
The command prints a technical JSON object without changing configuration:
`implementation` should be `material-color2-v6`, `synchronized` indicates
whether a valid message arrived from the server, `packet_bits` reports the
last message's size, `requested_scale` and `applied_scale` show the multipliers,
and `materials`, `candidates`, and `shaders` describe the materials found.
`model_lighting_active` indicates whether manual lighting is active at the
time of the query; it is normally `false` in the console, outside drawing passes.
With night mode enabled, style `b`, and exposure `10`, both multipliers should
be approximately `0.025`, and `materials` should be greater than zero, even
during night vision. `synchronized: false` indicates that configuration has
not been received; a different `implementation` indicates old code.
Check the installed gamemode copy and Workshop conflicts before concluding
that the shader is failing.

Local tests simulate the GMod API. Validate in the engine: daytime maps with
static and painted skies, indoor/outdoor environments, the native flashlight
on walls and terrain (with exposure `0`, `10`, and `100`), reflections and
materials with normal maps, grass, decals, players, first-person hands/weapons,
night vision, props, music started by triggers, round cleanup, late joining,
the sun's path, sky transitions during the cycle, and restoration of options
after reloading the map. Tests use simulated times; a complete 24-hour game
has not been validated in the engine.
