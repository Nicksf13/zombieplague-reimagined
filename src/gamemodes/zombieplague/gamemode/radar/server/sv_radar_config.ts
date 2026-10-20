export {};

ConvarManager.CreateConVar("zp_radar_mode", 2, FCVAR_ARCHIVE, "Radar: 0 disabled, 1 purchasable, 2 available to everyone.");
ConvarManager.CreateConVar("zp_radar_allies", 1, FCVAR_ARCHIVE, "Show perceived allies on the radar.");
ConvarManager.CreateConVar("zp_radar_shot_range", 2500, FCVAR_ARCHIVE, "Maximum gunshot detection distance in Source units.");
ConvarManager.CreateConVar("zp_radar_melee_range", 350, FCVAR_ARCHIVE, "Maximum zombie melee detection distance in Source units.");
ConvarManager.CreateConVar("zp_radar_mark_min", 0.4, FCVAR_ARCHIVE, "Attack marker duration at the detection limit, in seconds.");
ConvarManager.CreateConVar("zp_radar_mark_max", 3, FCVAR_ARCHIVE, "Attack marker duration at zero distance, in seconds.");
ConvarManager.CreateConVar("zp_radar_scan_duration", 10, FCVAR_ARCHIVE, "Purchased scan duration in seconds.");
ConvarManager.CreateConVar("zp_radar_scan_interval", 1, FCVAR_ARCHIVE, "Seconds between purchased scan pulses.");
ConvarManager.CreateConVar("zp_radar_scan_range", 3000, FCVAR_ARCHIVE, "Purchased scan radius in Source units.");
ConvarManager.CreateConVar("zp_radar_price", 10, FCVAR_ARCHIVE, "Radar item price in ammo packs, for both teams.");

export function setting(this: void, name: string, fallback: number, min: number, max: number): number {
    const value = cvars.Number("zp_radar_" + name, fallback);
    return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}
