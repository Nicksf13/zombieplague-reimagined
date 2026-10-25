# Adaptive behavior profiles

`bots/server/sv_bot_behavior.ts` learns which profile works for each persistent
bot identity, role, stable class and normal/Nemesis/Survivor variant. It shares
that identity's tactical memory across maps. Different bots never share profile
performance merely because they started with the same personality.

The assigned profile remains an initial preference. Each new combat episode
selects an active profile using a contextual score:

`weight = initial-profile prior + 0.85 * learned estimate`

The assigned profile receives a prior of 0.15; other profiles start at zero.
Profiles are aggressive, cooperative, defensive and cautious. Separate estimates
cover the existing role, low/healthy life, numerical disadvantage and range
contexts, with separate quiet/pressured versioned contexts. Thus a successful cautious episode does not teach every bot to be
cautious in every situation.

Normally the highest-weight profile supplies the action rules. Approximately 8%
of eligible new decisions run an experiment, split evenly between profile and
action exploration. Profile experiments prefer the least-tested alternatives to
the current best profile. Both kinds are disabled below 35% life and when
`zp_bot_learning` is off. Previous learned weights still apply with learning off.

The active profile stays attached to the held decision/retreat attempt. On a
nonzero outcome, its estimate moves 20% toward the reward clamped to [-1, 1], with
at most 10,000 samples per estimate. Episodes without an observed outcome do not
supply feedback; interruption retains rewards already observed. A randomly forced action updates action experience only, because it
did not execute the selected profile's usual policy. Infection, damage, death
and confirmed escapes keep the existing outcome attribution and safety rules.

Profile switching affects action scoring, desired combat distance and future
shelter-selection preferences. It preserves learned actions and movement memory.
The controller's status and admin cards show the active profile. The initial
profile still controls population balancing and saved assignment; explicitly
reassigning it retains the existing reset semantics. Automatic trials never
reassign it and never reset experience.

Profile estimates use the optional `Behaviors` field in each identity's existing
`data/zombieplague/bots/learning-v3.json` record. It accepts up to 72 combat contexts
(24 legacy plus 48 versioned) with four validated profile estimates each. Older records without the
field retain their action estimates and start with neutral profile estimates.
Verified backups, failure retries and corruption protection follow the shared
store's existing rules. Map-specific metric files contain empty behavior tables.

`BotBrain.BehaviorWeights(situation)` returns independent score snapshots for
server-side inspection, including prior, learned contribution, total and sample
count. The current admin graph continues to show action scores under the active
profile. Tactical sample totals count outcomes once rather than adding profile
samples to the same action samples again.

Foreign controller interventions retain the selected tactical label but suppress
both action and profile updates when that episode cannot be evaluated normally.
The requested movement, issued input and intervention duration are recorded
separately by the optional [integrity diagnostics](bot-learning-integrity.md).

`tests/bot-behavior.test.mjs` covers exploration, outcome attribution, preference
changes, independent identities, held contexts, disabled learning and safety
rules. `tests/bot-behavior-storage.test.mjs` covers map/restart continuity, older
records, malformed estimates and controller/spacing integration. Tests simulate
GMod; improved match performance still needs measurement in the engine.

Current tactical keys use `v2:` and a `quiet`/`pressured` suffix. Legacy action
and profile estimates remain readable and saved, but are not queried for new
contexts. See [decision contracts and evaluation](bot-objectives.md).
