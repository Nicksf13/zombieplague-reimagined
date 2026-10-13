export {};

// A fixed allowlist is shared by the form and server validation. No client-supplied
// command name is executed. Only map audio requires reloading the current map.
_G.ZPAdminConfig = {
    Entries: [
        { Name: "zp_map_mute_ambient", Label: "zombieplague.cvarmapmuteambient", Kind: "toggle", Default: "1", RequiresReload: true },
        { Name: "zp_map_night", Label: "zombieplague.cvarmapnight", Kind: "toggle", Default: "1", RequiresReload: false },
        { Name: "zp_map_day_cycle", Label: "zombieplague.cvarmapdaycycle", Kind: "toggle", Default: "0", RequiresReload: false },
        { Name: "zp_map_skybox", Label: "zombieplague.cvarmapskybox", Kind: "skybox", Default: "", RequiresReload: false },
        { Name: "zp_map_night_brightness", Label: "zombieplague.cvarmapnightbrightness", Kind: "brightness", Default: "c", RequiresReload: false },
        { Name: "zp_map_night_exposure", Label: "zombieplague.cvarmapnightexposure", Kind: "exposure", Default: "100", RequiresReload: false },
    ],
    Normalize(this: void, entry, value) {
        if (value.length > 128) return;
        const normalized = value.trim();
        if (entry.Kind === "toggle") return normalized === "0" || normalized === "1" ? normalized : undefined;
        if (entry.Kind === "brightness") return normalized.length === 1 &&
            "bcdefghijklm".includes(normalized) ? normalized : undefined;
        if (entry.Kind === "skybox") return normalized.split("").every(character =>
            "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_/-".includes(character)) ? normalized : undefined;
        if (normalized.length === 0 || normalized.split(".").length > 2 ||
            !normalized.split("").every(character => "0123456789.".includes(character))) return;
        const exposure = Number(normalized);
        return exposure >= 0 && exposure <= 100 ? String(exposure) : undefined;
    },
};
