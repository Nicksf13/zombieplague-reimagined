export interface WeaponAmmo {
    Weapon: GLuaWeapon;
    Kind: "ranged" | "melee" | "utility";
    Ready: boolean;
    Reloadable: boolean;
}

const utilities = ["weapon_frag", "weapon_slam", "weapon_bugbait", "weapon_physgun", "weapon_physcannon", "gmod_tool",
    "zp_infection_grenade_thrower", "zp_antidote_grenade_thrower", "zp_decoy_grenade_thrower", "zp_bot_boost_tool", "zp_bot_safe_tool"];

/** Ammo-less tools must not become melee weapons; clipless firearms consume their reserve directly. */
export function inspect(ply: ZPServerPlayer, weapon: GLuaWeapon): WeaponAmmo {
    if (!IsValid(weapon)) return { Weapon: weapon, Kind: "utility", Ready: false, Reloadable: false };
    const id = weapon.GetClass(), capacity = weapon.GetMaxClip1(), clip = weapon.Clip1(), ammo = weapon.GetPrimaryAmmoType();
    const registered = typeof WeaponManager !== "undefined";
    const melee = id === "weapon_crowbar" || id === "weapon_stunstick" || id === ZOMBIE_KNIFE ||
        (registered && WeaponManager.FindWeaponByWeaponId(id, WEAPON_MELEE) !== undefined);
    const ranged = !melee && !utilities.includes(id) && (capacity > 0 || ammo >= 0 ||
        (registered && (WeaponManager.FindWeaponByWeaponId(id, WEAPON_PRIMARY) !== undefined ||
            WeaponManager.FindWeaponByWeaponId(id, WEAPON_SECONDARY) !== undefined)));
    const kind = melee ? "melee" : ranged ? "ranged" : "utility";
    const reserve = ammo >= 0 ? ply.GetAmmoCount(ammo) : 0;
    return { Weapon: weapon, Kind: kind,
        Ready: melee || (ranged && (clip >= 0 && capacity > 0 ? clip > 0 : ammo >= 0 ? reserve > 0 : true)),
        Reloadable: ranged && capacity > 0 && clip >= 0 && clip < capacity && reserve > 0 };
}
