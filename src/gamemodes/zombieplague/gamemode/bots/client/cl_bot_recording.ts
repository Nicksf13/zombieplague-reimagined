interface ClientContract { Start(): void; Stop(): void; Tick(): void; Action(action: number): void; State(): ZPBotRecordingState; }
export class BotRecordingClient implements ClientContract {
    private active = false;
    private enabled = false;
    private seconds = 0;
    private path = "";
    private feedback = "";
    private ready = false;
    private sequence = 0;
    private next = 0;
    private pending: { ID: number; Deadline: number } | undefined;
    constructor(private update: (this: void) => void) {
        net.Receive("ZPBotRecordingReply", length => {
            if (!this.active || length < 51 || length > 4096 || !this.Allowed()) return;
            const id = net.ReadUInt(31), enabled = net.ReadBool(), seconds = net.ReadUInt(9), result = net.ReadUInt(2), path = net.ReadString();
            if (id !== this.pending?.ID || seconds > 300 || result > 2 || path.length > 256) return;
            this.enabled = enabled; this.seconds = seconds; this.path = path; this.ready = true; this.pending = undefined;
            if (result > 0) this.feedback = result === 1 ? "zombieplague.brecsaved" : "zombieplague.brecerror";
            this.update();
        });
    }
    private Allowed(): boolean { return IsValid(LocalPlayer()) && LocalPlayer().IsSuperAdmin(); }
    State(): ZPBotRecordingState { return { Enabled: this.enabled, Seconds: this.seconds, Path: this.path, Feedback: this.feedback,
        Ready: this.ready && this.Allowed(), Pending: this.pending !== undefined }; }
    Start(): void { this.active = true; this.ready = false; this.feedback = ""; this.next = 0; this.Tick(); }
    Stop(): void { this.active = false; this.pending = undefined; this.ready = false; }
    Action(action: number): void {
        if (!this.active || !this.Allowed() || this.pending || ![0, 1, 2, 3].includes(action) || (action > 0 && !this.ready)) return;
        this.sequence = this.sequence % 2147483647 + 1;
        this.pending = { ID: this.sequence, Deadline: CurTime() + 5 }; this.next = CurTime() + 1;
        net.Start("ZPBotRecordingRequest"); net.WriteUInt(1, 8); net.WriteUInt(this.sequence, 31); net.WriteUInt(action, 2); net.SendToServer(); this.update();
    }
    Tick(): void {
        if (!this.active) return;
        if (!this.Allowed()) { this.Stop(); this.update(); return; }
        if (this.pending && CurTime() > this.pending.Deadline) {
            this.pending = undefined; this.ready = false; this.feedback = "zombieplague.weaponmenutimeout"; this.update();
        }
        if (!this.pending && CurTime() >= this.next) this.Action(0);
    }
}
