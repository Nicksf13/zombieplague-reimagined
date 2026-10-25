# Bot decisions, observations and reproducible evaluation

This guide describes the current implementation, not measured match improvement.
The engine scenarios below have not been run for this change. Local Lua simulations
verify contracts; they cannot establish Source physics, combat effectiveness or
generalization to another map.

## Confirmed defects and remaining hypotheses

| Inspection finding | Implemented correction |
| --- | --- |
| Hidden enemy memory overrode human flight with remembered pursuit. | Humans withdraw from the snapshot and retain an active escape attempt; they never use that snapshot as a pursuit destination. |
| Zombie retreat was ineligible solely at 65% health. | Eligibility uses known numerical disadvantage, recent damage and melee distance. Health alone does not forbid repositioning. |
| Damage facing turned away/down and unconditionally suppressed attacks. | Visible combat keeps its aim and firing checks. A brief optional orientation uses only an already observed threat, never the hidden attacker's live coordinates. |
| Shelter choice depended on a personality lottery and quiet cooldown. | Urgent escape/repositioning can choose validated cover without that lottery. Quiet human exploration retains its personality variation. |
| Mere loss of visibility could earn human escape credit. | Tactical escape requires sustained observed protection and separation; place escape additionally requires arrival. |
| Clear-ground recovery introduced jumps, and new plans could repeat a launch. | Ground recovery needs actual obstacle evidence or a nearby jump transition. Launch requests have a persistent retry budget and one issuance per plan. |
| Any shot during an issued pursuit jump forced negative jump learning. | Coincident exposure stays diagnostic. Useful completed crossings, attributed falls and observed lack of progress establish movement outcomes. |
| Retreat could never initiate a cooperative boost. | Unreachable escape destinations can use the existing boost manager. Available support excludes known combat-busy or recently attacked peers. |
| Neutral pair cancellation could immediately retry the same boost. | Cancellation has a five-second point fence without fabricating a learned failure. |

Knockback, collision with props/players, missing NavMesh coverage, deliberate traffic
waiting, precision braking, scheduler load and engine tick timing can all resemble
a frozen bot. These remain distinct hypotheses until captured in the engine.
The existing two-plans-per-Think/2 ms scheduling budget and 0.75-second command
expiry remain; check command gating at the intended bot count. No physics or
engine availability was inferred from a passing simulation.

## Shared decision chain

1. `BotPerception` supplies visible enemies/allies and static visual memory. Normal
   memory expires after 12 seconds; an active route can retain it for at most 20.
   Hidden motion does not update the snapshot.
2. `BotBrain` selects attack, defend, retreat or group in a role/class/variant
   context. `pressured` and `quiet` contexts differ. Short held decisions and
   bounded retreat attempts prevent command-by-command oscillation.
3. `BotObjectives` owns destination persistence and investigation memory. A
   withdrawal goal lasts up to 2.5 seconds, with earlier reconsideration for a
   changed threat, arrival or two seconds without progress. Zombie lateral
   alternatives prefer perceived cover/known allies, reject excessive separation
   and use existing bounded path feasibility checks when a NavMesh is loaded.
4. `BotPlaces` can implement escape/defense with validated cover. It checks hull,
   floor, class-usable exits, known-threat separation, endpoint cover and two
   straight-route exposure samples. The navigator determines actual route access.
   Compromised shelter ends the visit; it does not cancel the underlying escape.
5. Navigation selects a finite physical maneuver. Boost/traffic/precision may
   implement or replace input under their existing ownership contracts. Foreign
   substitution remains explicit, including duration in the learning trace.
6. The motor issues ordinary view/movement/buttons and preserves reaction delay,
   aim alignment and a fresh line-of-fire check. Commands are evidence of input,
   not proof of displacement or traversal completion.
7. Learners consume owned observed outcomes. Cover implementing retreat/defense
   no longer automatically invalidates the tactical purpose. Runtime place
   damage/find/escape credit requires issued execution. Known place damage is
   retained if a foreign controller subsequently interrupts the visit.

Humans confirm tactical escape only after three continuously observed seconds
grounded, hidden, geometrically protected and over 320 units from the remembered
threat, without hostile damage in the last two seconds. Place protection starts
its own three-second interval after arrival and two seconds since known danger.
Observation gaps reset confirmation; unknown pauses do not establish safety.

Zombies receive no positive reward for remaining safe. Three observed seconds
of disengagement end repositioning and impose four seconds before another
retreat; sustained fire can end an unproductive attempt sooner. All retreat
attempts have an eight-second deadline and known failure costs -0.25 with the
ordinary 0.2 estimate update rate and a three-second retry fence. Existing
role-specific combat damage normalization remains. Repositioning can improve
approach selection only within this implemented repertoire; it does not invent
new actions, special abilities or purchases.

