interface PopulationClientContract { Start(): void; Stop(): void; Tick(): void; State(): ZPBotPopulationState; }
export class BotPopulationClient implements PopulationClientContract {
    private opened = false;
    private snapshot: ZPBotPopulationSnapshot | undefined;
    private enabled = false;
    private target = 0;
    private nextPoll = 0;
    private sequence = 0;
    private pending: { ID: number; Save: boolean; Deadline: number } | undefined;
    private feedback = "";
    constructor(private changed: ZPAction) {}
    private Allowed(): boolean { const ply = LocalPlayer(); return IsValid(ply) && ply.IsSuperAdmin() && !game.SinglePlayer(); }
    State(): ZPBotPopulationState {
        return { ...(this.snapshot ? { Snapshot: { ...this.snapshot } } : {}), Enabled: this.enabled, Target: this.target,
            Pending: this.pending !== undefined, Dirty: this.snapshot !== undefined && (this.snapshot.Enabled !== this.enabled || this.snapshot.Target !== this.target), Feedback: this.feedback };
    }
    Start(): void { this.opened = true; this.snapshot = undefined; this.feedback = ""; this.Request(false); }
    Stop(): void { this.opened = false; this.pending = undefined; }
    SetEnabled(enabled: boolean): void { if (this.opened && this.Allowed() && !this.pending && this.snapshot) { this.enabled = enabled; this.changed(); } }
    SetTarget(target: number): void {
        if (!this.opened || !this.Allowed() || this.pending || !this.snapshot || typeof target !== "number" ||
            !(target >= 0 && target <= this.snapshot.Limit) || target % 1 !== 0) return;
        this.target = target; this.changed();
    }
    Save(): void { if (this.State().Dirty) this.Request(true); }
    private Request(save: boolean): void {
        if (!this.opened || !this.Allowed() || this.pending || (save && !this.snapshot)) return;
        this.sequence = this.sequence % 2147483647 + 1;
        this.pending = { ID: this.sequence, Save: save, Deadline: CurTime() + 5 };
        net.Start("ZPBotPopulationRequest"); net.WriteUInt(1, 8); net.WriteUInt(save ? 1 : 0, 1); net.WriteUInt(this.sequence, 31);
        if (save && this.snapshot) { net.WriteUInt(this.snapshot.Revision, 31); net.WriteBool(this.enabled); net.WriteUInt(this.target, 7); }
        net.SendToServer(); this.nextPoll = CurTime() + 1; this.changed();
    }
    Receive(length: number): void {
        if (!this.opened || !this.pending || length !== 119) return;
        const version = net.ReadUInt(8), id = net.ReadUInt(31), code = net.ReadUInt(2);
        if (version !== 1 || id !== this.pending.ID || code > 2) return;
        const state: ZPBotPopulationSnapshot = { Revision: net.ReadUInt(31), Enabled: net.ReadBool(), Target: net.ReadUInt(7), Limit: net.ReadUInt(7),
            Humans: net.ReadUInt(8), Bots: net.ReadUInt(8), Connecting: net.ReadUInt(8), Free: net.ReadUInt(8) };
        if (state.Revision < 1 || state.Limit > 64 || state.Target > state.Limit || state.Humans + state.Bots > 128 || state.Connecting > 128 || state.Free > 128) return;
        const dirty = this.State().Dirty;
        if ((!dirty && !this.pending.Save) || code === 1 || !this.snapshot) { this.enabled = state.Enabled; this.target = state.Target; }
        this.snapshot = state; this.pending = undefined;
        this.feedback = code === 2 ? "zombieplague.adminerror" : code === 1 ? "zombieplague.adminsaved" : this.feedback;
        this.changed();
    }
    Tick(): void {
        if (!this.opened) return;
        if (!this.Allowed()) { this.Stop(); this.changed(); return; }
        if (this.pending && CurTime() >= this.pending.Deadline) { this.pending = undefined; this.feedback = "zombieplague.weaponmenutimeout"; this.changed(); }
        if (!this.pending && CurTime() >= this.nextPoll) this.Request(false);
    }
}
