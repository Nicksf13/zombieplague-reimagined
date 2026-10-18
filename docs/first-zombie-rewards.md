# First zombie health reward

The normal infection round (`SimpleRound`) fires the server hook
`ZPFirstZombieEvent` with the selected player immediately after `Infect()` sets
their zombie class health. Both random selection and an explicitly selected
first zombie use this path.

| Server convar | Default | Behavior |
| --- | --- | --- |
| `zp_first_zombie_reward_mode` | `1` | `0`: disabled; `1`: per alive human; `2`: fixed bonus. Other values disable the reward. |
| `zp_first_zombie_reward_health` | `250` | Health added per alive human in mode `1`, or once in mode `2`. |

For example, a zombie class with 2,000 HP facing four alive humans
starts with 3,000 HP using the defaults. Dead players and spectators do not count.
As with the last zombie reward, the bonus increases current health only; it does
not change the class maximum health or its regeneration cap.

The reward applies once when the normal round selects its first zombie. Regular
infections, respawns, multi-infection rounds, and special rounds do not grant it.
It is independent of `zp_last_zombie_reward_mode` and
`zp_last_zombie_reward_health`. The existing last zombie hooks remain unchanged:
a later death or cure leaving one zombie can still grant that reward, even if
the survivor was the first zombie.
