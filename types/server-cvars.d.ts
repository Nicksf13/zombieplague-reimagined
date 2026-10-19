type ZPServerCvarGroup = "environment" | "rounds" | "combat" | "movement" | "battery" | "zombies" | "special" | "ammopacks" | "points" | "communication" | "bots" | "statistics";
interface ZPServerCvarCategory { readonly ID: ZPServerCvarGroup; readonly Label: string; readonly SuperAdmin?: boolean; }
interface ZPServerCvarOption { readonly Value: string; readonly Label: string; }
type ZPServerCvarApply = "live" | "event" | "spawn" | "phase" | "vote" | "map" | "unused" | "mixed";
interface ZPServerCvarEntry {
    readonly Apply: ZPServerCvarApply;
    readonly Name: string; readonly Label: string; readonly Subject?: string; readonly Category: ZPServerCvarGroup;
    readonly Kind: "toggle" | "number" | "text" | "choice" | "skybox" | "brightness" | "exposure";
    readonly Default: string; readonly Min?: number; readonly Max?: number; readonly Integer?: boolean;
    readonly Options?: readonly ZPServerCvarOption[]; readonly Help?: string;
}
interface ZPServerCvarCatalog {
    readonly Categories: readonly ZPServerCvarCategory[];
    readonly Entries: readonly ZPServerCvarEntry[];
    ForCategory(this: void, category: ZPServerCvarGroup): ZPServerCvarEntry[];
    Normalize(this: void, entry: ZPServerCvarEntry, raw: string): string | undefined;
}
declare const ZPServerCvars: ZPServerCvarCatalog;
interface ZPGlobals { ZPServerCvars: ZPServerCvarCatalog; }
