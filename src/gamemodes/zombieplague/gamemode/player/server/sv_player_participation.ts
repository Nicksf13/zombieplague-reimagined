const { enterSpectator } = include("sv_player_spectator.lua") as typeof import("./sv_player_spectator");
interface ParticipationContract { Spectate(ply: ZPServerPlayer, args: string[]): void; Join(ply: ZPServerPlayer, args: string[]): void; }
export class PlayerParticipation implements ParticipationContract {
    private nextRequest = new Map<ZPPlayer, number>();
    constructor(private rounds: ZPServerRoundManager) {}
    private Accept(ply: ZPServerPlayer, args: string[]): boolean {
        if (!IsValid(ply) || !ply.IsPlayer() || args.length !== 0 || CurTime() < (this.nextRequest.get(ply) ?? 0)) return false;
        this.nextRequest.set(ply, CurTime() + 2);
        return true;
    }
    Spectate(ply: ZPServerPlayer, args: string[]): void {
        if (!this.Accept(ply, args) || ply.Team() === TEAM_SPECTATOR) return;
        // Opt-out survives round preparation and repeated server-status requests.
        enterSpectator(ply, this.rounds);
        SendPopupMessage(ply, { Phrase: "zombieplague.participationspectating" });
    }
    Join(ply: ZPServerPlayer, args: string[]): void {
        if (cvars.Bool("zp_bot_training", false) || !this.Accept(ply, args) || ply.Team() !== TEAM_SPECTATOR) return;
        ply.ZPVoluntarySpectator = false;
        this.rounds.AddPlayerToPlay(ply);
        // Joining never grants an extra life during rounds that forbid respawn.
        const spawn = PlayerCanSpawn(ply);
        if (spawn && !ply.Alive()) ply.Spawn();
        SendPopupMessage(ply, { Phrase: "zombieplague.participation" + (spawn ? "joined" : "queued") });
    }
    Forget(ply: ZPPlayer): void { this.nextRequest.delete(ply); }
}
const participation = new PlayerParticipation(RoundManager as ZPServerRoundManager);
concommand.Add("zp_spectate", (ply, _command, args) => participation.Spectate(ply, args));
concommand.Add("zp_join", (ply, _command, args) => participation.Join(ply, args));
hook.Add("PlayerDisconnected", "ZPParticipationCleanup", ply => participation.Forget(ply));
