import type { BotRecording } from "./sv_bot_recording";
interface ServiceContract { Receive(length: number, ply: ZPServerPlayer): void; Remove(ply: ZPPlayer): void; }
export class BotRecordingService implements ServiceContract {
    private requests = new Map<string, { Poll: number; Action: number }>();
    private nextSave = 0;
    constructor(private recording: BotRecording) {}
    Receive(length: number, ply: ZPServerPlayer): void {
        if (length !== 41 || !IsValid(ply) || !ply.IsSuperAdmin()) return;
        const now = CurTime(), identity = ply.SteamID64();
        const version = net.ReadUInt(8), id = net.ReadUInt(31), action = net.ReadUInt(2);
        if (version !== 1 || id < 1) return;
        const limits = this.requests.get(identity) ?? { Poll: 0, Action: 0 };
        if (now < (action === 0 ? limits.Poll : limits.Action)) return;
        if (action === 0) limits.Poll = now + 0.5; else limits.Action = now + 0.25;
        this.requests.set(identity, limits);
        let result = 0;
        if (action === 1) this.recording.SetEnabled(true);
        if (action === 2) this.recording.SetEnabled(false);
        if (action === 3) {
            if (now < this.nextSave) result = 2;
            else { this.nextSave = now + 10; result = this.recording.Save() ? 1 : 2; }
        }
        net.Start("ZPBotRecordingReply"); net.WriteUInt(id, 31); net.WriteBool(this.recording.Enabled);
        net.WriteUInt(Math.min(300, Math.floor(this.recording.Seconds())), 9); net.WriteUInt(result, 2);
        net.WriteString(this.recording.Path); net.Send(ply);
    }
    Remove(ply: ZPPlayer): void { this.requests.delete(ply.SteamID64()); }
}
