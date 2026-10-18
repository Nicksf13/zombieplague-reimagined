import type { isProfile as profileValidator } from "./sv_bot_brain";
const { parseBotMemories } = include("sv_bot_storage.lua") as typeof import("./sv_bot_storage");
const { migrateLearning } = include("sv_bot_learning_migration.lua") as typeof import("./sv_bot_learning_migration");
const record = (value: unknown): Record<string, unknown> | undefined =>
    typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
export interface SharedLearningContext { Scope: ZPBotScope; Bots: ZPBotMemory[]; }
interface SharedLearningContract {
    Profile(scope: ZPBotScope, id: number): ZPBotProfile | undefined;
    Memory(scope: ZPBotScope, id: number, profile: ZPBotProfile): ZPBotMemory;
    Changed(): void;
    Save(): boolean;
}

// Map="*" is internal to this file. Live diagnostics retain the actual map.
const scopeKey = (scope: ZPBotScope): string => ZPBotMetricsProtocol.Key({ ...scope, Map: "*" });
export class BotSharedLearning implements SharedLearningContract {
    private contexts: Record<string, SharedLearningContext | undefined> = {};
    private path = "zombieplague/bots/learning-v3.json";
    private previous: string | undefined;
    private writable = true;
    private dirty = false;

    constructor(isProfile: typeof profileValidator) {
        const raw = file.Read(this.path, "DATA");
        if (raw === undefined) {
            for (const context of migrateLearning(isProfile)) this.contexts[scopeKey(context.Scope)] = context;
            this.dirty = Object.keys(this.contexts).length > 0;
            return;
        }
        const parsed = raw.length <= 16777216 ? record(util.JSONToTable(raw)) : undefined;
        const contexts = record(parsed?.Contexts);
        let valid = parsed?.Version === 3 && contexts !== undefined && Object.keys(contexts).length <= 1024;
        if (valid && contexts) {
            for (let index = 1; index <= Object.keys(contexts).length; index++) {
                const entry = record(contexts[index]), scope = ZPBotMetricsProtocol.Scope(entry?.Scope);
                const bots = parseBotMemories(entry?.Bots, isProfile);
                if (!scope || scope.Map !== "*" || !bots || this.contexts[scopeKey(scope)]) { valid = false; break; }
                this.contexts[scopeKey(scope)] = { Scope: scope, Bots: bots };
            }
        }
        if (!valid) {
            this.contexts = {}; this.writable = false;
            print("[ZP bots] Invalid shared learning file; leaving it unchanged. Learning continues in memory.");
        }
        else this.previous = raw;
    }

    Profile(scope: ZPBotScope, id: number): ZPBotProfile | undefined {
        return this.contexts[scopeKey(scope)]?.Bots.find(bot => bot.ID === id)?.Profile;
    }

    Memory(scope: ZPBotScope, id: number, profile: ZPBotProfile): ZPBotMemory {
        const key = scopeKey(scope);
        let context = this.contexts[key];
        if (!context) { context = { Scope: { ...scope, Map: "*" }, Bots: [] }; this.contexts[key] = context; }
        const existing = context.Bots.find(bot => bot.ID === id);
        if (existing?.Profile === profile) return existing;
        const memory: ZPBotMemory = { ID: id, Profile: profile, Experience: {} };
        context.Bots = context.Bots.filter(bot => bot.ID !== id);
        context.Bots.push(memory); this.dirty = true;
        return memory;
    }

    Changed(): void { this.dirty = true; }

    Save(): boolean {
        if (!this.dirty) return true;
        if (!this.writable) return false;
        let verified = false;
        const [ok] = pcall(() => {
            const contexts: SharedLearningContext[] = [];
            for (const [, context] of pairs(this.contexts)) if (context) contexts.push(context);
            if (contexts.length > 1024) return;
            const json = util.TableToJSON({ Version: 3, Contexts: contexts });
            if (!json || json.length > 16777216) return;
            file.CreateDir("zombieplague/bots");
            if (this.previous !== undefined) {
                file.Write(this.path + ".bak.txt", this.previous);
                if (file.Read(this.path + ".bak.txt", "DATA") !== this.previous) return;
            }
            file.Write(this.path, json); verified = file.Read(this.path, "DATA") === json;
            if (verified) { this.previous = json; this.dirty = false; }
        });
        if (!ok || !verified) print("[ZP bots] Shared learning save failed; keeping pending changes for retry.");
        return ok && verified;
    }
}
