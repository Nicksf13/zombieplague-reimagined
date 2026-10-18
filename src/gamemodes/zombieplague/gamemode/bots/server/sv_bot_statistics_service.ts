import type { BotController } from "./sv_bot_controller";
const { filter } = include("sh_bot_statistics_analysis.lua") as typeof import("../shared/sh_bot_statistics_analysis");
interface ServiceContract { Receive(length: number, ply: ZPServerPlayer): void; }
export class BotStatisticsService implements ServiceContract {
    private next = new Map<ZPServerPlayer, number>();
    constructor(private bots: BotController) {}
    Remove(ply: ZPServerPlayer): void { this.next.delete(ply); }
    Receive(length: number, ply: ZPServerPlayer): void {
        if (length < 56 || length > 8256 || !IsValid(ply) || !ply.IsAdmin() || CurTime() < (this.next.get(ply) ?? 0)) return;
        this.next.set(ply, CurTime() + 1);
        const version = net.ReadUInt(8), sequence = net.ReadUInt(31), exporting = net.ReadBool(), raw = net.ReadString();
        if (version !== 1 || sequence < 1 || raw.length > 1024) return;
        const query = filter(util.JSONToTable(raw)); if (!query) return;
        const data = this.bots.Statistics.Report(query);
        for (const group of data.Groups) group.Key = util.SHA256(group.Key);
        for (const group of data.Timeline) group.Key = util.SHA256(group.Key);
        for (const group of data.Minutes ?? []) group.Key = util.SHA256(group.Key);
        let json = util.TableToJSON(data);
        while (json && json.length > 48000 && data.Groups.length > 0) { data.Groups.shift(); data.Truncated++; json = util.TableToJSON(data); }
        while (json && json.length > 48000 && data.Timeline.length > 0) { data.Timeline.shift(); data.Truncated++; json = util.TableToJSON(data); }
        while (json && json.length > 48000 && data.History.length > 0) { data.History.shift(); json = util.TableToJSON(data); }
        while (json && json.length > 48000 && data.Minutes && data.Minutes.length > 0) { data.Minutes.shift(); data.Truncated++; json = util.TableToJSON(data); }
        if (!json || json.length > 48000) return;
        const exported = exporting && this.bots.Statistics.Export(query);
        net.Start("ZPBotStatisticsReply"); net.WriteUInt(sequence, 31); net.WriteBool(exported); net.WriteString(json); net.Send(ply);
    }
    Register(): void {
        concommand.Add("zp_bot_stats_export", (ply, _command, args) => {
            if (IsValid(ply) && !ply.IsAdmin()) return;
            const query = filter({ Bot: args[0] ?? "", Version: args[1] ?? "", Scenario: args[2] ?? "", Difficulty: args[3] ?? "", Role: args[4] ?? "", Period: args[5] ?? "" });
            if (query) this.bots.Statistics.Export(query);
        });
        concommand.Add("zp_bot_benchmark", (ply, _command, args) => {
            if (IsValid(ply) && !ply.IsSuperAdmin()) return;
            const values = args.map(value => tonumber(value));
            if (values.length !== 4 || values.some(value => value === undefined || value !== value || Math.abs(value) > 1e6)) return;
            const [id, x, y, z] = values;
            if (id !== undefined && x !== undefined && y !== undefined && z !== undefined) this.bots.Benchmark(id, Vector(x, y, z));
        });
    }
}