## Hearing and investigation

`BotHearing` consumes server events, not an enemy-position query. Gunshots currently
support native pistol, .357, SMG, AR2 and shotgun bullet events through the existing
`PostEntityFireBullets` integration pattern. Unknown SWEPs may fire silently and
are deliberately excluded until an explicit audible adapter exists. Native
`PlayerFootstep` events require a nonempty sound, positive volume and the gamemode's
footstep permission. Third-party sound suppression still needs engine validation.
The [footstep hook](https://wiki.facepunch.com/gmod/GM:PlayerFootstep) supplies the
event position/volume; [bullet events](https://wiki.facepunch.com/gmod/Structures/Bullet)
describe firing rather than revealing a hidden target.

| Clue | Nominal range | Lifetime | Unoccluded horizontal grid |
| --- | ---: | ---: | ---: |
| Gunshot | 1,400 units | 6 seconds | 96 units |
| Footstep | 380 units | 2 seconds | 48 units |

Clues contain a copied perceived position, event time, category, expiry and
confidence. They contain no player identity, allegiance or target confirmation.
The emitter reference is internal and only discards self sounds. A geometry trace
ignoring all player bodies reduces occluded range to 45%, halves confidence and
coarsens the grid to 160 units. This is an explicit approximation, not acoustic
propagation through doors/rooms. Vertical positions use a 48-unit grid.

The realm keeps at most 32 snapshots, admits at most 16 events per 0.2 seconds,
coalesces same-source/category events within 0.15 seconds, and traces at most two
recent in-range events per planning pass. Clues never authorize firing.

Zombies investigate a projected navigable region from visual memory or a recent
sound, then search catalog hiding points and navigable points of interest. A
visual investigation lasts at most 12 seconds; sound investigation cannot outlive
the clue. Arrival/expiry/unreachable routing temporarily suppresses the clue for
25 seconds, with at most 64 visit keys. Empty place inspections retain the
existing temporary cooldown. No query reads hidden enemy occupancy or human
reservations. A new visual encounter is required to count a real find.

## Jumps, cooperation and persistence

Actual launches are separated from requests. Ground launch input is issued once
per plan, at least 0.8 seconds apart. Two launches without 64 units of positional
progress impose a three-second retry fence. This budget survives renewed plans
and route replans. Real obstacles, nearby nav jumps, water exits and boost inputs
remain available; recovery does not jump merely because the bot stood still.
The budget is a physical anti-repeat guard, not a reward for choosing to jump.

Boost assembly, support contact, launch, grounded exit, fifteen-second timeout
and normal participant eligibility remain in the existing manager. Completion
requires actual launch and a grounded destination outside the support player.
Foreign cancellation is neutral and retry-limited. After the pair ends, ordinary
planning resumes the surviving objective. No teleport, physics change or remote
enemy knowledge is introduced.

If an escape route is unreachable, authored boost exits can also be considered
when they add at least 80 units of known-threat separation or break its line of
fire. Assembly must be over 200 units from that threat. This reuses the existing
point geometry, class/participant checks and ordinary support/launch lifecycle;
the support candidate must be a perceived ally available outside active combat.

Saved files keep their existing schemas and verified-backup behavior. New tactical
keys use `v2:...:quiet`/`v2:...:pressured`; validators accept both legacy and current
keys. Legacy estimates/profile weights remain saved but are not silently treated
as samples of the new reward contract. Bounds are 288 action estimates and 72
profile contexts, covering both generations. Runtime local movement estimates
and catalog place identities also use `v2:`; physical passage keys/costs retain
their meaning. Existing movement/place retention bounds still apply, so ordinary
bounded eviction may eventually retire inactive legacy entries. No live data was
reset, rewritten by a migration tool or installed outside the repository.

Statistics use the `objectives-v3` reward fingerprint. Keep old exports/checkpoints
as historical evidence; do not pool their rewards with current attempts.

The [engine evaluation procedure](bot-objectives-evaluation.md) provides verified
commands, immutable checkpoint setup, required scenarios, metric definitions and
criteria for distinguishing defect correction, training benefit and transfer.

The [close-contact and idle-search regression guide](bot-contact-search.md)
documents the subsequent report on `zm_canals`, reproduced execution defects,
bounded search, target stability and the remaining engine retest.

## Local validation record (2026-10-23)

`npm run build` generated 415 Lua 5.1 runtime files. `npm test` passed all 748
tests, including server/client/test type checks, the runtime build, causal
movement ownership, duplicate damage/death hooks, frozen evaluation, persistence
and the new decision/hearing/activity regressions. The editor discovery test also
opens the four new server modules explicitly and checks their project and semantic
diagnostics. `git diff --check` passed. These are local simulations and tooling
checks; the engine scenario matrix remains unexecuted.
