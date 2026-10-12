interface ZPRegisteredWeapon extends ZPWeaponDefinition { PrettyName: string; WeaponID: string; }
type ZPWeaponRegistry = Record<string, ZPRegisteredWeapon>;
interface ZPServerWeaponManager {
    PrimaryWeapons: ZPWeaponRegistry;
    SecondaryWeapons: ZPWeaponRegistry;
    MeleeWeapons: ZPWeaponRegistry;
    WeaponsMultiplier: Record<string, number>;
    ServerWeapons: string[];
    IsChosenWeapon(this: ZPServerWeaponManager, id: string): boolean;
    IsValidWeaponType(this: ZPServerWeaponManager, kind: number): kind is ZPWeaponType;
    CreateNewWeapon(this: ZPServerWeaponManager): ZPWeaponDefinition;
    GetWeaponMultiplier(this: ZPServerWeaponManager, id: string): number | undefined;
    AddWeapon(this: ZPServerWeaponManager, weapon: ZPRegisteredWeapon, kind: ZPWeaponType): void;
    GetPrimaryWeapons(this: ZPServerWeaponManager): ZPWeaponRegistry;
    GetSecondaryWeapons(this: ZPServerWeaponManager): ZPWeaponRegistry;
    GetMeleeWeapons(this: ZPServerWeaponManager): ZPWeaponRegistry;
    GetWeaponsTableByWeaponType(this: ZPServerWeaponManager, kind: ZPWeaponType): ZPWeaponRegistry;
    FindWeaponByWeaponId(this: ZPServerWeaponManager, id: string, kind: ZPWeaponType): ZPRegisteredWeapon | undefined;
    PlayerCanPickupWeapon(this: ZPServerWeaponManager, ply: ZPServerPlayer, id: string): boolean;
    CountPlayerWeaponsByWeaponType(this: ZPServerWeaponManager, ply: ZPServerPlayer, kind: ZPWeaponType): number;
}
interface ZPServerPlayer {
    GetPrimaryWeapon(this: ZPServerPlayer): ZPRegisteredWeapon | undefined;
    GetSecondaryWeapon(this: ZPServerPlayer): ZPRegisteredWeapon | undefined;
    GetMeleeWeapon(this: ZPServerPlayer): ZPRegisteredWeapon | undefined;
    GetPrimaryWeaponGiven(this: ZPServerPlayer): boolean;
    GetSecondaryWeaponGiven(this: ZPServerPlayer): boolean;
    GetMeleeWeaponGiven(this: ZPServerPlayer): boolean;
    SetPrimaryWeapon(this: ZPServerPlayer, weapon: ZPRegisteredWeapon | undefined): void;
    SetSecondaryWeapon(this: ZPServerPlayer, weapon: ZPRegisteredWeapon | undefined): void;
    SetMeleeWeapon(this: ZPServerPlayer, weapon: ZPRegisteredWeapon | undefined): void;
    SetPrimaryWeaponGiven(this: ZPServerPlayer, given: boolean): void;
    SetSecondaryWeaponGiven(this: ZPServerPlayer, given: boolean): void;
    SetMeleeWeaponGiven(this: ZPServerPlayer, given: boolean): void;
    GiveWeapon(this: ZPServerPlayer, weapon: ZPRegisteredWeapon): void;
}
interface ZPGlobals {
    Weapon: ZPWeaponDefinition;
    WeaponManager: ZPServerWeaponManager;
    NATIVE_WEAPONS: string[];
    WEAPON_PRIMARY: 1;
    WEAPON_SECONDARY: 2;
    WEAPON_MELEE: 3;
}
declare const NATIVE_WEAPONS: string[];
/** @noSelf */
declare namespace resource { function AddFile(path: string): void; }
/** @noSelf */
declare namespace weapons { function GetList(): { ClassName: string }[]; }
/** @noSelf */
declare namespace net {
    function ReadBool(): boolean;
    function ReadTable(): unknown;
}
