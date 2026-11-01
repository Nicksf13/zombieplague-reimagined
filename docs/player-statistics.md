# Player statistics

Open **Player statistics** from `zp_menu`, or run `zp_statistics`. Everyone can
view the top 20, their own rank even outside that list, and a selected player's
profile. Filters select a map (including maps played previously), all maps on
this server, one of four roles, a statistic, and an optional weapon. Use Refresh
to read new totals. **All weapons** shows combined amounts: two AR2 kills and
three SMG kills produce five total kills. Selecting one weapon shows its kills,
infections, effective health damage and armor damage. The profile also shows
the all-weapons total for the statistic selected in the ranking.
Humans and bots share the ranking; bot entries have a localized marker and can
be selected to open their profile. Offline participants remain in the rankings.
Ties share a rank; the stable profile ID provides
a stable order within a tie. Rankings sort raw amounts in descending order,
including deaths and damage taken; these are activity rankings, not skill ratings.

The server owner can set `zp_statistics_enabled 0` in `server.cfg` or disable
the toggle under **Server settings → Player statistics** as a superadmin.
Disabling stops collection, hides the main menu entry and denies public history
requests without deleting saved history. An already open window clears its
data. Setting the value back to `1` resumes collection. The same toggle controls
collection in ordinary rounds and bot training; training bots accumulate their
own profiles while human spectators remain outside active-round counters.

## Counting rules

- Human, zombie, Nemesis and Survivor are mutually exclusive roles. Nemesis
  never contributes to normal zombie counters; Survivor never contributes to
  normal human counters.
- Collection runs only during active rounds for participating humans and bots.
  Both accumulate the same counters, round records, per-role and per-weapon
  history, whether their opponent is human or a bot. Each actor is credited
  independently. Friendly kills and
  friendly damage do not contribute to offensive statistics. Environment damage
  and actual deaths still count for participating victims.
- Kills come from actual enemy player deaths. Infection and cure events have
  their own counters. Existing frags, deaths, points and ammo-pack rewards are
  unchanged. An infection is not recorded as a statistics death.
- Kills, caused infections, health damage and armor damage also record the
  source weapon's class ID for each role and map. Death attribution uses the lethal damage source; infection
  attribution is captured before conversion and class callbacks. Known projectile
  classes map to their launcher, including AR2 grenades, RPG missiles and infection
  grenades. A weapon switch after firing does not move that event to the new weapon.
  Registered addon projectile IDs use their weapon definition. Unrecognized
  non-weapon sources retain their source class rather than claiming the held weapon.
  Damage attribution captures the source and attacker's role before the hit and
  records only effective loss afterward. Armor-only hits still count; overkill,
  duplicate post-damage receipts and blocked health damage cannot inflate it.
- Damage is actual health lost, capped at health before the hit. Armor loss has
  separate counters, including armor-only hits. Infection-related health
  replacement is not damage. Self/environment damage has no attacker credit.
- Assists credit another enemy damager within ten seconds of a kill. Contributions
  expire on death, spawn, conversion, team change or round cancellation. They do
  not create extra kills or points.
- Curing another player and using an antidote on yourself are separate counters.
  Received infections/cures belong to the victim's role before conversion.
- Alive time stops at death, conversion, leaving participation, or round end.
  Best survival is one continuous living interval in one role. Standing still
  still counts as being alive. Waiting, freezing and infection delay do not count.
- Distance uses sampled displacement in Source units; the menu displays meters
  using 0.01905 meters per unit. Samples more than two seconds apart and large
  position jumps are discarded. Small teleports and knockback cannot always be
  distinguished from movement by sampling alone.
- Each role gets one participation per round in which the player is alive in
  that role. Wins use the player's final role/team at round end; disconnected
  players get no result. Finishing alive is tracked separately. A player who
  changes sides can participate in several roles but receives at most one win.
- Best kills, damage and infections are records within one round and role,
  including interrupted rounds. All-map totals sum map counters and take the
  maximum of records. Re-enabling mid-round starts a new participation interval.

## Persistence and addon API

The default backend writes versioned JSON in
`DATA/zombieplague/statistics/v1/<map>.json`. Profile IDs remain strings.
Records load before collection starts, save every 30 seconds, and flush at
round end, disconnect, disable and shutdown. Failed saves remain pending for
retry. Verified previous versions are kept as `<map>.json.bak.txt`. Invalid or
unreadable history pauses collection rather than overwriting it; repair or
restore the affected file and restart the server. The default size limit is
16 MiB per map file. Schema version 4 adds `ID` and `Bot` while retaining the
same directory and accepting version 1, 2 and 3 files. Legacy human profiles
derive `ID` from their existing `SteamID64` and `Bot = false`; all counters remain.
Version 3 added health and armor damage to `Weapons`.
Version 2 introduced kills and infections per weapon. Existing totals remain unchanged;
historical events without weapon information appear under **Unidentified weapon /
older records**. Missing version 2 damage fields become zero for known weapons;
their old unattributed health/armor damage is retained in the unknown bucket.
No previous weapon can be inferred from a total counter.

