const schema = include("sh_statistics.lua") as typeof import("../shared/sh_statistics");
const weapons = include("sh_statistics_weapons.lua") as typeof import("../shared/sh_statistics_weapons");
interface NetworkContract { Receive(length: number, ply: ZPServerPlayer): void; }
export class StatisticsNetwork implements NetworkContract {
    private next = new Map<ZPServerPlayer, number>();
    constructor(private service: ZPPlayerStatisticsService) {}
    Receive(length: number, ply: ZPServerPlayer): void {
        if (!IsValid(ply) || ply.IsBot() || length < 47 || length > 2048 || CurTime() < (this.next.get(ply) ?? 0)) return;
        this.next.set(ply, CurTime() + 0.5);
        const version = net.ReadUInt(8), id = net.ReadUInt(16), map = net.ReadString();
        const role = schema.roles[net.ReadUInt(2)], metric = schema.metrics[net.ReadUInt(5)], target = net.ReadString();
        if ((version !== 1 && version !== 2 && version !== 3) || (version === 1 && length > 1024) || id === 0 || !role || !metric || (map !== "" && !schema.mapName(map)) ||
            (target !== "" && !(version === 3 ? schema.profileID(target) : schema.steamID(target)))) return;
        const weapon = version >= 2 && length >= 55 ? net.ReadString() : "";
        if ((version >= 2 && length < 55) || (weapon !== "" && (!weapons.valid(weapon) || !weapons.supports(metric)))) return;
        const response: ZPStatisticsReply = { ID: id, Status: "disabled" };
        if (this.service.IsEnabled()) {
            const report = this.service.Report(ply.SteamID64(), { Map: map, Role: role, Metric: metric, Target: target, Weapon: weapon, IncludeBots: version === 3 });
            // The wire sends one selected weapon's values; the full per-role dictionary stays in the addon API/storage.
            report.Profile.Weapons = {};
            response.Status = this.service.IsReady() ? "ready" : "loading";
            if (response.Status === "ready" && (map === "" || report.Maps.includes(map))) response.Report = report;
            else if (response.Status === "ready") return;
        }
        net.Start("ZPStatisticsReply"); net.WriteTable(response); net.Send(ply);
    }
    Disconnect(ply: ZPServerPlayer): void { this.next.delete(ply); }
}
const service = GM.PlayerStatistics;
if (service) {
    const network = new StatisticsNetwork(service);
    util.AddNetworkString("ZPStatisticsRequest"); util.AddNetworkString("ZPStatisticsReply");
    net.Receive("ZPStatisticsRequest", (length, ply) => network.Receive(length, ply));
    hook.Add("PlayerDisconnected", "ZPPlayerStatisticsNetwork", ply => network.Disconnect(ply as ZPServerPlayer));
}
