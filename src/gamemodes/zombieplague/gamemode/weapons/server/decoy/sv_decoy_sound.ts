const native: Readonly<Record<string, string | undefined>> = {
    weapon_ar2: "Weapon_AR2.Single", weapon_smg1: "Weapon_SMG1.Single",
    weapon_pistol: "Weapon_Pistol.Single", weapon_357: "Weapon_357.Single",
    weapon_shotgun: "Weapon_Shotgun.Single", weapon_crossbow: "Weapon_Crossbow.Single",
    weapon_rpg: "Weapon_RPG.Single",
};

function record(this: void, value: unknown): Record<string, unknown> | undefined {
    return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
}
function name(this: void, value: unknown): string | undefined {
    if (typeof value === "string" && value.length > 0 && value.length <= 192 &&
        !value.includes("..") && !value.includes("\0") && !value.includes("\n") && !value.includes("\r")) return value;
}
function sound(this: void, value: unknown): string | undefined {
    const single = name(value);
    if (single) return single;
    const list = record(value);
    if (!list) return;
    let checked = 0;
    for (const [, entry] of pairs(list)) {
        if (++checked > 16) break;
        const selected = name(entry);
        if (selected) return selected;
    }
}
export function weaponSound(this: void, weapon: GLuaWeapon): string | undefined {
    if (!IsValid(weapon) || weapon.GetClass() === "zp_decoy_grenade_thrower") return;
    const standard = native[weapon.GetClass()];
    if (standard) return standard;
    if (weapon.GetPrimaryAmmoType() < 0) return;
    // Read addon tables as external data: weapon bases use several sound field conventions.
    const data = weapon.GetTable();
    const primary = record(weapon.Primary ?? data?.Primary);
    return sound(primary?.Sound) ?? sound(weapon.ShootSound ?? data?.ShootSound) ??
        sound(weapon.FireSound ?? data?.FireSound) ?? sound(primary?.FireSound);
}
export function captureSound(this: void, player: ZPServerPlayer, previous?: GLuaWeapon): string {
    const selected = previous && weaponSound(previous);
    const active = selected ?? weaponSound(player.GetActiveWeapon());
    if (active) return active;
    for (const weapon of player.GetWeapons()) {
        const fallback = weaponSound(weapon);
        if (fallback) return fallback;
    }
    return "Weapon_AR2.Single";
}

hook.Add("PlayerSwitchWeapon", "ZPDecoySound", (player, previous, next) => {
    if (IsValid(next) && next.GetClass() === "zp_decoy_grenade_thrower") next.DecoySound = captureSound(player, previous);
});
