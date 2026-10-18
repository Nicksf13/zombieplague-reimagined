interface MetricsServiceContract { Receive(length: number, ply: ZPServerPlayer): void; Remove(ply: ZPPlayer): void; }
export class BotMetricsService implements MetricsServiceContract {
    private requests: Record<string, number | undefined> = {};
    constructor(private bots: ZPBotManager) {}
    Receive(length: number, ply: ZPServerPlayer): void {
        if (length !== 41 || !IsValid(ply) || !ply.IsAdmin()) return;
        const id = ply.SteamID64();
        if (CurTime() < (this.requests[id] ?? 0)) return;
        this.requests[id] = CurTime() + 0.75;
        const version = net.ReadUInt(8), requestID = net.ReadUInt(31), page = net.ReadUInt(2);
        if (version !== 1 || requestID < 1) return;
        net.Start("ZPBotMetricsReply");
        net.WriteTable(this.bots.Diagnostics(page, requestID));
        net.Send(ply);
    }
    Remove(ply: ZPPlayer): void { delete this.requests[ply.SteamID64()]; }
}
