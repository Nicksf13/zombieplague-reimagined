# Short real-session attribution audit

## Collection status

A real active-learning session has now been collected and analyzed; see the
[2026-10-18 active result](bot-learning-session-2026-10-18.md). The frozen engine
phase is still pending. The following initial inspection records the earlier
absence of evidence; it must not be interpreted as the current active status.

On 2026-10-18, inspection of the installed
`garrysmod/data/zombieplague/bots/` found no `diagnostics/` directory, no exported
learning trace, and no running Garry's Mod/dedicated server process. Existing
movement memories and statistics timelines predate this capture. They aggregate
outcomes and cannot reconstruct individual experience lifecycles or causal times.

There is therefore no real-session discard rate, manually verified fall count,
or command/departure/fall timing measurement to report yet. Missing evidence is
not a zero count. Neither active learning nor frozen evaluation has been verified
in the engine by this audit. The older evaluation document was a procedure, not
a record of an executed game test.

| Requested measurement | Existing trace support | Narrow diagnostic addition |
| --- | --- | --- |
| Created/finalized by outcome | Start/finalize IDs and outcomes | End marker snapshots confirm which IDs remain pending. |
| Updates by learner | Update IDs plus finalize's Updated flag | Effective learning/evaluation mode on every row; count their union once. |
| Superseded by controller/reason | Tactical finalizations have the controller; movement only had a generic cancellation label | Movement finalization includes Controller and InterventionReason. |
| Unattributed consequences by reason | Unattributed records | Incident receipts connect environmental limitations to detected events. Buffer-limit notices remain separate. |
| Manual/detected/attributed falls | No independent manual observation or separate detection event | Explicit fall detection records, optional observer markers and reviewed receipt matches. |
| Command/departure/fall/finalization times | Throttled command rows and finalization times; no departure timestamp | Last actual ground-command time and observed ground-to-air time accompany departure/fall records. |

These additions are diagnostic only. Rewards, causality eligibility, temporal
windows, action selection, navigation and controller behavior are unchanged.
`stale_flight_before_damage` describes an existing rejected ownership check;
it does not extend the acceptance window. Tracing remains off by default.

The previous trace covered tactical, profile and local movement only. The audit
also records existing passage-statistics updates and place/boost lifecycles,
without changing their update conditions. Passage records describe derived
statistics; their Before/After scalar is the failure fraction, not a Q value.
Boost updates belong to the climber's learning context and are not duplicated
for the supporting bot. No observed update of a learner is not proof that it
was exercised by the session.

## Capture both an active and a frozen phase

Use an isolated multiplayer test copy and preserve its knowledge before testing.
Keep the same build, map/NAV, movement rules, classes, bot count and observer
between phases. Two training bots and one human spectator are sufficient. The
first audit follows identity **1** only; it does not extrapolate to the other bot.
Observe that bot across role changes and record its role in each relevant case.

