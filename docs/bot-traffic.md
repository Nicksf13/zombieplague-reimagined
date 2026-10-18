# Allied passage negotiation

One `BotTrafficManager` belongs to the server bot controller. A blocked bot can
request passage from another living managed bot on the same team. Human players,
opponents, frozen/airborne bots, ladders, water and active cooperative boosts are
not controlled by this handshake. It sends no player chat messages.

For head-on requests the lower saved identity has priority. A bot following a
leader moving in the same direction waits instead of requesting a reverse move.
Each participant belongs to at most one reservation, preventing reciprocal
priority changes and multi-bot request cycles. Reservations expire after twelve
seconds and clear on death, role/scope changes, removal, freeze or AI shutdown.

The yielder first searches for supported side space, then for a wider section up
to 128 units behind its approach. A two-leg retreat/side move avoids cutting
diagonally through a wall or off a narrow beam. Every leg requires floor support
and full hull clearance. The passer waits until the yielder reaches its parking
point, then resumes. The yielder waits until the passer is beyond it by a hull
width plus sixteen units. If no safe parking space exists, ordinary waiting and
navigation remain in effect; collision is never disabled.

Yield movement is paced at 48 units/s and passes through the precision motor's
per-command safety and braking checks. Locomotion trials are cancelled for
negotiated motion, so yielding cannot teach a failed tactical retreat or a
permanent passage failure. Normal navigation resumes after release. The existing
unreachable-path logic still handles routes that genuinely cannot be traversed.

Simulated regressions cover priority, reciprocal and three-bot requests, narrow
beams with a wider bay, changing support, following traffic and lifecycle cleanup.
Actual crowd contact and throughput require validation in Garry's Mod.
