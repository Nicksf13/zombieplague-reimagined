type ZPWeaponType = 1 | 2 | 3;

interface GLuaWeapon {
    GetMaxClip1(this: GLuaWeapon): number;
    GetMaxClip2(this: GLuaWeapon): number;
    GetPrimaryAmmoType(this: GLuaWeapon): number;
    GetSecondaryAmmoType(this: GLuaWeapon): number;
}

interface ZPServerPlayer {
    GetWeapon(this: ZPServerPlayer, id: string): GLuaWeapon;
    Give(this: ZPServerPlayer, id: string): GLuaWeapon;
    GiveAmmo(this: ZPServerPlayer, amount: number, ammoType: number | string, hidePopup?: boolean): number;
}

interface ZPWeaponDefinition {
    Family?: ZPWeaponFamily;
    PrettyName?: string;
    NamePhrase?: string;
    Description?: string;
    WeaponID?: string;
    WeaponType: ZPWeaponType;
    DamageMultiplier: number;
    Order: number;
    ProjectileID?: string;
    GiveWeapon(this: ZPWeaponDefinition, ply: ZPServerPlayer): void;
    ShouldBeEnabled(this: ZPWeaponDefinition): boolean;
}



declare const WEAPON_PRIMARY: 1;
declare const WEAPON_SECONDARY: 2;
declare const WEAPON_MELEE: 3;
// The legacy loader creates the mutable definition before including each file.
declare const Weapon: ZPWeaponDefinition;
declare function IsValid(this: void, value: unknown): boolean;
declare function RunConsoleCommand(this: void, name: string, ...args: string[]): void;
