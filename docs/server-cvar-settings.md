# Server cvar settings

Open **Main menu → Administration → Server settings** to choose a category. The
catalog covers all 104 built-in server cvars: 97 declared through `ConvarManager`
and seven registered directly. Engine cvars and third-party addon settings are
outside this catalog. Each field shows its translated name and exact cvar name.

Boolean fields use toggles, enumerations use dropdowns, and numeric/identifier
fields use native themed text entries. Names and options exist in all 32 native
catalogs. Classic, HL2, CS 1.6 and addon theme palettes are passed to shared controls.

## Editing contract

- Server authorization is required on every request. Bot and statistics settings
  require a superadmin to edit; other admins can inspect their current values.
- A category save sends only edited fields. The server validates registration,
  index, type, range, enum, duplicates and the entire batch before writing values.
- Category revisions detect changes by another administrator, console or addon.
  Refresh the category before retrying a stale save. Refresh discards its draft.
- Drafts survive category navigation and theme changes. Closing ignores pending
  replies; no response reopens the menu. Requests time out after five seconds.
- Opening a category does not write defaults. Current console values outside
  editor bounds are displayed and remain untouched when editing another field.
- Save applies existing cvars through `ConVar:SetString`. It does not change
  gameplay rules, add persistent configuration files or automatically restart
  rounds/maps. Existing cvar consumers determine when a value takes effect.
  Keep permanent server configuration in the server's normal configuration files.
- Environment keeps `ZPAdminSettingsRequest/Reply` and the separate map-reload
  confirmation. Other categories use `ZPServerCvarsRequest/Reply`; they never
  accept executable commands or cvar names from a client.

Category protocol version 2 appends a reload flag and authorization token after the
existing field list. The server still accepts version 1 reads/saves and returns the
original version 1 layout; those clients cannot request a category reload. A token
is issued only by an acknowledged save, belongs to that player/category/revision,
expires after 60 seconds, and is consumed once. Reading, stale revisions, reverting
the cached value, invalid permissions and disconnects cannot authorize a reload.
The deferred command rechecks the player, revision and outstanding reload need.

## Application audit

All 104 entries carry an explicit `Apply` classification, shown below each control.
This describes the built-in consumers, not possible third-party addon behavior.
Only two cvars require reloading the current map to apply all their effects:

- `zp_map_mute_ambient`: `sv_map_environment.ts` rewrites sound entity keyvalues in
  `EntityKeyValue` and stops/disables ambience in `applyEnvironment`. Reloading
  reconstructs original map entities. Live input suppression alone cannot do that.
- `zp_min_players`: `sv_round_defaults.ts` / `AddDefaultRounds` snapshots this into
  `SimpleRound.MinPlayers`. `SearchRounds` runs in `init.ts` / `ServerReady` during
  `Initialize`; `GetGoodRounds` subsequently uses the cached definition. Other
  player-count checks read the cvar live, so a change can otherwise apply only
  partially. The editor compares against the **actual registered round value**,
  accounting for map configs that run after default-round registration.

Saving these values shows the pending-reload notice and enables **Reload current
map** in that category. Clicking the button opens the existing themed confirmation.
Cancel keeps the saved setting and current map. Confirmation uses `changelevel`
with `game.GetMap()`; no full server-process restart or automatic round restart is
performed. No built-in cvar was found to require a full process restart.

The remaining application classes are based on these consumers:

