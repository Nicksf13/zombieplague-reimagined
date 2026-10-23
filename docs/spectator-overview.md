# Spectator overview

Dead participants and voluntary spectators can switch to a full-screen, top-down
map. The jump binding (Space by default) cycles through the existing native views
with the overview added after chase: first person, roaming, chase, overview, then
first person. Without a usable map image, the original three-view cycle remains.
The normal three-second delay after death also applies to overview entry.
Initial and training spectators without a death timestamp can enter immediately.

`zp_overview` in the client console, or `/overview` in chat, toggles the same mode.
These commands accept no arguments, require a valid player, and are rate limited.
Click a player marker to follow that player in first person. Use the jump binding
or the close button to return to a native camera. Movement and attack commands
are suppressed while interacting with the map and briefly after a close click.

The map shows names, team colors, facing direction, and the existing localized S
and N markers for Survivor and Nemesis. The floor selector defaults to the full
overview and can show any installed floor. Markers on other floors retain their
positions and use height indicators and reduced opacity. The selector, its popup,
and the close control use the current theme, including addon palettes. Changing
theme or resolution rebuilds the presentation.

## Server authority and lifecycle

Overview subscriptions use a separate protocol from combat radar contacts. Only
eligible dead observers receive position updates, sampled every 0.2 seconds. True
spectators see both teams. Dead participants see only their team when
`zp_spectate_team_only` or the current round's realistic mode requires it. Cameras,
overview snapshots, and marker follow requests share the same target policy.
Only living human/zombie participants are included; decoys and camouflage radar
identities do not alter this observer view.

The server rechecks eligibility and team restrictions on every update and marker
request. Follow messages contain one 16-bit entity ID; zero closes the overview.
An arbitrary ID cannot authorize observation of a hidden or dead player. Requests
require an active subscription, exact message size, and a per-viewer cooldown.
Snapshots contain at most 128 players, with bounded names and validated fields.

Spawn, death, team change, disconnect, and round end revoke the observer's
subscription. The client also hides and clears the view on a local life/team
change, missing material, or a 1.5-second snapshot timeout. Old positional data
cannot remain visible after returning to the match. An invalid marker click keeps
the current overview until an authoritative response arrives.

## Map availability and validation

The feature reuses [radar overview assets](radar.md#map-overviews), their alignment,
floor metadata, distribution, and client material readiness. It remains available
when combat radar is disabled or hidden and does not require a radar purchase.
Maps without an installed image retain normal spectator cameras. See the
[generation guide](radar-overview-generation.md) to prepare missing map images.

Runtime simulations cover camera cycling, team permissions, role markers,
forged/stale requests, lifecycle cleanup, packet bounds, input suppression,
floor selection, theme changes, and localization. Editor tests open every new
TypeScript source in its proper project. In-game validation is still required for
actual rendering, native observer transitions, popup focus, and marker alignment.
