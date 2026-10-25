# Adaptive bot foundation

AI bots use individual personalities and learn tactical, shelter and locomotion
preferences from their own outcomes. They run entirely on the server, with no
external service, native module, or neural network. Available
movements, aiming and tactical actions are programmed; separate learners adjust
action preferences and traversal costs. Better performance must be measured in
actual matches.

Superadmins can optionally [record bot incidents](bot-recording.md) from the
administrative menu. Recording is disabled by default and serves diagnostics;
its observations are never supplied to bot policy or learning.

## Using the bots

Build and install the gamemode, then restart the server and start a multiplayer
match with free player slots. As a superadmin, use:

```text
/aibot 4
/aibot 1 cooperative
zp_addaibot 2 cautious
```

The console command also accepts the dedicated server console. The count is 1–16
per invocation, subject to available player slots and a maximum of 64 managed
identities. Optional profiles: `aggressive`, `cooperative`, `defensive`, `cautious`,
or `random`. These choose the initial profile preference, which the bot can
adapt during combat. Automatic assignment reuses a saved preference when available;
otherwise, it randomly chooses among the least represented profiles. Thus the
first four new identities cover all four profiles. Existing `/bot` and
`zp_addbot` remain idle test bots; other addons' bots are not controlled.

| Profile | Initial preferences |
| --- | --- |
| Aggressive | Advance and apply pressure; humans prefer a shorter firing distance. |
| Cooperative | Approach visible allies before attacking when isolated or outnumbered. |
| Defensive | Maintain firing distance and dodge instead of chasing unnecessarily. |
| Cautious | Keep a longer firing distance and prioritize retreat under pressure. |

All profiles can attack, defend, retreat or group. Role, health, perceived enemy
numbers and nearby allies influence priorities. Zombies normally close to melee
range; human bots use the existing class/loadout weapons and reload empty clips.
The [weapon handling guide](bot-weapons.md) describes reserve-aware reloads,
urgent switches, equipment confirmation and withdrawal when ammunition runs out.
Small identity-specific differences affect reaction time, aim error and decision
scores. Class stats, damage, health and ammunition obey normal gamemode rules.

`zp_bot_ai_enabled 0` stops managed bots' input and decisions.
`zp_bot_learning 0` freezes experience updates and disables exploratory choices;
existing learned values still influence decisions. Both default to 1.

## What is learned

Each bot has independent tactical experience for each role, stable class ID and
special variant (normal, nemesis or survivor), shared across all maps. Outcomes
learned on one map influence decisions on another. A human class never inherits
a zombie class's failures. Metrics, navigation passages, movement estimates and
shelter records remain map-specific because they describe local observations or
geometry. Within the tactical scope, context contains role, health below/above 35%, numerical
disadvantage, close/medium/far range and recent hostile damage. Profiles provide initial action scores;
learned values contribute to those scores. A separate contextual learner weighs
the four profiles for that same bot. Successful profiles gain priority, failed
profiles lose it, and switching the active profile preserves action experience.
See [Adaptive behavior profiles](bot-behaviors.md) for selection and attribution.
Decisions normally last up to two seconds, with reevaluation when context changes
or a grouping destination disappears. About 8% of eligible decisions explore
either another profile or another action, divided evenly between the two.
Low-health decisions do not explore randomly.

Healthy zombies can reposition when perceived numerical disadvantage or recent
hostile damage makes direct pressure unfavorable. Health alone cannot prohibit
that choice. Balanced, healthy zombies keep advancing; those already in melee
range normally attack. Repositioning chooses bounded, reachable lateral routes,
validated cover or a known ally. Losing contact ends a zombie reposition after
three observed seconds, without a positive safety reward, followed by four
seconds of renewed pressure before another retreat. See [the decision and
evaluation guide](bot-objectives.md) for the complete arbitration contract.

Damage dealt gives credit proportional to the victim's maximum health; damage
received gives a proportional penalty. Death, infection, combat victory and
confirmed escapes while retreating also produce feedback. Rewards are
bounded, and estimates move 20% toward the episode result. Neutral episodes do
not create samples. Damage filters, same-team hits and round setup do not supply
combat success. Infection penalizes the previous human episode before switching
to zombie behavior. Death feedback is observed before round-end callbacks.

Damage taken during a zombie retreat has twice the normal penalty, using at most
1,000 health as its normalization reference so high-HP classes still receive
meaningful feedback. For example, 100 damage during retreat costs -0.2 for a
20,000-HP Nemesis, instead of the normal -0.005. Each hit remains capped at -1,
episodes at +/-2, and learned targets at +/-1. This changes feedback only, not
actual health or damage. Humans and other zombie actions retain normal scaling.
Retreat attempts preserve their original tactical context across visibility loss.
Humans continue escaping from the remembered threat. A human escape requires
three continuously observed seconds with no visible enemy, no recent hostile
damage, a grounded position over 320 units from the known threat and geometric
cover. A sighting disappearing alone gives no reward. Cover visits have their
own stricter arrival and sustained-protection outcome.

