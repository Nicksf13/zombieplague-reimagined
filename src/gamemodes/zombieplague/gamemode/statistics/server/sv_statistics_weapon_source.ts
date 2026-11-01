const weapons = include("sh_statistics_weapons.lua") as typeof import("../shared/sh_statistics_weapons");
const projectiles: Record<string, string> = { grenade_ar2: "weapon_ar2", rpg_missile: "weapon_rpg",
    npc_grenade_frag: "weapon_frag", npc_satchel: "weapon_slam", npc_tripmine: "weapon_slam",
    zp_infection_grenade: "zp_infection_grenade_thrower", zp_antidote_grenade: "zp_antidote_grenade_thrower" };
function definitions(): ZPRegisteredWeapon[] {
    const result: ZPRegisteredWeapon[] = [];
    for (const registry of [WeaponManager?.GetPrimaryWeapons?.(), WeaponManager?.GetSecondaryWeapons?.(), WeaponManager?.GetMeleeWeapons?.()])
        if (registry !== undefined) for (const [, definition] of pairs(registry)) result.push(definition);
    return result;
}
/** Use the damage source, so switching weapons while a projectile travels cannot steal its credit. */
export function identify(attacker: ZPServerPlayer, source?: GLuaEntity): string {
    if (source && IsValid(source) && source !== attacker) {
        const id = source.GetClass?.();
        if (id && weapons.valid(id)) {
            for (const definition of definitions()) if (definition.ProjectileID === id) return definition.WeaponID;
            return projectiles[id] ?? id;
        }
    }
    const active = attacker.GetActiveWeapon?.();
    if (active && IsValid(active)) {
        const id = active.GetClass();
        if (weapons.valid(id)) return id;
    }
    return weapons.unknown;
}
export function name(id: string): string {
    const definition = definitions().find(entry => entry.WeaponID === id);
    return definition?.PrettyName ?? id;
}
