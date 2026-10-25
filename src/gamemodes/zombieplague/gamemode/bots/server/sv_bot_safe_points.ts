const { BotSafeStore } = include("sv_bot_safe_store.lua") as typeof import("./sv_bot_safe_store");
const { floorArea } = include("sv_bot_pathfinding.lua") as typeof import("./sv_bot_pathfinding");
const { BotBoostTool: BotEditorTool } = include("sv_bot_boost_tool.lua") as typeof import("./sv_bot_boost_tool");
interface SafeServiceContract extends ZPBotSafePoints { Receive(length: number, ply: ZPServerPlayer): void; Disconnect(ply: ZPServerPlayer): void; Tick(): void; }
export class BotSafePoints implements SafeServiceContract {
    private store = new BotSafeStore();
    private tool = new BotEditorTool("zp_bot_safe_tool");
    private requests = new Map<string, number>();
    Points(): ZPBotSafePoint[] { return this.store.Points(); }
    Disconnect(ply: ZPServerPlayer): void { this.tool.Release(ply); this.requests.delete(ply.SteamID64()); }
    Tick(): void { this.tool.Tick(); }
    private Capture(ply: ZPServerPlayer, aim: boolean): GLuaVector | undefined {
        if (!ply.Alive()) return;
        const origin = ply.GetPos();
        const trace = aim ? ply.GetEyeTrace() : util.TraceLine({ start: Vector(origin.x, origin.y, origin.z + 16),
            endpos: Vector(origin.x, origin.y, origin.z - 64), filter: player.GetAll() as ZPServerPlayer[], mask: MASK_PLAYERSOLID });
        if (!trace.Hit || trace.HitSky || !trace.HitNormal || trace.HitNormal.z < 0.7 ||
            !(trace.HitWorld || (IsValid(trace.Entity) && ["worldspawn", "prop_static"].includes(trace.Entity.GetClass()))) ||
            trace.HitPos.DistToSqr(ply.EyePos()) > 4096 * 4096) return;
        const point = trace.HitPos, area = floorArea(point, 96, 24);
        if (!area || !area.Contains(point) || area.IsBlocked(-2) || area.IsUnderwater()) return;
        const [mins, maxs] = ply.GetHull(), [duckMins, duckMaxs] = ply.GetHullDuck(), start = Vector(point.x, point.y, point.z + 4);
        const filter = player.GetAll() as ZPServerPlayer[];
        if (util.TraceHull({ start, endpos: start, filter, mask: MASK_PLAYERSOLID, mins, maxs }).Hit &&
            util.TraceHull({ start, endpos: start, filter, mask: MASK_PLAYERSOLID, mins: duckMins, maxs: duckMaxs }).Hit) return;
        return Vector(point.x, point.y, point.z);
    }
    Receive(length: number, ply: ZPServerPlayer): void {
        if (length !== 91 || !IsValid(ply) || ply.IsBot()) return;
        if (!ply.IsAdmin()) { this.Disconnect(ply); return; }
        const version = net.ReadUInt(8), request = net.ReadUInt(31), revision = net.ReadUInt(31), action = net.ReadUInt(3), role = net.ReadUInt(2), id = net.ReadUInt(16);
        if (version !== 2 || request < 1 || role > 2 || action > 5) return;
        if (action === 5) { this.Disconnect(ply); return; }
        if (!ply.IsAdmin()) { this.Disconnect(ply); return; }
        if (CurTime() < (this.requests.get(ply.SteamID64()) ?? 0)) return;
        this.requests.set(ply.SteamID64(), CurTime() + 0.15);
        this.tool.Touch(ply);
        let feedback: ZPBotSafeFeedback = "ready";
        if (action === 4) feedback = this.tool.Equip(ply) ? "ready" : "error";
        else if (!this.tool.Active(ply)) feedback = "invalid";
        else if (action > 0 && revision !== this.store.Revision) feedback = "stale";
        else if (action === 1 || action === 2) {
            const point = this.Capture(ply, action === 2);
            feedback = point ? this.store.Add(point, role === 0 ? "human" : role === 1 ? "zombie" : "both") : "invalid";
        } else if (action === 3) feedback = this.store.Remove(id);
        net.Start("ZPBotSafeReply");
        net.WriteTable({ Request: request, Revision: this.store.Revision, Points: this.Points(), Feedback: feedback,
            Equipped: action === 4 && feedback === "ready" || this.tool.Active(ply) }); net.Send(ply);
    }
}
const service = new BotSafePoints();
_G.ZPBotSafePoints = service;
util.AddNetworkString("ZPBotSafeRequest"); util.AddNetworkString("ZPBotSafeReply");
net.Receive("ZPBotSafeRequest", (length, ply) => service.Receive(length, ply));
hook.Add("PlayerDisconnected", "ZPBotSafePoints", ply => service.Disconnect(ply));
hook.Add("Think", "ZPBotSafePoints", () => service.Tick());
hook.Add("ShutDown", "ZPBotSafePoints", () => { for (const ply of player.GetAll() as ZPServerPlayer[]) service.Disconnect(ply); });