1. Restart GMod with the `-condebug` launch option. Check both
   `garrysmod/console.txt` and `garrysmod/console.log`; the real capture on this
   installation wrote `console.log`. This preserves existing `[ZP learning]` records
   to survive the 512-row export ring. See the official
   [GMod console-variable reference](https://wiki.facepunch.com/gmod/ConVars_In_Garrysmod).
   `con_logfile` is removed, as documented in the
   [blocked-command reference](https://wiki.facepunch.com/gmod/Blocked_ConCommands);
   do not use it for this capture.
2. Start a local multiplayer server on the chosen training map. Ensure the local
   gamemode build is loaded and the matching Workshop copy is disabled.
3. In the server console, set:

   ```text
   zp_bot_training_count 2
   zp_bot_stats_cohort trained
   zp_bot_evaluation 0
   zp_bot_learning 1
   zp_bot_training 1
   zp_bot_learning_trace_bot 1
   zp_bot_learning_trace 1
   ```

   Wait until the two bots are active and confirm identity 1 in diagnostics. Then:

   ```text
   zp_bot_learning_trace_mark 1 active_start
   ```

4. Observe for 60 seconds. Every time identity 1 actually falls, issue
   `zp_bot_learning_trace_mark 1 manual_fall`. This is a human report, independent
   of the damage detector. An unused key may be bound to this command after
   preserving its previous binding. Record a video or observer notes, including
   falls without damage, pushes and interruptions. Marker time includes human
   reaction delay; never substitute it for the physical fall time.
5. End the active observation without resetting bots or forcing finalization:

   ```text
   zp_bot_learning_trace_mark 1 active_end
   zp_bot_learning_trace_export
   ```

   The marker records the actual open tactical/movement/place/boost IDs. A pending positive
   balance or an unsettled flight remains pending; ending the observation cannot
   convert it into a discarded experience. Export before turning tracing off.
6. Keep the same training fixture. Set `zp_bot_evaluation 1`, wait until the next
   controller update, and issue `zp_bot_learning_trace_mark 1 evaluation_start`.
   Leave `zp_bot_learning 1`; evaluation must independently inhibit updates and
   exploration. Observe another 60 seconds with the same manual-fall procedure.
7. End with `zp_bot_learning_trace_mark 1 evaluation_end`, export again, and set
   `zp_bot_learning_trace 0`. Preserve `console.txt` under a distinct filename
   before another run. The export path is
   `data/zombieplague/bots/diagnostics/learning-trace-v1.json`; successive exports
   overwrite that one diagnostic file, not learned knowledge.

The marker command is server-console/superadmin only. It reads pending IDs and
emits a trace row; it does not clear, finish, reward or pause an experience.
For multiple observed bots, set the filter to zero and mark each bot separately.

## Generate and review the report

Run from the repository, substituting the captured console path:

```powershell
.\.tools\node-v24.21.0-win-x64\node.exe scripts/analyze-bot-learning-session.mjs "C:\capture\console.txt" active - 1
.\.tools\node-v24.21.0-win-x64\node.exe scripts/analyze-bot-learning-session.mjs "C:\capture\console.txt" evaluation - 1
```

An exported trace JSON can replace the console file if it retains both markers
and all records between them. Sequence gaps or missing boundary markers prevent
a completeness claim. The analyzer chooses the latest completed marked phase
for that bot; preserve individual capture files for multiple-session analysis.
The `all` mode can inspect older exports, but cannot confirm pending state from
missing endings without a boundary snapshot.

Review each manual marker against video/notes and the fall receipts/times. Save
an explicit annotation file, for example:

```json
[
  { "Manual": "actual-marker-experience-id", "Incidents": ["actual-damage-receipt-id"] },
  { "Manual": "another-reviewed-marker-id", "Incidents": [] }
]
```

An empty incident list means a reviewed manual fall had no detector receipt;
an absent annotation means not yet reviewed. Multiple damage receipts from one
physical fall may belong to one manual marker. The analyzer rejects receipt reuse
across different falls and never guesses a match using a time window. Rerun with
the annotation filename in place of `-` to obtain the manual/detected/attributed
comparison. Zero manual markers means missing manual evidence, not zero falls.

If the observer confirms repeated presses for one physical fall, keep the raw
markers and annotate the additional press as
`{ "Manual": "duplicate-marker-id", "DuplicateOf": "reviewed-primary-marker-id" }`.
The primary must have its reviewed `Incidents` list. A duplicate may precede the
primary in time; only explicit observer confirmation permits grouping. The report
keeps raw marker count separate from distinct physical fall count.

Report the following for each phase:

- Created and finalized counts/outcomes per learner; finalizations whose start
  predates capture; confirmed pending IDs; incomplete records of unknown status.
- Unique updated experiences and actual value changes per learner. Tactical and
  profile may share an experience ID but update different estimates. Profile has
  no independent start/finalize lifecycle, so zero profile starts is expected.
  Passage statistics also have no independent lifecycle; count their explicit
  writes separately. Place visits and boost pairs have start/finalize records.
- Superseded finalizations by learner/controller/reason. The denominator of the
  displayed supersession rate is finalized experiences, never all created IDs.
- Unattributed consequence records by reason, with distinct environmental receipt
  counts. These are observations/components, not necessarily distinct deaths or
  physical falls. Buffer-capacity notices are reported separately.
- Manual observations, reviewed matches, unreviewed observations, detected damage
  events and attributed events. A detected fall is not automatically attributed
  or trained; a physical fall without applied fall/pit damage may be undetected.
- Raw command/departure/detection/finalization times and their deltas, alongside
  IDs, role, limitation and update flag. Departure is the first observed air
  frame, not an exact sub-tick physics timestamp. Null means unknown, not zero.

An expected non-update includes frozen evaluation, disabled learning, a genuinely
superseded action, an unknown interruption, a tactical decision never executed,
or zero tactical reward. Confirmed earlier consequences can still update when
an episode later ends with an interruption. Randomly forced tactical exploration
can update its action without establishing a profile outcome. ProfileEligible
on tactical finalization makes that distinction visible. A converged estimate
can receive an update with identical before/after values. None of these cases is
automatically a defect or evidence that too much experience is discarded.

## Pass evidence, not assumptions

Active phase: require executed commands, attributable known outcomes and at least
one `Updated=true` record in effective learning mode. Inspect matching IDs and
reward components/before/after values for representative normal, late-fall and
intervention cases. Show value-changing updates separately from converged writes.
If no eligible outcome occurred, the test is inconclusive; do not change rewards
to manufacture one.

Frozen phase: require a complete evaluation window, executed input and known
nonzero outcomes with `Updated=false` and unchanged values. There must be no
parameter update in that phase. A silent or empty trace is inconclusive. The
analyzer exposes these conditions separately and does not infer navigation
improvement from successful parameter writes.

Local regression tests in `bot-learning-session.test.mjs` and
`bot-learning-session-analysis.test.mjs` validate diagnostic ownership/timing,
snapshot neutrality, receipt uniqueness, active/frozen adapter behavior,
counting, partial captures and explicit manual matching. They simulate GMod.
The active real-session result is recorded separately. The full two-phase audit
remains pending until the frozen capture and its independent observations are
collected.

Local validation on 2026-10-18 passed the full server/client/test type checks,
rebuilt 369 Lua files and passed all 555 tests. Fifteen added regressions cover
the new audit instrumentation and analyzer; the focused run passed 56 tests.
These are local simulator results, not a real training-session measurement.
