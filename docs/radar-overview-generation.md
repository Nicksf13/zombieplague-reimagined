# In-game radar overview generation

The authoring command generates a base image, height layers and radar metadata
inside Garry's Mod. It uses `cl_leveloverview` for the native top-down camera,
then captures square render targets with the same orthographic alignment. It does
not require manually moving the camera, taking screenshots, or copying console
coordinates. In this workflow, Node only installs the completed export as game
content; it does not generate the images.

## Current workflow and legacy tool

Two generation methods and a separate installer remain in the repository:

| Tool | What it does | Status |
| --- | --- | --- |
| `zp_radar_generate` in GMod | Analyses brush surfaces, chooses height layers, and captures textured images using the native overview camera | Current generation workflow |
| `scripts/install-radar-overview.mjs` in Node | Validates and copies a completed in-game export into this repository's distributable content | Required packaging step for the current workflow |
| `scripts/generate-radar-overview.mjs` in Node | Reads a BSP and draws schematic geometry, optionally using manually listed levels | Legacy alternative; not called by the in-game command or installer |

The two generators do not run together. The legacy script still exists, but is
not the textured, automatic multi-floor generator. It writes the same map material
names and configuration as the installer, so running it can overwrite an installed
native capture. Its optional numeric argument is a maximum world-Z ceiling
(`4096` by default), not image resolution or spacing between floors.

## Generate

Build and install the current gamemode, start a local single-player session, and
load the desired map, such as `zm_street`. In the client console, run:

```text
sv_cheats 1
zp_radar_generate
```

Close the console so rendering can proceed. The view returns to normal when the
export finishes. The console prints the complete export folder:

```text
garrysmod/data/zombieplague/radar/exports/<map>/<run>/
```

Each run contains a 1024-square base PNG, one PNG per detected height group,
`overview.json` and `capture.json`. The last file marks a completed export. New
runs use separate folders so a failed or cancelled capture leaves earlier exports
available. To cancel, run `zp_radar_generate_cancel`. A 180-second timeout also
restores temporary settings if analysis, a menu, or an incompatible camera hook
prevents completion. The command requires local single-player, an administrator,
and cheats already enabled; it does not enable cheats or modify remote servers.
The command has no height-spacing argument: detected groups determine its layers.

Failures print a JSON diagnostic with the map, operation stage, original error,
analysis counters and floor-plan rejection code when available. The same report
is saved to `data/zombieplague/radar/capture_error.json`. This distinguishes missing
client APIs, absent samples, excess layers, setup failures and rendering errors.
Floor validation uses client collision traces; `util.IsInWorld` is a server-only API
and must not be called or declared by the client authoring tool.

Camera overrides are scoped to the operation. Native overview, marker, visibility,
sky, HUD, viewmodel, fullbright and fog cvars are restored after success, failure,
cancel, shutdown or Lua refresh. The gamemode's material darkness is temporarily
suspended, preserving the captured textures' original tint. Player models, HUD,
viewmodels and the sky are excluded from the offscreen capture.

## Install

GMod's Lua file writer is restricted to `data/`; captures cannot write directly to
`materials/` and `resource/`. From this repository, install the completed folder:

```sh
node scripts/install-radar-overview.mjs "C:/path/to/garrysmod/data/zombieplague/radar/exports/zm_street/<run>"
```

Use the complete run folder printed by GMod, including `<run>`, rather than only
the parent map folder. If `node` is not on PATH, invoke the Node executable directly;
the repository's portable installation is under `.tools/node-<version>-win-x64/`.

The installer checks every PNG and the metadata, copies the images to
`gamemodes/zombieplague/content/materials/zombieplague/radar/`, and writes
`content/resource/zombieplague/radar/<map>.json`. It replaces that map's selected
configuration. It does not render geometry or change the installed game directory.
Deploy the updated content with the gamemode, then reload the map. Remove or
update any existing server DATA override if it shadows the installed configuration.
Generating an export alone does not install it or make the radar load it: the
runtime loader does not search the `exports/` directory.

This packaging step is separate from automatic image generation. It is also what
makes the captured assets available to other players through normal content
distribution. No image upload or client-controlled server file writes are used.

## Detection and cuts

The analyser reads world brush surfaces in small frame budgets. Flat or gently
sloped faces must have enough projected area, an upward solid collision hit,
and room for a 32-by-32-by-72 player hull above the sample. Sky and nodraw faces
are ignored. The tool reads bounded, uncompressed BSP entities, planes, nodes and
leaves to identify the non-solid areas containing `sky_camera` entities. Floor
samples and corners in those areas are excluded, including when the scenery is
at the same height as playable rooms, as in `zm_canals`. Areas containing player
spawn entities are protected from exclusion. `SkyboxFilter` and `SkyboxSamples`
in failure diagnostics report classifier availability and discarded sample counts.
Unsupported BSP layouts fall back to the height heuristic rather than guessing areas.

