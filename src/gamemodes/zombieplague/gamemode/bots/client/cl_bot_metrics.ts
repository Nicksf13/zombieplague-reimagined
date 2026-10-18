interface MetricsClientContract { Start(): void; Stop(): void; Tick(): void; Page(direction: number): void; }
export class BotMetricsClient implements MetricsClientContract {
    private active = false;
    private snapshot: ZPBotMetricsSnapshot | undefined;
    private pending: { ID: number; Deadline: number } | undefined;
    private page = 0;
    private sequence = 0;
    private nextPoll = 0;
    constructor(private update: (this: void) => void) {
        net.Receive("ZPBotMetricsReply", length => {
            if (!this.active || length > 524000) return;
            const reply = ZPBotMetricsProtocol.Snapshot(net.ReadTable());
            if (!reply || reply.RequestID !== this.pending?.ID || reply.Page !== this.page) return;
            const ply = LocalPlayer();
            if (!IsValid(ply) || !ply.IsAdmin()) { this.Stop(); return; }
            this.pending = undefined; this.snapshot = reply; this.update();
            if (this.page > 0 && reply.Total <= this.page * 16) { this.page = Math.max(0, Math.ceil(reply.Total / 16) - 1); this.nextPoll = 0; }
        });
    }
    State(): { BotMetrics?: ZPBotMetricsSnapshot; BotMetricsLoading: boolean; } {
        const snapshot = this.snapshot;
        return snapshot ? { BotMetricsLoading: this.pending !== undefined, BotMetrics: { ...snapshot,
            Rows: snapshot.Rows.map(row => {
                const copy = { ...row, Scope: { ...row.Scope }, Totals: ZPBotMetricsProtocol.Totals(row.Totals) ?? ZPBotMetricsProtocol.Empty() };
                const decision = ZPBotMetricsProtocol.Decision(row.Decision);
                if (decision) copy.Decision = decision;
                const motion = ZPBotMotionProtocol.Diagnostic(row.Motion);
                if (motion) copy.Motion = motion;
                const place = ZPBotPlaceProtocol.Diagnostic(row.Place); if (place) copy.Place = place;
                return copy;
            }) } } :
            { BotMetricsLoading: this.pending !== undefined };
    }
    Start(): void { this.active = true; this.page = 0; this.nextPoll = 0; this.Tick(); }
    Stop(): void { this.active = false; this.pending = undefined; this.snapshot = undefined; }
    Page(direction: number): void {
        if (!this.active || this.pending || !this.snapshot || (direction !== 1 && direction !== -1)) return;
        this.page = Math.max(0, Math.min(Math.max(0, Math.ceil(this.snapshot.Total / 16) - 1), this.page + direction));
        this.nextPoll = 0; this.Tick();
    }
    Tick(): void {
        if (!this.active) return;
        const ply = LocalPlayer();
        if (!IsValid(ply) || !ply.IsAdmin()) { this.Stop(); return; }
        if (this.pending && CurTime() >= this.pending.Deadline) { this.pending = undefined; this.update(); }
        if (this.pending || CurTime() < this.nextPoll) return;
        this.sequence = this.sequence % 2147483647 + 1;
        this.pending = { ID: this.sequence, Deadline: CurTime() + 5 }; this.nextPoll = CurTime() + 1;
        net.Start("ZPBotMetricsRequest"); net.WriteUInt(1, 8); net.WriteUInt(this.sequence, 31); net.WriteUInt(this.page, 2); net.SendToServer();
        this.update();
    }
}
