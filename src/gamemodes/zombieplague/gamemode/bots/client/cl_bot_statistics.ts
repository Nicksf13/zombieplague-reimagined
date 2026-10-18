import type { BotStatisticsHUD as HUDType } from "./cl_bot_statistics_hud";
const { BotStatisticsHUD } = include("cl_bot_statistics_hud.lua") as typeof import("./cl_bot_statistics_hud");
const { parseReport } = include("sh_bot_statistics_analysis.lua") as typeof import("../shared/sh_bot_statistics_analysis");
interface StatisticsClientContract { Open(): void; Receive(length: number): void; }
export class BotStatisticsClient implements StatisticsClientContract {
    private view: HUDType | undefined;
    private sequence = 0;
    private pending: { ID: number; Deadline: number; Query: ZPBotStatisticsFilter } | undefined;
    private queued: { Query: ZPBotStatisticsFilter; Exporting: boolean } | undefined;
    private next = 0;
    private nextPoll = 0;
    private lastQuery: ZPBotStatisticsFilter | undefined;
    Open(): void {
        if (!IsValid(LocalPlayer()) || !LocalPlayer().IsAdmin()) return;
        const theme = ZPThemes.GetTheme(); if (!theme) return;
        this.view?.Destroy(); this.pending = undefined; this.queued = undefined; this.lastQuery = undefined;
        this.view = new BotStatisticsHUD(theme.Palette, ZPThemes.GetActiveID() === "cs16", (query, exporting) => this.Request(query, exporting));
    }
    private Request(query: ZPBotStatisticsFilter, exporting: boolean): boolean {
        if (!IsValid(LocalPlayer()) || !LocalPlayer().IsAdmin()) return false;
        this.lastQuery = { ...query };
        // Keep the latest selection during the network throttle and invalidate older replies.
        this.pending = undefined;
        if (CurTime() < this.next) { this.queued = { Query: { ...query }, Exporting: exporting }; return true; }
        this.queued = undefined;
        this.next = CurTime() + 1;
        this.nextPoll = CurTime() + 2;
        const id = this.sequence = this.sequence % 2147483647 + 1; this.pending = { ID: id, Deadline: CurTime() + 5, Query: { ...query } };
        net.Start("ZPBotStatisticsRequest"); net.WriteUInt(1, 8); net.WriteUInt(id, 31); net.WriteBool(exporting); net.WriteString(util.TableToJSON(query) ?? "{}"); net.SendToServer();
        return true;
    }
    Receive(length: number): void {
        if (length < 40 || length > 384040 || !this.pending || !this.view?.Alive()) return;
        const id = net.ReadUInt(31), exported = net.ReadBool(), json = net.ReadString();
        if (id !== this.pending.ID || json.length > 48000) return;
        const data = parseReport(util.JSONToTable(json)); if (!data) return;
        const query = this.pending.Query;
        this.pending = undefined; this.lastQuery = query; this.view.Render(data, exported, query);
    }
    Tick(): void {
        if (!this.view?.Alive()) { this.pending = undefined; this.queued = undefined; this.lastQuery = undefined; return; }
        if (this.view?.Alive()) {
            const theme = ZPThemes.GetTheme(); if (theme) this.view.Theme(theme.Palette, ZPThemes.GetActiveID() === "cs16");
            if (!IsValid(LocalPlayer()) || !LocalPlayer().IsAdmin()) { this.view.Destroy(); this.pending = undefined; this.queued = undefined; return; }
        }
        if (this.queued && CurTime() >= this.next) this.Request(this.queued.Query, this.queued.Exporting);
        else if (!this.pending && !this.queued && this.lastQuery && CurTime() >= this.nextPoll) this.Request(this.lastQuery, false);
        if (this.view?.Alive() && this.pending && CurTime() >= this.pending.Deadline) { this.pending = undefined; this.view.Timeout(); }
    }
}
const statistics = new BotStatisticsClient();
concommand.Add("zp_bot_statistics", () => statistics.Open());
net.Receive("ZPBotStatisticsReply", length => statistics.Receive(length));
hook.Add("Think", "ZPBotStatistics", () => statistics.Tick());
