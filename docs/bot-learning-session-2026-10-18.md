# Real training attribution audit: 2026-10-18

## Active capture and scope

This is a measurement from Garry's Mod, not a simulator result. Identity **1** on
`zp_training_zig_zag` was captured in session
`1792347058-9b1f984a8d57f49f`, from engine time **75.255** to **158.115**:
**82.860 seconds**, record sequences **238–897**, **660 records**, no sequence
gaps, no records outside effective learning mode, and no duplicate-record/update
issues reported by the analyzer.

The local console file was `garrysmod/console.log`, rather than `console.txt`.
Its preserved snapshot is authoritative for this interval. The 512-row export
had already dropped 453 older records and starts at sequence 454, so it cannot
independently establish the complete interval. Both original files and SHA-256
hashes were preserved before any further capture.

Normal training changed class/role: BomberZombie, a brief LightHuman interval,
and LeechZombie. These are separate learning scopes. This audit demonstrates
execution and attribution behavior in ordinary training; it is not a controlled
comparison of navigation performance between policies or fixed classes.

## Experience lifecycle and updates

| Learner | Open at start | Created in interval | Finalized in interval | Open at end | Updated experiences |
| --- | ---: | ---: | ---: | ---: | ---: |
| Local movement | 9 | 74 | 72 | 11 | 39 |
| Tactical action | 1 | 41 | 41 | 1 | 26 |
| Profile | — | — | — | — | 26 |
| Passage statistics | — | — | — | — | 7 |
| Place visits | 0 | 0 | 0 | 0 | 0 |
| Cooperative boost | 0 | 0 | 0 | 0 | 0 |

The balances close: movement `9 + 74 = 72 + 11`; tactical `1 + 41 = 41 + 1`.
There are no newly created experiences with an unexplained missing ending that
are absent from the final pending snapshot. The **11 movement experiences and
one tactical experience still open at the boundary are not discarded samples**.

Profile updates reuse tactical IDs but update a different estimator. Passage
updates modify derived stage statistics and have no independent episode lifecycle.
Their zeros above must not be interpreted as missing experience creation.
No place visit or boost pair was exercised for this identity in this interval;
their zero updates do not demonstrate either success or failure of those learners.

| Final outcome | Movement: all finalizations | Movement: created in interval | Tactical: all finalizations | Tactical: created in interval |
| --- | ---: | ---: | ---: | ---: |
| success | 30 | 21 | 0 | 0 |
| observed | 8 | 8 | 32 | 31 |
| failure | 1 | 1 | 1 | 1 |
| interrupted | 2 | 2 | 0 | 0 |
| superseded | 31 | 31 | 8 | 8 |
| Total | 72 | 63 | 41 | 40 |

Nine movement successes and one tactical observed ending belong to experiences
already open when collection started. The one local failure is `stuck_failure`
at time 139.725, **not a punishment for the detected fall**.

There were **98 unique learner updates**: 39 movement, 26 tactical, 26 profile,
and seven passage updates. All **91 scalar bandit updates** were independently
recomputed from their recorded reward/before/after values and matched the
implemented update rule within `1e-9`. All 91 changed the scalar value. Two of
the seven passage writes changed the failure fraction; the other five still
updated passage statistics. An unchanged failure fraction is not an absent write.
Arithmetic agreement does not establish that every causal attribution was correct.

A concrete executed chain is tactical experience suffix `481`:

- Started at 76.470, sequence 246, selected `attack`.
- Issued nonzero commands for that decision, including sequence 249 at 76.635.
- Finalized at 78.570, sequence 262, with reward `-0.022399999618530272`.
- Tactical and profile values changed from `-0.0657567993133545` to
  `-0.05708543937438965`, with their own update records at sequences 263 and 261.

This is real evidence that active learning reaches parameter updates. It is not
evidence of improved navigation or uncontaminated historical knowledge.

## Substitution and expected non-updates

| Learner | Controller | Reason | Superseded experiences |
| --- | --- | --- | ---: |
| Movement | precision | braking_or_unsafe_support | 30 |
| Movement | command_gate | role_changed | 1 |
| Tactical | damage_guard | head_protection | 6 |
| Tactical | melee | melee_requires_approach | 2 |

Supersession affects **31/72 (43.06%)** of finalized movement experiences and
**8/41 (19.51%)** of finalized tactical experiences. These count experiences,
not unique braking incidents; one cancellation can settle several pending IDs.

Movement's 33 non-updates consist of 31 substitutions and two unknown
interruptions (`stage_failed_without_action_evidence`). Tactical's 15 consist
of eight substitutions and seven zero-reward episodes. These follow the current
contracts. No evaluation-mode suppression or buffer-capacity eviction occurred
inside this active window. No unexplained lifecycle loss was found.

