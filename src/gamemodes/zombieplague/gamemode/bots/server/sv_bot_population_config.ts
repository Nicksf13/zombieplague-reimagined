interface PopulationConfigContract { Enabled: boolean; Target: number; Revision: number; Apply(enabled: boolean, target: number): boolean; }
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
export class BotPopulationConfig implements PopulationConfigContract {
    private readonly path = "zombieplague/bots/population.json";
    private previous: string | undefined;
    private writable = true;
    Enabled = false;
    Target = 0;
    Revision = 1;
    constructor() {
        const raw = file.Read(this.path, "DATA"); if (raw === undefined) return;
        const data = raw.length <= 2048 ? record(util.JSONToTable(raw)) : undefined;
        if (!data || data.Version !== 1 || typeof data.Enabled !== "boolean" || typeof data.Target !== "number" ||
            !(data.Target >= 0 && data.Target <= 64) || data.Target % 1 !== 0) {
            this.writable = false; print("[ZP bots] Invalid population settings; automatic filling disabled and file left unchanged."); return;
        }
        this.Enabled = data.Enabled; this.Target = data.Target; this.previous = raw;
    }
    Apply(enabled: boolean, target: number): boolean {
        if (!this.writable || typeof enabled !== "boolean" || typeof target !== "number" || !(target >= 0 && target <= 64) || target % 1 !== 0) return false;
        let verified = false;
        const [ok] = pcall(() => {
            const json = util.TableToJSON({ Version: 1, Enabled: enabled, Target: target }); if (!json || json.length > 2048) return;
            file.CreateDir("zombieplague/bots");
            if (this.previous !== undefined) {
                file.Write(this.path + ".bak.txt", this.previous);
                if (file.Read(this.path + ".bak.txt", "DATA") !== this.previous) return;
            }
            file.Write(this.path, json); verified = file.Read(this.path, "DATA") === json;
            if (verified) this.previous = json;
        });
        if (!ok || !verified) return false;
        this.Enabled = enabled; this.Target = target; this.Revision = this.Revision % 2147483647 + 1; return true;
    }
}
