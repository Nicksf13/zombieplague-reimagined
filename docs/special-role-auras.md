# Special-role auras

Living Nemesis players have a red plasma aura; living Survivors have a blue one.
The existing colored dynamic light remains in place. The client draws animated
energy ribbons and glow sprites around the current collision bounds, so the aura
follows movement and crouching without leaving particles behind.

The materials use additive, unlit rendering with depth testing. The aura stays
visible in dark map presets and is occluded by world geometry. Rendering skips
depth and skybox passes, dormant or hidden players, and players beyond 2,560 units;
opacity fades over the last 512 units. First-person views hide the viewer's aura
and the aura of an in-eye spectator target. Third-person views retain it.

Each aura material resolves `$basetexture` from its source VMT instead of assuming
that the material and texture share a name. For example, `sprites/light_glow02_add`
uses the `sprites/light_glow02` texture. Lua refresh also updates the cached
material's texture, repairing instances created with an incorrect texture path.
Missing materials or invalid textures disable only the affected layer, avoiding
the engine's checkerboard error texture while preserving the other aura layer.

Role flags and teams determine eligibility. Death, role removal, or a mismatched
team stops drawing immediately. Initial server snapshots include `Nemesis` and
`Survivor` booleans so clients joining during a round receive the same role state
as clients that saw the original transformation. Existing role-update messages
remain unchanged. There are no additional downloads or per-frame network messages.

`special-aura-client.test.mjs` covers rendering eligibility, colors, animation,
camera modes, bounds, distance fading, material resolution, invalid-texture handling,
cached-material repair, reloads, and initial role synchronization.
`special-role-status.test.mjs` checks the server snapshot. These are simulated
runtime checks; verify the final appearance, wall occlusion, dark maps, and
third-person/spectator cameras inside Garry's Mod.
