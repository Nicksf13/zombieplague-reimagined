export class RoundManager implements ZPSharedRoundManager {
    SetSpecialRound(specialRound: boolean): void {
        SetGlobalBool("SpecialRound", specialRound);
    }
    SetRespawn(respawn: boolean): void {
        SetGlobalBool("Respawn", respawn);
    }
    SetRound(round: number): void {
        SetGlobalInt("Round", round);
    }
    SetRoundState(state: ZPRoundState): void {
        SetGlobalInt("RoundState", state);
    }
    IsSpecialRound(): boolean {
        return GetGlobalBool("SpecialRound", false);
    }
    IsRespawn(): boolean {
        return GetGlobalBool("Respawn", false);
    }
    GetRound(): number {
        return GetGlobalInt("Round", 0);
    }
    GetRoundState(): ZPRoundState {
        // Values are written by SetRoundState; the engine exposes them as numbers.
        return GetGlobalInt("RoundState", ROUND_WAITING_PLAYERS) as ZPRoundState;
    }
    IsPlayingRound(): boolean {
        return this.GetRoundState() === ROUND_PLAYING;
    }
    IsRealisticMod(): boolean {
        return cvars.Bool("zp_realistic_mode", false);
    }
    LastHuman(): boolean {
        let count = 0;
        for (const ply of team.GetPlayers(TEAM_HUMANS)) {
            if (ply.Alive()) {
                count++;
                if (count > 1)
                    return false;
            }
        }
        return count === 1;
    }
    LastZombie(): boolean {
        let count = 0;
        for (const ply of team.GetPlayers(TEAM_ZOMBIES)) {
            if (ply.Alive()) {
                count++;
                if (count > 1)
                    return false;
            }
        }
        return count === 1;
    }
    NoHumans(): boolean {
        for (const ply of team.GetPlayers(TEAM_HUMANS)) {
            if (ply.Alive())
                return false;
        }
        return true;
    }
    NoZombies(): boolean {
        for (const ply of team.GetPlayers(TEAM_ZOMBIES)) {
            if (ply.Alive())
                return false;
        }
        return true;
    }
    CountHumansAlive(): number {
        let count = 0;
        for (const ply of team.GetPlayers(TEAM_HUMANS)) {
            if (ply.Alive())
                count++;
        }
        return count;
    }
    CountZombiesAlive(): number {
        let count = 0;
        for (const ply of team.GetPlayers(TEAM_ZOMBIES)) {
            if (ply.Alive())
                count++;
        }
        return count;
    }
    GetAliveHumans(): ZPPlayer[] {
        const aliveHumans: ZPPlayer[] = [];
        for (const ply of team.GetPlayers(TEAM_HUMANS)) {
            if (ply.Alive())
                aliveHumans.push(ply);
        }
        return aliveHumans;
    }
    GetAliveZombies(): ZPPlayer[] {
        const aliveZombies: ZPPlayer[] = [];
        for (const ply of team.GetPlayers(TEAM_ZOMBIES)) {
            if (ply.Alive())
                aliveZombies.push(ply);
        }
        return aliveZombies;
    }
    GetAlivePlayers(): ZPPlayer[] {
        const alivePlayers = this.GetAliveHumans();
        for (const ply of this.GetAliveZombies()) {
            alivePlayers.push(ply);
        }
        return alivePlayers;
    }
}
const roundManager = new RoundManager();
_G.RoundManager = roundManager;