| Application | Consumers and evidence |
| --- | --- |
| `live` | Map lighting callbacks in `MapLightingServer` (`sv_map_lighting.ts`); resource and regeneration ticks in `sv_event_ticks.ts`; voice/chat callbacks in `sv_event_players.ts`; `BotController.Update`, `BotTraining.Tick`, `BotStatistics.Observe`, and learning/trace gates. Existing game conditions still apply. |
| `event` | Combat/kill/infection/reward handlers in `sv_event_combat.ts`, `sv_event_players.ts`, `sv_player_combat.ts`, `sv_infectionmanager.ts`, `sv_event_ticks.ts`; `WeaponManager` purchase checks; `RoundsLeft`, vote extensions, spectator target selection, and statistics collection/report/save events. Existing health bonuses/rewards are not replayed retroactively. |
| `spawn` | `Infect`, `MakeHuman`, `MakeNemesis`, `MakeSurvivor` (`sv_player_infection.ts`), class application (`sv_class_menu_apply.ts`), and `PlayerSetModel` (`sv_event_players.ts`). Existing actors are not forcibly respawned or transformed. |
| `phase` | `FreezeTime`, `TryNewRound`, `NewRound`, `EndRound` and `SetTimer` (`sv_round_lifecycle.ts`) read delays when scheduling a phase. Already scheduled timers are not rescheduled by saving a cvar. |
| `vote` | `VoteMapManager.StartVotemap` (`sv_votemap.ts`) reads the map limit and extension availability while building a vote. An active ballot remains intact. |
| `mixed` | `zp_realistic_mode`: `IsRealisticMod` and combat/resource rules read it dynamically, while footstep attributes are applied on spawn/class application. |
| `unused` | No built-in consumer exists for `zp_breath_drain`, `zp_infection_bomb_radius`, `zp_ap_total`, `zp_ap_kill_human`, or `zp_givetake_ammopacks_allowed`. They remain listed because they are registered. Reloading cannot activate missing readers. |

The unused classification was checked against all source references, including
generated-name loops. `AddTotalDamage` grants one ammo pack per threshold without
reading `zp_ap_total`; the kill handler reads `zp_ap_kill_zombie` for its reward;
the infection projectile uses its existing radius code; `GiveTakeAmmoPacks` checks
superadmin permission without reading the registered allow toggle. This change
documents those existing behaviors and does not alter gameplay rules.

`sh_server_cvar_catalog.ts` defines metadata; `sh_server_cvars.ts` defines shared
validation. `sv_server_cvars.ts` owns authorization and revisions. The client
drafts and rendering live in `cl_server_cvars.ts` and `cl_server_cvars_hud.ts`.

The legacy `zp_breath_drain` is registered but currently has no gameplay reader;
its help text states this. Sprint drain is enabled by `zp_run_should_drain` and
its amount is `zp_run_drain`. Health mode selectors show semantic options rather
than requiring users to memorize numeric modes.

## Validation

Runtime tests simulate both realms and cover complete declaration/default coverage,
localization, validation, transaction atomicity, permissions, stale revisions,
rate limits, unavailable cvars, unsaved drafts, theme rebuilds, enum controls and
late/malformed replies. `tests/helpers/server-cvar-inventory.mjs` reads actual
TypeScript registration calls, including loop-expanded names. New registrations
must be added to the catalog and translated; the coverage test detects omissions.

Reload tests also execute the actual `AddDefaultRounds` registration to demonstrate
its cached minimum, then verify read/save/revert behavior, one-use confirmation,
expiration, player/category isolation, console edits, deferred permission checks,
disconnects and compatibility with version 1 clients. Client tests cover cancel,
all three built-in themes, stale dialogs, navigation and closed menus. These are
local simulations; no in-engine reload has been performed by these tests.

Actual GMod rendering and input remain engine checks: open every category with
each built-in theme, scroll the forms, edit a value, verify it in the server console,
check refresh/back behavior, compare admin and superadmin access, and confirm the
environment reload dialog still requires explicit confirmation. Local panel
substitutes do not establish visual or in-match validation.

## Built-in catalog

Defaults below are declaration defaults, not current server values.


### Server weather and time

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Mute map ambient sounds | `zp_map_mute_ambient` | `1` | toggle | map |
| Map night mode | `zp_map_night` | `1` | toggle | live |
| Day/night cycle using the server clock | `zp_map_day_cycle` | `0` | toggle | live |
| Custom skybox (empty = automatic) | `zp_map_skybox` | `(empty)` | skybox | live |
| Night brightness (b: dark; m: normal) | `zp_map_night_brightness` | `c` | brightness | live |
| Night ambient brightness (0: none; 100: default) | `zp_map_night_exposure` | `100` | exposure | live |

### Rounds and map voting

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Minimum players | `zp_min_players` | `2` | number | map |
| Delay between rounds (seconds) | `zp_newround_delay` | `10` | number | phase |
| Delay before infection (seconds) | `zp_infection_delay` | `10` | number | phase |
| Freeze time (seconds) | `zp_freeze_time_delay` | `10` | number | phase |
| Maximum rounds | `zp_max_rounds` | `10` | number | event |
| Round duration (seconds) | `zp_round_time` | `300` | number | phase |
| Maps offered in the vote | `zp_maps_to_vote` | `8` | number | vote |
| Rounds added by extension | `zp_rounds_to_extend` | `10` | number | event |
| Allow extending the current map | `zp_can_repeat_map` | `1` | toggle | vote |
| Notify remaining rounds | `zp_notify_rounds_left` | `1` | toggle | event |

