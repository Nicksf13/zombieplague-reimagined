for (const kind of ["primary", "secondary", "melee"]) {
    ConvarManager.CreateConVar("zp_max_allowed_" + kind + "_weapons", 1, 8, "cvar used to define how many " + kind + " weapons a player can have");
}
_G.WEAPON_PRIMARY = 1;
_G.WEAPON_SECONDARY = 2;
_G.WEAPON_MELEE = 3;
_G.NATIVE_WEAPONS = ["weapon_357", "weapon_ar2", "weapon_crossbow", "weapon_pistol", "weapon_smg1",
    "weapon_shotgun", "weapon_crowbar", "weapon_stunstick"];
include("sv_weapon_definition.lua");
function isRegistered(this: void, weapon: ZPWeaponDefinition): weapon is ZPRegisteredWeapon {
    return weapon.PrettyName !== undefined && weapon.WeaponID !== undefined;
}
export class WeaponManager implements ZPServerWeaponManager {
    PrimaryWeapons: ZPWeaponRegistry = {};
    SecondaryWeapons: ZPWeaponRegistry = {};
    MeleeWeapons: ZPWeaponRegistry = {};
    WeaponsMultiplier: Record<string, number> = {};
    ServerWeapons: string[] = [...NATIVE_WEAPONS];
    SearchWeapons(): void {
        for (const weapon of weapons.GetList())
            this.ServerWeapons.push(weapon.ClassName);
        for (const [, path] of pairs(Utils.RecursiveFileSearch("zombieplague/gamemode/weapons", ".lua"))) {
            _G.Weapon = this.CreateNewWeapon();
            const loaded = include(path);
            const exported = typeof loaded === "object" && loaded !== null && "default" in loaded ? loaded.default : loaded;
            const definition = exported instanceof WeaponDefinition ? exported : Weapon;
            if (!definition.PrettyName)
                Utils.Print(WARNING_MESSAGE, "Cannot load: '" + path + "', unknown 'Pretty Name'!");
            else if (!definition.WeaponID)
                Utils.Print(WARNING_MESSAGE, "Cannot load: '" + path + "', unknown 'WeaponID'!");
            else if (!this.IsValidWeaponType(definition.WeaponType))
                Utils.Print(WARNING_MESSAGE, "Cannot load: '" + path + "', Invalid weapon type!");
            else if (isRegistered(definition) && this.ServerHasWeapon(definition.WeaponID) && definition.ShouldBeEnabled()) {
                this.AddWeapon(definition, definition.WeaponType);
            }
        }
    }
    ServerHasWeapon(id: string): boolean { return this.ServerWeapons.includes(id); }
    IsChoosableWeapon(id: string): boolean {
        for (const [, weapon] of pairs(this.PrimaryWeapons))
            if (weapon.WeaponID === id)
                return true;
        for (const [, weapon] of pairs(this.SecondaryWeapons))
            if (weapon.WeaponID === id)
                return true;
        return false;
    }
    IsChosenWeapon(id: string): boolean { return this.IsChoosableWeapon(id); }
    IsValidWeaponType(kind: number): kind is ZPWeaponType {
        return kind === WEAPON_PRIMARY || kind === WEAPON_SECONDARY || kind === WEAPON_MELEE;
    }
    CreateNewWeapon(): ZPWeaponDefinition {
        return {
            WeaponType: WEAPON_PRIMARY, DamageMultiplier: 1, Order: 100,
            GiveWeapon: WeaponDefinition.prototype.GiveWeapon,
            ShouldBeEnabled: WeaponDefinition.prototype.ShouldBeEnabled,
        };
    }
    GetWeaponMultiplier(id: string): number | undefined { return this.WeaponsMultiplier[id]; }
    AddWeaponMultiplier(id: string, multiplier: number): void { this.WeaponsMultiplier[id] = multiplier; }
    AddWeapon(weapon: ZPRegisteredWeapon, kind: ZPWeaponType): void {
        this.GetWeaponsTableByWeaponType(kind)[weapon.WeaponID] = weapon;
        this.AddWeaponMultiplier(weapon.ProjectileID ?? weapon.WeaponID, weapon.DamageMultiplier);
    }
    GetPrimaryWeapons(): ZPWeaponRegistry { return this.PrimaryWeapons; }
    GetSecondaryWeapons(): ZPWeaponRegistry { return this.SecondaryWeapons; }
    GetMeleeWeapons(): ZPWeaponRegistry { return this.MeleeWeapons; }
    GetWeaponsTableByWeaponType(kind: ZPWeaponType): ZPWeaponRegistry {
        return kind === WEAPON_PRIMARY ? this.PrimaryWeapons : kind === WEAPON_SECONDARY ? this.SecondaryWeapons : this.MeleeWeapons;
    }
    FindWeaponByWeaponId(id: string, kind: ZPWeaponType): ZPRegisteredWeapon | undefined {
        for (const [, weapon] of pairs(this.GetWeaponsTableByWeaponType(kind)))
            if (weapon.WeaponID === id)
                return weapon;
        return undefined;
    }
    PlayerCanPickupWeapon(ply: ZPServerPlayer, id: string): boolean {
        for (const [kind, name] of [[WEAPON_PRIMARY, "primary"], [WEAPON_SECONDARY, "secondary"], [WEAPON_MELEE, "melee"]] as const) {
            if (this.GetWeaponsTableByWeaponType(kind)[id]) {
                return this.CountPlayerWeaponsByWeaponType(ply, kind) < cvars.Number("zp_max_allowed_" + name + "_weapons", 1);
            }
        }
        return true;
    }
    CountPlayerWeaponsByWeaponType(ply: ZPServerPlayer, kind: ZPWeaponType): number {
        const registry = this.GetWeaponsTableByWeaponType(kind);
        let count = 0;
        for (const weapon of ply.GetWeapons())
            if (registry[weapon.GetClass()])
                count++;
        return count;
    }

}
const weaponManager = new WeaponManager();
_G.WeaponManager = weaponManager;
