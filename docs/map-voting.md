# End-of-map voting

After the last round (`zp_max_rounds`), a 20-second vote opens automatically.
The server selects up to eight distinct installed maps matching `ALLOWED_PREFIX`.
`zp_maps_to_vote` defaults to 8 and is clamped to 1–8. Fewer eligible maps produce
a shorter list. When `zp_can_repeat_map` is enabled, extending the current map is
an additional option, preserving `zp_rounds_to_extend`.

Players can use `/nominate <map>`, `/nominar <map>`, or the console command
`zp_nominate <map>` before voting starts. Each connected human player has one
nomination; submitting another replaces it. Multiple players may support the same
map. Maps with more nominations get priority; equal support and remaining slots
are randomized. Nomination does not guarantee a slot when more than eight maps
are nominated. No argument prints eligible map names in the player's console.
The current map and maps outside the allowed prefixes cannot be nominated.
Nominations close during voting/map changes, clear at vote start, and disappear
when the nominating player disconnects. They are not persisted.

Every player, including dead players and spectators, can vote. Bots cannot vote
or nominate. One vote per SteamID64 is counted, and choosing another candidate
replaces that vote. Disconnecting removes an active vote. The server validates
the session, deadline and candidate and limits changes to one every 0.25 seconds.
Invalid packets and votes from previous sessions cannot affect the result.

The menu uses the active Classic, HL2, CS 1.6 or addon palette and geometry.
Counts, proportional bars, the confirmed personal choice and leaders update
after each accepted vote. Equal leaders are all highlighted. Existing panels
remain in place so live updates preserve scrolling and the hovered candidate.
Closing the menu does not remove a vote; reopen it through F4's map vote option,
`/votemap`, or `zp_votemap`. Updates do not reopen a manually closed menu.
Late clients receive the current candidates, votes and remaining time.

At timeout, the server chooses randomly between candidates with the most votes,
including when everyone abstains. The winner is shown for five seconds before
changing the map or restarting rounds. With no eligible maps and extension
disabled, the existing fallback adds extra rounds instead of attempting a change.

## Map thumbnails

The menu checks these client-mounted assets in order:

1. `maps/thumb/<map>.png`
2. `maps/thumb/<map>.jpg`
3. `materials/maps/<map>.png`
4. `materials/maps/<map>.vmt`

These are actual map images supplied by map addons or the server's content pack.
Missing/error materials use a themed placeholder; no screenshots are fabricated
and no external image requests are made. Materials are cached when cards are
created, outside paint callbacks. Supply thumbnails to clients with the map addon
or an appropriately distributed content addon. GMod's
[Material API](https://wiki.facepunch.com/gmod/Global.Material) supports native
`maps/thumb/` paths outside `materials/`.

## Integration and validation

`ZPVoteMap`, its existing methods, `MapsToVote` and boolean `Voters` remain public.
The new versioned messages are `ZPMapVoteSelect` (client request containing
`Version`, `ID`, `Map`), `ZPMapVoteSnapshot` (server state, including a personalized
`Selected`), and `ZPMapVoteOpen` (explicit reopen request). Runtime validation is
shared in `rounds/shared/sh_map_vote_protocol.ts`. `ZPPlayerEnvironmentReady`
supplies late-join state after the client's normal readiness request.

Addon themes may supply `CreateMapVote`, returning a presentation with
`Open(actions)` and `Destroy()`. Actions expose `GetSnapshot()`, `GetRemaining()`,
`Select(map)` and `Close()`. Without a factory, the built-in presentation uses
the addon's palette. Theme changes rebuild the presentation while keeping state.

Build and runtime tests cover selection, nominations, deadlines, disconnections,
late joins, ties, extension/fallback, malformed messages, all three themes, live
painting, panel cleanup, editor projects and all 32 localization catalogs.
The tests simulate GMod; real networking, mouse input, mounted thumbnails,
resolution/scroll behavior and `changelevel` still require in-engine validation.