`GAMEMODE.PlayerStatistics` exposes `IsEnabled`, `IsReady`, `GetPlayerID`,
`Report`, `Flush`, and `SetStorage`. Report returns detached data; changing it
cannot change collected totals. Its arguments are a profile ID string and this query:

```lua
local id = GAMEMODE.PlayerStatistics:GetPlayerID(ply) -- supports humans and bots
local report = GAMEMODE.PlayerStatistics:Report(id, {
    Map = "", -- all maps; use game.GetMap() or another recorded map for one map
    Role = "human", -- human, zombie, nemesis, survivor
    Metric = "Kills",
    Target = "", -- requester's profile; or another participant's profile ID
    Weapon = "", -- optional; empty means all weapons, or e.g. weapon_ar2
    IncludeBots = true, -- optional, defaults to true; false provides human-only rankings
})
```

The report contains `Maps`, `Leaders`, `SelfRank` (zero when unranked),
`SelfValue`, `Players`, and `Profile`. Profiles contain `Map`, `ID`, `Bot`,
`SteamID64`, `Name`, `Roles`, and `Weapons`; each role contains the counters declared in
`types/player-statistics.d.ts`. The aggregate profile uses `Map = "all"`.
The public map selector lists the current map first and up to 255 other maps.
`Weapons[classID][role]` contains `Kills`, `Infections`, `DamageDealt`, and
`ArmorDamageDealt`. Kills and infections are integers; damage can be fractional.
The report adds a
bounded `Weapons` option list with IDs/display names and `WeaponValues` for the
selected profile and role. A weapon filter applies to kills, infections, dealt
health damage or dealt armor damage;
choosing another statistic clears it in the menu. At most 127 distinct known
weapon IDs and one unknown bucket are retained per profile; additional sources
go into the unknown bucket, preserving combined totals. Saved weapon sums must
match role totals; validation allows normal floating-point rounding for damage.

Human profile IDs equal their real SteamID64, which remains unchanged as a
string. Bot IDs use `bot:<SHA256 of assigned name>:<duplicate slot>`;
their `SteamID64` field is empty because bots have no real Steam account.
The engine's shared zero ID is never used as a storage key or synthesized into
a fake SteamID64. Concurrent bots with identical names get distinct slots.
IDs remain fixed during a bot entity's lifetime, including respawns, role
changes and renames. Across maps, restarts, or named replacements, the same
name/available duplicate slot resumes its saved profile. A new name starts a
different logical profile after reconnection. Identically named bots can only
be distinguished by these slots, so keep roster names stable for long-term comparisons.

Implement `ZPStatisticsStorage` to use GMod SQLite or an external database.
Register a backend before initialization through the server hook:

```lua
hook.Add("ZPStatisticsStorage", "MyStatisticsBackend", function(service)
    service:SetStorage(MyStatisticsBackend)
end)
```

Backends implement colon methods `Load(done)` and `Save(records, done)`:

- `Load` returns every persisted per-map profile with `done(records)`, an empty
  sequential table for a new database, or `done(nil)` on failure. Loaded records
  are validated for map names, SteamID64, role fields and finite counters.
- `Save` receives a detached batch of changed **absolute** profiles. Upsert by
  `(Map, ID)`; do not add these values to previous database counters. Persist
  `ID` and `Bot` alongside existing fields. `SteamID64` remains the real human
  account ID or an empty string for bots and is no longer the generic key.
  Preserve records absent from the batch and invoke `done(true)` only after
  durable success, or `done(false)` on failure. Use transactions where possible.
- Call each callback exactly once. Asynchronous callbacks are supported: only
  one save runs at a time, and updates received during a save remain pending.
  An external backend must arrange its own connection readiness and shutdown
  drain; GMod cannot wait for an asynchronous database callback after exit.
- Backend replacement is rejected once loading has started. No runtime imports
  or SQL assumptions exist in the collection and ranking rules.

The network endpoint is read-only, validates filter indices, map names and
human/bot profile IDs, caps request/reply sizes, and rate-limits each player. It exposes a
bounded ranking and one profile rather than transmitting the stored database.
Protocol version 3 supports bot profile IDs and mixed rankings. Version 2 adds
the weapon filter; version 1 still requests combined totals. Versions 1 and 2
retain human-only responses for old clients. Network profiles omit the full per-role weapon dictionary and carry
only the selected weapon's values; the server addon API returns detached full
profiles. Backends must persist the new `Weapons` dictionary along with totals.

## Validation

`npm run build` generates and validates runtime Lua. `npm test` checks strict
types, editor project assignment, collection, persistence failures, rankings,
the public protocol, themed native controls and all 32 localization catalogs.
These are local simulations; engine damage ordering, map transitions and actual
rendering still require validation inside Garry's Mod.

The shared themed `ZPMenuControls.CloseButton` renderer centers its glyph using
the button dimensions and measured font size. Menu paint simulations verify
both axes for rendered close buttons across the built-in themes and addon palettes.