The movement substitution rate is a concrete coverage concern worth investigating.
It does not alone prove excessive protection: it neither measures the duration
of intervention nor tells whether the selected action was sufficiently executed.

## Consequences without attribution

| Learner | Reason | Records | Environmental incident receipts |
| --- | --- | ---: | ---: |
| Movement | departure_without_recent_command | 1 | 1 |
| Tactical | no_issued_tactical_execution | 1 | 0 |

The tactical record is damage reward `-0.004125` at 130.740 for episode suffix
`672`, before its first issued tactical execution. Its absence of learning is
expected. These two records are different observations; they are not two falls.

## Manual fall, detection and timing

The observer confirmed that the two in-window F8 marks represented **the same
physical fall**. The original marks are preserved, and an explicit `DuplicateOf`
annotation groups suffix `572` under suffix `589`. No match was inferred from
a time threshold. An earlier manual marker at 62.610 is outside the audit window
and is excluded.

| Measurement | Count |
| --- | ---: |
| Raw in-window manual marks | 2 |
| Observer-confirmed physical falls | 1 |
| Reviewed observed falls with a detector receipt | 1 |
| Reviewed observed falls attributed to local movement | 0 |
| Reviewed observed falls without detection | 0 |

The detected receipt is `1792347058-9b1f984a8d57f49f:damage:87`, with 5,000 applied
damage. Its local attribution reason is `departure_without_recent_command`.
The observer has not independently established exhaustive visual coverage of
every moment; the counts above describe the confirmed observation, not a proven
worldwide detector recall rate or evidence that only one physical fall occurred.

| Recorded event | Engine time | Sequence |
| --- | ---: | ---: |
| Last local attempt(s) superseded by precision before the fall | 97.455 | 492–493 |
| Last retained nonzero input record before departure, with empty movement ID | 99.585 | 512 |
| First manual mark, later confirmed as a duplicate of this fall | 99.840 | 514 |
| Last retained pre-departure input record: zero input, empty movement ID | 101.055 | 520 |
| Observed ground-to-air transition, no owner | 102.240 | 521 |
| Applied fall damage and unattributed local consequence | 103.320 | 524–525 |
| Tactical death finalization and update, episode suffix 575 | 103.320 | 527–528 |
| Second manual mark | 104.220 | 539 |

Observed departure to damage is **1.080 seconds**; damage to tactical finalization
is **0 seconds at the recorded clock resolution**. The last retained zero-input
record precedes departure by 1.185 seconds; the last retained nonzero input
record precedes it by 2.655 seconds. Execution records are coalesced, so neither
is proof of the last actual ground command. There is **no known owned ground-command
timestamp and no local fall-experience finalization to time**. Those intervals
are unknown, not zero. Manual marks do not define the physical departure instant.

The full active window contains 258 coalesced execution rows, 65 with no local
experience ID, including 27 nonzero-input rows. These are record counts, not
tick counts or time fractions. Precision could command movement while no local
attempt existed. Thus “no recent command” here must not be read as “the motor
issued no commands.” Missing ownership is sufficient to reject local blame;
this case does not establish that the time window itself was too short.

The death was still learned by tactical/profile episode suffix `575`: selected
`retreat`, `Executed=true`, total reward `-2`, values `0 -> -0.2`. Its retained
input rows near departure are zero input. The execution flag proves the adapter
accepted commands; it does **not** establish physical withdrawal. Whether this
death credit is appropriate requires a closer execution/physics observation.
Do not equate the verified arithmetic with proven tactical causal correctness.

## Conclusion and next validation

Active updates work in the engine for movement, tactics, profile and passage
statistics. This sample shows substantial precision-related local supersession
and one detected fall without local ownership. It does not justify blaming the
latest action, widening windows, changing rewards or disabling safety controls.

The next required test is the same training fixture with `zp_bot_evaluation 1`:
require executed commands, known finalized outcomes, unchanged parameter values,
and zero learner writes. That engine test is **pending**. Place and boost need
their own exercised outcomes before claiming engine validation for them.

No runtime, controller, reward or timing-window change was made while analyzing
this capture. The offline analyzer gained explicit observer-confirmed duplicate
annotation support; 11 focused analysis tests passed, including that regression.

Local evidence is retained under
`.tools/learning-session-captures/20261018-150714-998/active/`:
`console.log`, `learning-trace-v1.json`, `capture-manifest.json`,
`manual-matches.json`, `report-reviewed.json`, and `verified-updates.json`.
These local capture files are ignored by Git. The pre-training knowledge copy is
in the parent directory. No knowledge reset or migration was performed.