### Combat and weapons

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Friendly fire | `zp_friendly_fire` | `0` | toggle | event |
| Infection bomb radius setting | `zp_infection_bomb_radius` | `20000` | number | unused |
| Fall damage | `zp_falldamage` | `1` | choice | event |
| Ammunition mode | `zp_clip_mode` | `0` | choice | live |
| Primary — Weapon limit | `zp_max_allowed_primary_weapons` | `1` | number | event |
| Secondary — Weapon limit | `zp_max_allowed_secondary_weapons` | `1` | number | event |
| Melee — Weapon limit | `zp_max_allowed_melee_weapons` | `1` | number | event |
| Map prop damage multiplier | `zp_map_prop_damage_multiplier` | `1` | number | event |

### Movement and stamina

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Realistic mode | `zp_realistic_mode` | `0` | toggle | mixed |
| Allow zombies to sprint | `zp_zombie_should_run` | `1` | toggle | spawn |
| Drain stamina while sprinting | `zp_run_should_drain` | `0` | toggle | live |
| Drain breath underwater | `zp_water_should_drain` | `0` | toggle | live |
| Sprint stamina drain | `zp_run_drain` | `0` | number | live |
| Underwater breath drain | `zp_water_drain` | `0` | number | live |
| Suffocation damage | `zp_breath_damage` | `1` | number | live |
| Breath recovery | `zp_breath_recover` | `0.5` | number | live |
| Legacy breath drain | `zp_breath_drain` | `1` | number | unused |

### Battery and equipment

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Flashlight — Drain battery | `zp_battery_flashlight_should_drain` | `0` | toggle | live |
| Flashlight — Battery drain amount | `zp_battery_flashlight_drain` | `1` | number | live |
| Night vision — Drain battery | `zp_battery_nightvision_should_drain` | `0` | toggle | live |
| Night vision — Battery drain amount | `zp_battery_nightvision_drain` | `1` | number | live |
| Voice chat — Drain battery | `zp_battery_voice_should_drain` | `0` | toggle | live |
| Voice chat — Battery drain amount | `zp_battery_voice_drain` | `0.5` | number | live |
| Battery recharge | `zp_battery_charge` | `0.5` | number | live |

### Zombies and health bonuses

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Zombie footsteps | `zp_zombie_footstep` | `1` | toggle | spawn |
| Zombie screen filter | `zp_zombie_screen_filter` | `1` | toggle | spawn |
| Regenerate zombie health | `zp_health_should_regen` | `1` | toggle | live |
| Health restored per regeneration | `zp_health_regen` | `10` | number | live |
| Regeneration delay after damage (seconds) | `zp_health_regen_time_delay` | `20` | number | live |
| First zombie — Health bonus mode | `zp_first_zombie_reward_mode` | `1` | choice | event |
| First zombie — Health bonus amount | `zp_first_zombie_reward_health` | `250` | number | event |
| Last zombie — Health bonus mode | `zp_last_zombie_reward_mode` | `1` | choice | event |
| Last zombie — Health bonus amount | `zp_last_zombie_reward_health` | `250` | number | event |
| Last human — Health bonus mode | `zp_last_human_reward_mode` | `1` | choice | event |
| Last human — Health bonus amount | `zp_last_human_reward_health` | `25` | number | event |

### Special classes

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Nemesis — Health calculation mode | `zp_nemesis_health_mode` | `1` | choice | spawn |
| Nemesis — Fixed health | `zp_nemesis_health` | `5000` | number | spawn |
| Nemesis — Health per opposing player | `zp_nemesis_health_player` | `500` | number | spawn |
| Nemesis — Damage multiplier | `zp_nemesis_damage` | `10` | number | spawn |
| Nemesis — Inherit class attributes | `zp_nemesis_earn` | `0` | toggle | spawn |
| Nemesis — Keep class model | `zp_nemesis_override_player_mode` | `0` | toggle | spawn |
| Survivor — Health calculation mode | `zp_survivor_health_mode` | `1` | choice | spawn |
| Survivor — Fixed health | `zp_survivor_health` | `300` | number | spawn |
| Survivor — Health per opposing player | `zp_survivor_health_player` | `50` | number | spawn |
| Survivor — Damage multiplier | `zp_survivor_damage` | `2` | number | spawn |
| Survivor — Inherit class attributes | `zp_survivor_earn` | `0` | toggle | spawn |
| Survivor — Keep class model | `zp_survivor_override_player_mode` | `0` | toggle | spawn |

