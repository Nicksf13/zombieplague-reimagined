const toolClass = "zp_bot_boost_tool";
interface ToolLease { Player: ZPServerPlayer; Tool: GLuaWeapon; Previous: GLuaWeapon; Deadline: number; }
interface ToolContract { Equip(ply: ZPServerPlayer): boolean; Active(ply: ZPServerPlayer): boolean; Touch(ply: ZPServerPlayer): void; Release(ply: ZPServerPlayer): void; Tick(): void; }
export class BotBoostTool implements ToolContract {
    private leases = new Map<string, ToolLease>();
    Equip(ply: ZPServerPlayer): boolean {
        if (!ply.Alive() || !ply.IsAdmin() || ply.IsBot()) return false;
        let lease = this.leases.get(ply.SteamID64());
        if (lease && ply.GetWeapon(toolClass) !== lease.Tool) { this.Release(ply); lease = undefined; }
        if (!lease) {
            const previous = ply.GetActiveWeapon(), existing = ply.GetWeapon(toolClass);
            const tool = IsValid(existing) ? existing : ply.Give(toolClass);
            if (!IsValid(tool)) return false;
            lease = { Player: ply, Tool: tool, Previous: previous, Deadline: CurTime() + 5 };
            this.leases.set(ply.SteamID64(), lease);
        }
        this.Touch(ply); ply.SelectWeapon(toolClass); return true;
    }
    Active(ply: ZPServerPlayer): boolean {
        const lease = this.leases.get(ply.SteamID64());
        return ply.Alive() && lease !== undefined && IsValid(lease.Tool) && ply.GetActiveWeapon() === lease.Tool;
    }
    Touch(ply: ZPServerPlayer): void { const lease = this.leases.get(ply.SteamID64()); if (lease) lease.Deadline = CurTime() + 5; }
    Release(ply: ZPServerPlayer): void {
        const lease = this.leases.get(ply.SteamID64()); this.leases.delete(ply.SteamID64());
        if (!lease || !IsValid(ply)) return;
        const restore = ply.GetActiveWeapon() === lease.Tool;
        if (ply.GetWeapon(toolClass) === lease.Tool) ply.StripWeapon(toolClass);
        if (restore && IsValid(lease.Previous) && ply.GetWeapon(lease.Previous.GetClass()) === lease.Previous) ply.SelectWeapon(lease.Previous.GetClass());
    }
    Tick(): void {
        for (const [identity, lease] of this.leases) {
            const ply = lease.Player;
            if (!IsValid(ply)) { this.leases.delete(identity); continue; }
            if (!ply.Alive() || !ply.IsAdmin() || !IsValid(lease.Tool) || CurTime() >= lease.Deadline) this.Release(ply);
        }
    }
}
