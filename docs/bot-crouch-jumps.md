# Crouch-jump learning

Bots can select `jumpduck` alongside ordinary jumping and walking. The action
is offered for nearby traversal jumps or detected obstacles, with the same
learning gate, exploration rules and outcome accounting as other movements.
It is not offered during precision walking, controlled drops, swimming or
ladder climbing. Clear ground does not trigger exploratory jumping.

## Candidate validation

Reach estimates use the player's live jump power, gravity and standing/duck
hulls. The existing conservative ballistic estimate gains at most 36 units of
standing-to-duck hull-height difference for candidate routing. Pathfinding,
place discovery, reachable-place checks, search and local navigation use the
same reach helper. Connections still require the existing navmesh graph.

This models the origin adjustment when crouching in the air, as implemented in
the reference Source SDK's
[`CGameMovement::FinishDuck`](https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/game/shared/gamemovement.cpp).
It is a planning allowance, not proof of Garry's Mod traversal. The bot never
sets its position, velocity, jump power or collision rules to perform the move.

Before offering the action, the planner checks standing takeoff headroom, a
raised duck-hull forward sweep, landing support, landing height and support
normal. A player cannot serve as the landing surface for this action;
cooperative boosts retain their own controller. A ground passage that already
requires ducking does not offer this standing-launch sequence. Ordinary jump
candidates also reject landing support above their estimated jump reach.
These bounded local probes do not simulate the full airborne trajectory;
the engine's movement and collision remain authoritative.

## Input sequence and lifecycle

The motor initially issues one ordinary jump press while standing. Only an
actually issued `jumpduck` launch arms the airborne crouch sequence. Once the
player leaves the ground, the controller holds duck through normal user-command
input. The sequence survives plan renewal and route replanning without issuing
additional air jumps. It releases on landing, water/ladder entry, command gating,
reset or a two-second safety deadline. If no takeoff is observed within 0.2
seconds, it cancels without forcing crouch on the ground.

The existing launch budget applies: at most two attempts at the same location,
at least 0.8 seconds apart, followed by a three-second retry delay. Replanning
does not reset this budget. Movement of more than 64 units permits a new budget.

## Learning and diagnostics

`jumpduck` estimates use their own action suffix. Old action estimates and
passage records retain their keys and load normally. The action is appended to
the diagnostic action list so existing value positions stay unchanged; older
15-value diagnostic snapshots receive a zero for the added action. The HUD
composes its label from the existing localized jump and duck phrases.

Positive partial progress remains pending until a checkpoint is confirmed.
An airborne position alone does not establish success. Repeated attempts
without progress receive no positive reinforcement; existing failure, harm,
external-displacement and learning-freeze rules still apply. Incident recordings
expose `Move: jumpduck`, jump-reason metadata and the actual button sequence.

## Validation

Local regressions cover elevated ledges, headroom, excessive height, missing
support, excluded movement modes, issued-input sequencing through plan renewal,
landing release, routing, saved estimates, old diagnostics and unsuccessful
trials. The build generated 420 Lua 5.1 files; type checking and all 790 tests
passed. `git diff --check` passed. These tests simulate GMod and cannot certify
a particular map ledge. No external installation or engine match was performed.
After installing the built gamemode, record attempts at reachable and
unreachable ledges and verify actual grounded entry into the destination area.