By default, vertical islands separated by more than 2048 units are
split and the band with the most supported area is selected. This excludes the
distant 3D skybox in `gm_construct` without imposing a fixed world-Z ceiling.
Samples outside that band are excluded from both height selection and image bounds.
The diagnostic records the selected range and excluded sample count.

Initial weighted height groups span at most 48 world units, preventing a long
staircase from chaining multiple storeys into one group. Small isolated groups
are filtered by supported area. Nearby representatives less than 48 units apart
are consolidated, preferring the larger supported surface over a small landing.
The full corners of accepted faces define the common image bounds, with padding.

There can be up to 64 layers, supported by authoring, installation and the HUD.
More groups cause a failure requiring an override;
extra floors are never silently discarded to fit the limit. Boundaries between
layers use the midpoint of their representative floor heights. The automatic
capture cut is 80 units above each height, capped eight units below the next one.
Both a downward custom clipping plane and the view's near plane remove geometry
above the cut, allowing a lower layer to expose rooms below roofs. Rendering uses
the engine's native camera origin and checks its orientation and bounds before
accepting a frame. All images use exactly the same XY transform and scale.

## Optional map corrections

Automatic groups describe height slices, not architectural floor identities.
Brush analysis can miss displacement-only terrain, moving platforms and crouch-only
spaces. Reachable roofs can count as floors. Unclassified scenery in the same
vertical band can still affect bounds. Large ramps, irregular storeys and separate
buildings can need corrections. The area filter removes scenery from floor
selection and framing; decorative geometry still inside the final square frame
can require tighter author-supplied bounds.
The analyser does not prove accessibility from player spawns. A global height slice
cannot distinguish two rooms at the same height that need different cuts.

Put optional corrections in client DATA at
`zombieplague/radar/capture/<map>.json`, or ship them at
`resource/zombieplague/radar/capture/<map>.json`. Client DATA takes precedence;
invalid overrides fail rather than falling back silently. For example:

```json
{
  "Heights": [-128, 0, 128],
  "Cuts": [-48, 80, 208],
  "Bounds": { "MinX": -2048, "MaxX": 2048, "MinY": -2048, "MaxY": 2048 },
  "HeightRange": { "MinZ": -512, "MaxZ": 1024 }
}
```

These are illustrative values, not a preset for `zm_street`. Each field is optional;
`Cuts` requires `Heights` and the same number of entries. Heights and cuts must be
strictly increasing, within Source coordinate limits, with cuts above their floors.
Bounds can exclude skybox scenery and restrict analysis to the playable map area.
`HeightRange` overrides the automatic vertical island filter, including for maps
with genuine rooms connected by teleporters or elevators across large empty
height gaps. Explicit `Heights` without a range keep samples within 48 units of
the lowest and highest listed floor, excluding distant scenery.
Supplying both bounds and heights also supports maps without usable brush samples,
including displacement-only terrain.

These files have different responsibilities:

| Path | Purpose |
| --- | --- |
| Client DATA `zombieplague/radar/capture/<map>.json` | Optional inputs for the in-game generator: `Heights`, `Cuts`, `Bounds`, `HeightRange` |
| GAME `resource/zombieplague/radar/capture/<map>.json` | Shipped generator inputs, used when the client DATA input is absent |
| `scripts/radar/maps/<map>.json` in this repository | Legacy Node generator's `Levels` recipe; ignored by `zp_radar_generate` |
| Client DATA `zombieplague/radar/exports/<map>/<run>/` | Captured images and output metadata, ready for the installer |
| GAME `resource/zombieplague/radar/<map>.json` | Installed radar alignment and image/layer references, used during gameplay |
| Server DATA `zombieplague/radar/<map>.json` | Runtime configuration override that takes priority over shipped radar content |

Do not edit an export's `capture.json` to configure the next capture: it records a
completed run. Put generation corrections in the `capture/<map>.json` input.

Automated tests simulate analysis, transforms, export lifecycle, restoration and
installation. They do not validate engine screenshots. Verify floor coverage,
near-plane cuts, props, water, and marker alignment at known positions inside GMod.
Relevant engine APIs: [native view setup](https://wiki.facepunch.com/gmod/render.GetViewSetup),
[rendering](https://wiki.facepunch.com/gmod/render.RenderView),
[capture](https://wiki.facepunch.com/gmod/render.Capture), and
[file writing](https://wiki.facepunch.com/gmod/file.Write).
