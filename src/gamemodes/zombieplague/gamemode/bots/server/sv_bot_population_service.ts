import type { BotPopulation } from "./sv_bot_population";
interface PopulationServiceContract { Receive(length: number, ply: ZPServerPlayer): void; Disconnect(ply: ZPPlayer): void; }
export class BotPopulationService implements PopulationServiceContract {
    private requests = new Map<string, number>();
    constructor(private population: BotPopulation) {}
    Disconnect(ply: ZPPlayer): void { this.requests.delete(ply.SteamID64()); }
    Receive(length: number, ply: ZPServerPlayer): void {
        if ((length !== 40 && length !== 79) || !IsValid(ply) || !ply.IsSuperAdmin() || ply.IsBot()) return;
        const version = net.ReadUInt(8), action = net.ReadUInt(1), requestID = net.ReadUInt(31);
        if (version !== 1 || requestID < 1 || (action === 0 && length !== 40) || (action === 1 && length !== 79)) return;
        let code = 0;
        const id = ply.SteamID64();
        if (CurTime() < (this.requests.get(id) ?? 0)) code = 2;
        else {
            this.requests.set(id, CurTime() + 0.25);
            if (action === 1) {
                const revision = net.ReadUInt(31), enabled = net.ReadBool(), target = net.ReadUInt(7);
                const current = this.population.Snapshot();
                if (revision !== current.Revision || target > current.Limit || (enabled && (game.SinglePlayer() || !BOT_MODE || current.Limit === 0)) || !this.population.Config.Apply(enabled, target)) code = 2;
                else { code = 1; this.population.Tick(); }
            }
        }
        const state = this.population.Snapshot();
        net.Start("ZPBotPopulationReply"); net.WriteUInt(1, 8); net.WriteUInt(requestID, 31); net.WriteUInt(code, 2);
        net.WriteUInt(state.Revision, 31); net.WriteBool(state.Enabled); net.WriteUInt(state.Target, 7); net.WriteUInt(state.Limit, 7);
        net.WriteUInt(state.Humans, 8); net.WriteUInt(state.Bots, 8); net.WriteUInt(state.Connecting, 8); net.WriteUInt(state.Free, 8); net.Send(ply);
    }
}
