export class AdminRoundsClient implements ZPAdminRoundsClient {
    private entries: ZPAdminRoundEntry[] = [];
    private feedback = "";
    private sequence = 0;
    private pending: { ID: number; Deadline: number; } | undefined;
    private active = false;
    private nextRefresh = 0;
    constructor(private changed: ZPAction) {}

    State(): ZPAdminRoundsState {
        return { Entries: this.entries.map(entry => ({ ...entry })), Pending: this.pending !== undefined, Feedback: this.feedback };
    }
    Open(): void {
        this.Stop(); this.active = true; this.entries = []; this.feedback = "";
        this.Refresh();
    }
    Stop(): void { this.active = false; this.pending = undefined; }
    private Begin(action: number): boolean {
        const player = LocalPlayer();
        if (!this.active || this.pending || !IsValid(player) || !player.IsAdmin()) return false;
        this.sequence = this.sequence % 65535 + 1;
        this.pending = { ID: this.sequence, Deadline: CurTime() + 5 };
        this.nextRefresh = CurTime() + 2;
        net.Start("ZPAdminRoundsRequest");
        net.WriteUInt(1, 8); net.WriteUInt(this.sequence, 16); net.WriteUInt(action, 1);
        return true;
    }
    Refresh(): void {
        if (!this.Begin(0)) return;
        net.SendToServer(); this.changed();
    }
    Start(id: string): void {
        if (!this.entries.some(entry => entry.ID === id && entry.Allowed) || !this.Begin(1)) return;
        net.WriteString(id); net.SendToServer(); this.changed();
    }
    Receive(length: number): void {
        if (!this.active || !this.pending || length < 48 || length > 524280) return;
        const version = net.ReadUInt(8), sequence = net.ReadUInt(16);
        if (version !== 1 || sequence !== this.pending.ID) return;
        const feedback = net.ReadString(), count = net.ReadUInt(16);
        if (!["", "zombieplague.adminroundstarted", "zombieplague.adminroundunavailable"].includes(feedback) || count > Math.floor(length / 33)) return;
        const entries: ZPAdminRoundEntry[] = [];
        const seen: Record<string, boolean | undefined> = {};
        for (let index = 0; index < count; index++) {
            const id = net.ReadString(), name = net.ReadString(), minimum = net.ReadUInt(16), allowed = net.ReadBool();
            if (id.length < 1 || id.length > 255 || name.length < 1 || name.length > 512 || minimum < 2 || seen[id]) return;
            seen[id] = true;
            entries.push({ ID: id, Name: name, MinPlayers: minimum, Allowed: allowed });
        }
        this.entries = entries;
        if (feedback !== "" || this.feedback === "zombieplague.weaponmenutimeout") this.feedback = feedback;
        this.pending = undefined; this.changed();
    }
    Tick(): void {
        if (!this.active) return;
        if (this.pending && CurTime() > this.pending.Deadline) {
            this.pending = undefined; this.feedback = "zombieplague.weaponmenutimeout";
            this.nextRefresh = CurTime() + 2; this.changed();
        } else if (!this.pending && CurTime() >= this.nextRefresh) this.Refresh();
    }
}
