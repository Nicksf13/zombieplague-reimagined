const schema = include("sh_statistics.lua") as typeof import("../shared/sh_statistics");
interface IdentityContract { Get(ply: ZPServerPlayer): string | undefined; Forget(ply: ZPServerPlayer): void; }
/** Named bot slots survive map changes without sharing the engine's zero SteamID64. */
export class StatisticsIdentities implements IdentityContract {
    private assigned = new Map<ZPServerPlayer, string>();
    private owners = new Map<string, ZPServerPlayer>();
    Get(ply: ZPServerPlayer): string | undefined {
        if (!IsValid(ply)) return;
        if (!ply.IsBot()) { const id = ply.SteamID64(); return schema.steamID(id) ? id : undefined; }
        const previous = this.assigned.get(ply);
        if (previous) return previous;
        const hash = util.SHA256(ply.Name());
        for (let slot = 1; slot <= 128; slot++) {
            const id = "bot:" + hash + ":" + tostring(slot), owner = this.owners.get(id);
            if (owner && IsValid(owner)) continue;
            if (owner) this.assigned.delete(owner);
            this.assigned.set(ply, id); this.owners.set(id, ply); return id;
        }
        return;
    }
    Forget(ply: ZPServerPlayer): void {
        const id = this.assigned.get(ply); this.assigned.delete(ply);
        if (id !== undefined && this.owners.get(id) === ply) this.owners.delete(id);
    }
    Prune(): void { for (const ply of this.assigned.keys()) if (!IsValid(ply)) this.Forget(ply); }
}
