export {};
const { categories, entries } = include("sh_server_cvar_catalog.lua") as typeof import("./sh_server_cvar_catalog");

/** Shared field constraints; the server separately checks registration, permission and revision. */
function normalize(this: void, entry: ZPServerCvarEntry, raw: string): string | undefined {
    if (typeof raw !== "string" || raw.length > 128) return;
    const value = raw.trim();
    if (entry.Kind === "toggle") return value === "0" || value === "1" ? value : undefined;
    if (entry.Kind === "choice") return entry.Options?.some(option => option.Value === value) ? value : undefined;
    if (entry.Kind === "skybox" || entry.Kind === "brightness" || entry.Kind === "exposure")
        return ZPAdminConfig.Normalize({ ...entry, Kind: entry.Kind, RequiresReload: false }, value);
    if (entry.Kind === "text") return value.length > 0 && value.split("").every(character =>
        "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_.-".includes(character)) ? value : undefined;
    const unsigned = value.startsWith("-") ? value.substring(1) : value;
    if (unsigned.length === 0 || unsigned.split(".").length > 2 || !unsigned.split("").some(character => "0123456789".includes(character)) ||
        !unsigned.split("").every(character => "0123456789.".includes(character))) return;
    const number = Number(value);
    if (!Number.isFinite(number) || number < (entry.Min ?? 0) || number > (entry.Max ?? 1000000000) ||
        (entry.Integer && Math.floor(number) !== number)) return;
    return tostring(number);
}

_G.ZPServerCvars = { Categories: categories, Entries: entries,
    ForCategory: category => entries.filter(entry => entry.Category === category), Normalize: normalize };