### Ammo Packs

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Reward per damage threshold | `zp_ap_total` | `1` | number | unused |
| Damage required per reward (0: disabled) | `zp_ap_damage` | `500` | number | event |
| Reward for killing a human | `zp_ap_kill_human` | `5` | number | unused |
| Reward for killing a zombie | `zp_ap_kill_zombie` | `5` | number | event |
| Reward per infection | `zp_ap_zombies_total` | `1` | number | event |
| Victory reward amount | `zp_winning_reward_prize` | `5` | number | event |
| Reward infections | `zp_ap_zombies` | `1` | toggle | event |
| Enable victory rewards | `zp_should_winning_reward` | `1` | toggle | event |
| Allow admins to give or take ammo packs | `zp_givetake_ammopacks_allowed` | `1` | toggle | unused |

### Points

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Reward per damage threshold | `zp_point_amount_received` | `1` | number | event |
| Damage required per reward (0: disabled) | `zp_point_damage_amount_to_point` | `1500` | number | event |
| Reward for killing a human | `zp_point_points_per_human_kill` | `1` | number | event |
| Reward for killing a zombie | `zp_point_points_per_zombie_kill` | `1` | number | event |
| Reward per infection | `zp_point_points_per_infection` | `1` | number | event |
| Reward per cure | `zp_point_points_per_cure` | `1` | number | event |
| Suicide penalty | `zp_point_negative_points_per_suicide` | `1` | number | event |

### Communication and admin models

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Global text chat | `zp_chat_all` | `1` | toggle | live |
| Global voice chat | `zp_voice_all` | `1` | toggle | live |
| Allow hearing dead players | `zp_can_hear_death` | `0` | toggle | live |
| Allow reading dead players' chat | `zp_can_see_death` | `0` | toggle | live |
| Spectate teammates only | `zp_spectate_team_only` | `1` | toggle | event |
| Human admin model | `zp_admin_human_model` | `0` | toggle | spawn |
| Zombie admin model | `zp_admin_zombie_model` | `0` | toggle | spawn |

### Bot AI and training

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Train AI | `zp_bot_training` | `0` | toggle | live |
| Enable bot AI | `zp_bot_ai_enabled` | `1` | toggle | live |
| Enable bot learning | `zp_bot_learning` | `1` | toggle | live |
| Frozen evaluation (no learning or exploration) | `zp_bot_evaluation` | `0` | toggle | live |
| Learning attribution diagnostics | `zp_bot_learning_trace` | `0` | toggle | live |
| Training bot count | `zp_bot_training_count` | `2` | number | live |
| Diagnostic bot ID (0: all) | `zp_bot_learning_trace_bot` | `0` | number | live |

### Bot statistics

| Setting | Cvar | Default | Control | Application |
| --- | --- | --- | --- | --- |
| Scenario | `zp_bot_stats_scenario` | `live` | text | event |
| Difficulty | `zp_bot_stats_difficulty` | `default` | text | event |
| Opponent checkpoint label | `zp_bot_stats_opponent` | `uncontrolled` | text | event |
| Evaluation group | `zp_bot_stats_cohort` | `trained` | choice | live |
| Statistics sampling interval (seconds) | `zp_bot_stats_sample` | `0.5` | number | live |
| Stuck speed threshold | `zp_bot_stats_stuck_speed` | `5` | number | live |
| Attempt timeout (seconds) | `zp_bot_stats_timeout` | `30` | number | live |
| Attempts per analysis block | `zp_bot_stats_block` | `100` | number | event |
| Maximum retained attempts | `zp_bot_stats_retention` | `2000` | number | event |
| UTC offset (minutes) | `zp_bot_stats_utc_offset` | `-180` | number | event |
| History retention (days) | `zp_bot_stats_days` | `90` | number | event |

