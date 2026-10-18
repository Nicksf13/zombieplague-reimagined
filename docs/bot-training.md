# AI training sessions

In Garry's Mod, select **Start New Game**, choose **Zombie Plague**, select a map,
and enable **Train AI** in the gamemode options. Set **Training bot count** to the
desired number (2–64, default 2). Start a local multiplayer server with enough
slots for the bots plus all observers (for example, eight slots for six bots and
one observer). Native NextBots
cannot be created in singleplayer. The training checkbox is therefore available
only in the multiplayer options. A navigable map/navmesh is still required for
normal bot movement.

`zp_bot_training 1` keeps real players in spectator mode and maintains the number
of managed bots requested by `zp_bot_training_count`. The server floors fractional
counts and clamps them to 2–64 and available engine/AI capacity. Raising the count
creates additional bots; lowering it saves learning and removes only excess
managed bots, including when kicks complete asynchronously. Automatic population
filling is suspended without changing its saved
preferences. Connecting clients still consume capacity; unrelated third-party
bots are not removed. Insufficient capacity produces the existing localized
bot-capacity notice and fills the available slots. Fewer than two available bot
slots does not create a lone bot. The service retries when slots become available.

Training uses the standard infection round: one initial zombie and the remaining
bots as humans. It requires
two participants regardless of the normal minimum, skips freeze and infection
countdowns, and uses 0.1-second preparation/restart/intermission delays. Round
duration remains configured normally. The map stays active after the usual round
limit so training can continue.

AI decisions and learning are enabled for the session; their previous convar values
are restored when training is disabled. Normal round timing convars are never
rewritten. Existing per-bot learning and shared cross-map persistence continue to
apply. Disabling training leaves the bots present and observers can join again
using the regular participation controls.

Automated checks simulate the server lifecycle. Menu rendering, spectator cameras,
bot combat, and map navigation still require validation inside Garry's Mod.
