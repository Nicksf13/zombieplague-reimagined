const schema = include("sh_statistics.lua") as typeof import("../shared/sh_statistics");
const weapons = include("sh_statistics_weapons.lua") as typeof import("../shared/sh_statistics_weapons");
const { PlayerStatisticsHUD } = include("cl_statistics_hud.lua") as typeof import("./cl_statistics_hud");

export class PlayerStatisticsMenu implements ZPStatisticsMenu {
    private opened = false;
    private id = 0;
    private queued = false;
    private next = 0;
    private deadline = 0;
    private presentation: InstanceType<typeof PlayerStatisticsHUD> | undefined;
    private state: ZPStatisticsMenuState = {
        Query: { Map: "", Role: "human", Metric: "Kills", Target: "", Weapon: "" }, Pending: false, Status: "loading",
    };
    GetState(): ZPStatisticsMenuState { return this.state; }
    Open(): void {
        ZPMainMenu.Close(); ZPWeaponMenu.Close(); _G.ZPClassMenu?.Close(); _G.ZPExtraMenu?.Close();
        _G.ZPAdminMenu?.Close(); _G.ZPSettings?.Close(); _G.ZPMapVoteMenu?.Close();
        this.opened = true; this.Rebuild(); this.Refresh();
    }
    Rebuild(): void {
        if (!this.opened) return;
        this.presentation?.Destroy(); this.presentation = undefined;
        const theme = ZPThemes.GetTheme();
        if (theme) this.presentation = new PlayerStatisticsHUD(theme.Palette, theme.Square ?? false, this);
        this.presentation?.Update(this.state);
    }
    Close(): void {
        this.opened = false; this.queued = false; this.presentation?.Destroy(); this.presentation = undefined;
    }
    Select(map: string, role: ZPStatisticsRole, metric: ZPStatisticsMetric, target: string, weapon = this.state.Query.Weapon ?? ""): void {
        if (!this.opened || (map !== "" && !schema.mapName(map)) || !schema.roles.includes(role) || !schema.metrics.includes(metric) ||
            (target !== "" && !schema.profileID(target)) || (weapon !== "" && !weapons.valid(weapon))) return;
        this.state.Query = { Map: map, Role: role, Metric: metric, Target: target,
            Weapon: weapons.supports(metric) ? weapon : "" }; this.Refresh();
    }
    Refresh(): void {
        if (!this.opened) return;
        this.id = this.id % 65535 + 1; this.queued = true; this.state.Pending = true;
        this.presentation?.Update(this.state); this.Send();
    }
    private Send(): void {
        if (!this.queued || CurTime() < this.next) return;
        this.queued = false; this.next = CurTime() + 0.6; this.deadline = CurTime() + 8;
        const query = this.state.Query;
        net.Start("ZPStatisticsRequest"); net.WriteUInt(3, 8); net.WriteUInt(this.id, 16); net.WriteString(query.Map);
        net.WriteUInt(schema.roles.indexOf(query.Role), 2); net.WriteUInt(schema.metrics.indexOf(query.Metric), 5);
        net.WriteString(query.Target); net.WriteString(query.Weapon ?? ""); net.SendToServer();
    }
    Receive(value: unknown): void {
        if (!this.opened) return;
        const reply = schema.reply(value);
        if (!reply || reply.ID !== this.id || this.queued) return;
        this.state.Pending = false; this.state.Status = reply.Status;
        this.state.Report = reply.Report; this.presentation?.Update(this.state);
    }
    Tick(): void {
        if (!this.opened) return;
        if (input.IsKeyDown(KEY_ESCAPE)) { this.Close(); return; }
        if (!GetGlobalBool("ZPStatisticsEnabled", false)) {
            if (this.state.Status !== "disabled" || this.state.Pending || this.state.Report) {
                this.state.Status = "disabled"; this.state.Report = undefined;
                this.state.Pending = false; this.queued = false; this.presentation?.Update(this.state);
            }
            return;
        }
        this.Send();
        if (this.state.Pending && !this.queued && CurTime() > this.deadline) {
            this.state.Pending = false; this.state.Status = "loading"; this.presentation?.Update(this.state);
        }
    }
}
const menu = new PlayerStatisticsMenu();
GM.PlayerStatisticsMenu = menu;
ZPMainMenu.RegisterOption({ ID: "statistics", Label: "zombieplague.pstatstitle", Description: "zombieplague.pstatsdescription",
    IsVisible: () => GetGlobalBool("ZPStatisticsEnabled", false), Action: () => menu.Open() });
concommand.Add("zp_statistics", () => menu.Open());
net.Receive("ZPStatisticsReply", length => { if (length <= 480000) menu.Receive(net.ReadTable()); });
hook.Add("Think", "ZPPlayerStatisticsMenu", () => menu.Tick());
