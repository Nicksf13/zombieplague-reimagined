interface SafeFile { Version: 1; Map: string; NextID: number; Points: ZPBotSafePoint[]; }
interface SafeStoreContract { Points(): ZPBotSafePoint[]; Add(position: GLuaVector, role: ZPBotSafeRole): ZPBotSafeFeedback; Remove(id: number): ZPBotSafeFeedback; }
export class BotSafeStore implements SafeStoreContract {
    private data: SafeFile;
    private path: string;
    private previous: string | undefined;
    private writable = true;
    Revision = 1;
    constructor() {
        const map = game.GetMap();
        this.path = "zombieplague/bots/safe-points/" + util.SHA256(map).substring(0, 64) + ".json";
        this.data = { Version: 1, Map: map, NextID: 1, Points: [] };
        const raw = file.Read(this.path, "DATA"); if (raw === undefined) return;
        const value: unknown = raw.length <= 32768 ? util.JSONToTable(raw) : undefined;
        const saved = typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
        const points = ZPBotSafeProtocol.Points(saved?.Points), next = saved?.NextID;
        if (!saved || saved.Version !== 1 || saved.Map !== map || !points || typeof next !== "number" ||
            next < 1 || next > 65536 || next % 1 !== 0 || points.some(point => point.ID >= next)) {
            this.writable = false; print("[ZP bots] Invalid safe-point file; leaving it unchanged."); return;
        }
        this.data = { Version: 1, Map: map, NextID: next, Points: points }; this.previous = raw;
    }
    Points(): ZPBotSafePoint[] { return this.data.Points.map(point => ({ ...point, Position: [...point.Position] })); }
    Add(position: GLuaVector, role: ZPBotSafeRole): ZPBotSafeFeedback {
        if (this.data.Points.length >= 32 || this.data.NextID > 65535) return "capacity";
        const points = ZPBotSafeProtocol.Points([...this.data.Points, { ID: this.data.NextID, Role: role, Position: [position.x, position.y, position.z] }]);
        if (!points || this.data.Points.some(point => Vector(point.Position[0] ?? 0, point.Position[1] ?? 0, point.Position[2] ?? 0).DistToSqr(position) < 32 * 32)) return "invalid";
        return this.Commit({ ...this.data, Points: points, NextID: this.data.NextID + 1 }) ? "saved" : "error";
    }
    Remove(id: number): ZPBotSafeFeedback {
        if (!this.data.Points.some(point => point.ID === id)) return "invalid";
        return this.Commit({ ...this.data, Points: this.data.Points.filter(point => point.ID !== id) }) ? "saved" : "error";
    }
    private Commit(next: SafeFile): boolean {
        if (!this.writable) return false;
        let verified = false;
        const [ok] = pcall(() => {
            const json = util.TableToJSON(next); if (!json || json.length > 32768) return;
            file.CreateDir("zombieplague/bots/safe-points");
            file.Write(this.path + ".tmp.txt", json);
            if (file.Read(this.path + ".tmp.txt", "DATA") !== json) return;
            if (this.previous !== undefined) {
                file.Write(this.path + ".bak.txt", this.previous);
                if (file.Read(this.path + ".bak.txt", "DATA") !== this.previous) return;
            }
            file.Write(this.path, json); verified = file.Read(this.path, "DATA") === json;
            if (verified) this.previous = json;
        });
        if (!ok || !verified) return false;
        this.data = next; this.Revision++; return true;
    }
}