Two seconds of sustained human fire can end an unproductive zombie reposition.
All retreat attempts have an eight-second deadline. Known failure costs -0.25,
uses the ordinary 0.2 update rate and fences another retreat for three seconds;
there is no additional health-based severe-failure multiplier. Freeze, lifecycle
changes and AI shutdown clear pending execution. Observation gaps cannot prove
safety. New tactical contexts are versioned so these outcomes do not reuse old
retreat estimates indiscriminately.

The tactical learner is a small contextual bandit. It cannot invent tactics or
train aiming. A separate [locomotion learner](bot-locomotion.md) evaluates safe
movement combinations and learns which navmesh passages are difficult.
Cooperation includes grouping and [validated passage negotiation](bot-traffic.md).
Defensive movement maintains distance and dodges, with occasional
[shelter selection and hiding-place investigation](bot-shelters.md). Human bots
can make [extra-ammo purchase decisions](bot-weapons.md#extra-ammo-purchase-decisions)
based on weapon exhaustion, observed pressure and available packs. Deliberate
special class ability use and other extra-item purchases are future extensions.

Applied ranged damage can request a brief orientation toward an already observed
threat, for at most 0.35 seconds with a three-second cooldown. It never retrieves
a hidden attacker's current position. Visible combat aim and retreat keep priority;
there is no automatic 120-degree turn away, look-down pose or unconditional
attack suspension. Movement and normal line-of-fire checks remain active.

## Persistence and ownership

Tactical experience is stored in one version 3 file,
`data/zombieplague/bots/learning-v3.json`, for all maps. It holds independent
role/class/variant contexts and bot identities; internal scopes use `Map="*"`.
Live diagnostics still report the real map. Identity slots
1–64 persist across map changes/restarts and are separate from entity indices,
SteamID64 and visible bot names. A replacement bot reuses the first free slot and
its experience. Explicitly assigning a different profile to that slot starts
fresh tactical experience for the new personality across all maps in that
role/class/variant context. No human identities or movement histories are stored.
Automatic profile trials change only the active preference and never invoke
this manual reassignment/reset path. All four profiles' outcome estimates belong
to the individual identity; bots with the same profile do not pool their samples.
Old `learning-v1.json` files are preserved and
only supply profile defaults: their unscoped estimates cannot be attributed to a
class safely and are not copied into shared contexts.

When the shared file does not exist, valid version 2 files in `bots/scopes/` are
imported once, including inactive identities and maps. Estimates for the same
identity, role, class, variant and profile are merged using sample-weighted
means, with sample counts capped at 10,000 after merging. If maps assigned
different profiles to one identity, the profile with the most tactical samples
wins (alphabetical profile ID breaks ties). Invalid or mismatched legacy files
are skipped. Every source file remains untouched, and an existing shared file
prevents reimporting old outcomes on subsequent restarts.

Map-specific metrics now use `data/zombieplague/bots/metrics/<scope-hash>.json`.
These version 2 records contain telemetry and empty tactical estimate tables.
Missing metrics files initially read the old scope's counters without rewriting
the old file. The admin decision graph and tactical sample count reflect shared
experience; combat and movement counters describe the displayed map.

Locomotion uses independent version 1 files by scope, navmesh revision and bot
identity. Changing combat personality does not erase movement experience.
Dirty state is saved every 30 seconds and at round end/shutdown. Each successful
save keeps the previous verified contents in a `.json.bak.txt` file. Failed writes
retain pending state and preserve that backup for retries. Invalid JSON, invalid
schema or oversized input is left unchanged; that server instance continues
learning in memory without overwriting the invalid source. Repair/restore the
file while the server is stopped, then restart. A corrupt shared file is never
replaced by a legacy reimport; local metrics can still be saved independently.
The shared schema limits input to 16 MiB, 1,024 role/class/variant contexts,
64 identities per context, 288 action estimates per identity (96 legacy plus 192 versioned) and bounded samples
and numeric ranges. An optional `Behaviors` member holds up to 72 combat contexts (24 legacy plus 48 versioned)
with at most four profile estimates each. Older version 3 files remain valid and
initialize these estimates without changing existing action experience. Map
metrics retain their separate 512 KiB limit and contain empty behavior tables.

Admins can inspect current bot scopes through F4 > Administration > Bots. The
panel polls once per second while open and includes an AI creation button for
superadmins. See [Bot metrics](bot-metrics.md) for measurement definitions,
network limits, persistence contracts and engine validation steps.

## Perception, navigation and scheduling

Bots recognize visible participants within 1,800 units and a forward field of
view, with close-range awareness. Last known enemy positions normally expire
after twelve seconds; following a navmesh route extends this to at most twenty
seconds after the last sighting. Hidden movement never updates that position.
Unreachable targets are ignored for five seconds so other visible enemies can
be selected. Shooting rechecks line of sight each
command and requires aim alignment and a reaction delay. Spawns, team changes,
freezing, deaths and round transitions invalidate old plans. Stale commands stop
moving after 0.75 seconds without a refreshed plan.

Managed AI bots start exploring as soon as freeze time ends, during the infection
countdown, instead of waiting for `ROUND_PLAYING`. The preparation phase permits
navigation only; targeting, firing, reloads, weapon selection and tactical
learning begin with active play. Ground exploration requires a usable navmesh;
water recovery can attempt ascent without one. Freeze
time, individual freezing, waiting, round end, restart and map voting still stop
their inputs. Normal scheduling limits also apply when bots are released.

Navigation uses bounded A* over loaded nav areas plus hull traces for local
obstacles, conservative drop checks, low-obstacle jumps, door use and basic
stuck recovery. The search owns its queues, respects nav blockers, rejects
underwater areas when walking on dry land, and handles NULL nav areas explicitly.
Allowed climbs use actual jump power/gravity and explicit nav ladder links.
Water recovery seeks dry connected areas and can swim upward without ground
ahead. Learned passage costs influence path choice after enough observations.
Melee pursuit considers vertical reach. Endpoints prefer the containing floor;
stairs and ramps may initially lead away from the target. Failed graph searches
do not turn into direct pursuit: bots can follow a reachable approach or a
bounded-search frontier, then stop/replan. Three stalled plans without reaching
a checkpoint yield a temporary failure. See [Locomotion learning](bot-locomotion.md).
Missing navigation produces a localized notice when bots are added. Local combat
still works; exploration and routing are limited. No navmesh generation or
teleportation is performed.

Plans are scheduled approximately every 0.2 seconds, with at most two plans per
Think callback. A soft two-millisecond scheduling budget is checked between
plans; it cannot interrupt an engine trace or an in-progress path search. Each
search is capped at 128 visited areas, 1,024 examined connections and 256 queued
areas. Large populations or maps may reduce update frequency; stale-plan stopping
is intentional. Actual tick cost and movement quality require engine profiling.

## Source boundaries and validation

Server sources live under `bots/server/`: `sv_bots` owns the realm instance and hooks;
`sv_bot_commands` handles permissions/creation; `sv_bot_controller` owns lifecycle
and outcome attribution; `sv_bot_brain` owns action decisions/learning;
`sv_bot_behavior` owns adaptive profile choice, feedback and its memory schema;
`sv_bot_contexts` binds shared tactics to map-specific observation scopes;
`sv_bot_shared_learning` owns the cross-map memory and verified persistence;
`sv_bot_learning_migration` imports legacy map experience without rewriting it;
`sv_bot_metrics` observes outcomes; `sv_bot_storage` validates legacy memories and
persists map metrics; `sv_bot_perception` manages
visibility/memory; `sv_bot_navigation` owns routes/recovery; `sv_bot_motor` turns
decisions into ordinary player input. Loading uses explicit `include` calls with
type-only module contracts; no emitted `require` is added. The shared metrics
protocol validates stored and network data. Client metrics controllers and
presentation helpers are included by the admin menu.

Tests simulate individual profiles, changed decisions after failures, role
isolation, persistence/retry/corruption, permissions, reaction time, reloads,
team changes, deaths, infection, input ownership, visibility, scheduling and
bounded navigation. Editor checks include every new TS source; localization
checks cover all 32 catalogs. These tests do not validate real SWEP behavior,
engine movement/physics, map coverage, performance or skill improvement.

Progress history, frozen evaluation, matched comparisons, daily/hourly retention
and JSON export are described in [Bot progress statistics](bot-statistics.md).

Useful engine references:
[StartCommand](https://wiki.facepunch.com/gmod/GM:StartCommand),
[PostEntityTakeDamage](https://wiki.facepunch.com/gmod/GM:PostEntityTakeDamage),
[DoPlayerDeath](https://wiki.facepunch.com/gmod/GM:DoPlayerDeath),
[nearest nav areas and NULL results](https://wiki.facepunch.com/gmod/navmesh.GetNearestNavArea).
