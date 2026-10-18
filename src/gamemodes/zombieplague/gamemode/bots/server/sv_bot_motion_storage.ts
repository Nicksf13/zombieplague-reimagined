const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
interface MotionStoreContract { Load(): ZPBotMoveMemory; Save(memory: ZPBotMoveMemory): boolean; }
export class BotMotionStore implements MotionStoreContract {
    private path: string;
    private directory: string;
    private previous: string | undefined;
    private writable = true;
    constructor(private scope: ZPBotScope, private id: number, private navigation = "unknown") {
        this.directory = "zombieplague/bots/movement/" + util.SHA256(ZPBotMetricsProtocol.Key(scope)) + "/" + navigation;
        this.path = this.directory + "/" + id + ".json";
    }
    Load(): ZPBotMoveMemory {
        const raw = file.Read(this.path, "DATA");
        if (raw === undefined) return ZPBotMotionProtocol.Empty();
        const data = raw.length <= 131072 ? record(util.JSONToTable(raw)) : undefined;
        const scope = ZPBotMetricsProtocol.Scope(data?.Scope), memory = ZPBotMotionProtocol.Memory(data?.Memory);
        if (data?.Version !== 1 || data.ID !== this.id || data.Navigation !== this.navigation || !scope || ZPBotMetricsProtocol.Key(scope) !== ZPBotMetricsProtocol.Key(this.scope) || !memory) {
            this.writable = false;
            print("[ZP bots] Invalid movement file; leaving it unchanged. Movement learning continues in memory.");
            return ZPBotMotionProtocol.Empty();
        }
        this.previous = raw;
        return memory;
    }
    Save(memory: ZPBotMoveMemory): boolean {
        if (!this.writable) return false;
        let verified = false;
        const [ok] = pcall(() => {
            const json = util.TableToJSON({ Version: 1, Scope: this.scope, ID: this.id, Navigation: this.navigation, Memory: memory });
            if (!json || json.length > 131072) return;
            file.CreateDir("zombieplague/bots/movement"); file.CreateDir(this.directory);
            if (this.previous !== undefined) {
                file.Write(this.path + ".bak.txt", this.previous);
                if (file.Read(this.path + ".bak.txt", "DATA") !== this.previous) return;
            }
            file.Write(this.path, json); verified = file.Read(this.path, "DATA") === json;
            if (verified) this.previous = json;
        });
        if (!ok || !verified) print("[ZP bots] Movement save failed; keeping pending changes for retry.");
        return ok && verified;
    }
}
