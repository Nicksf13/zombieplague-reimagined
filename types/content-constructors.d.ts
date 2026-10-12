type ZPWeaponOptions = Pick<ZPRegisteredWeapon, "PrettyName" | "WeaponID"> &
    Partial<Omit<ZPRegisteredWeapon, "PrettyName" | "WeaponID">>;
type ZPExtraItemOptions = Pick<ZPRegisteredExtraItem, "ID" | "Name" | "Price" | "OnBuy"> &
    Partial<Omit<ZPRegisteredExtraItem, "ID" | "Name" | "Price" | "OnBuy">>;
type ZPPlayerClassOptions = { ID: string } & Partial<ZPClassDefinition>;
interface ZPRegisteredPlayerClass extends ZPClassDefinition {
    ID: string;
    readonly Team: typeof TEAM_HUMANS | typeof TEAM_ZOMBIES;
}
interface ZPWeaponConstructor {
    new(options: ZPWeaponOptions): ZPRegisteredWeapon;
    prototype: ZPRegisteredWeapon;
}
interface ZPExtraItemConstructor {
    new(options: ZPExtraItemOptions): ZPRegisteredExtraItem;
}
interface ZPPlayerClassConstructor {
    new(options: ZPPlayerClassOptions): ZPRegisteredPlayerClass;
}
declare const WeaponDefinition: ZPWeaponConstructor;
declare const ExtraItemDefinition: ZPExtraItemConstructor;
declare const HumanClassDefinition: ZPPlayerClassConstructor;
declare const ZombieClassDefinition: ZPPlayerClassConstructor;
interface ZPGlobals {
    WeaponDefinition: ZPWeaponConstructor;
    ExtraItemDefinition: ZPExtraItemConstructor;
    HumanClassDefinition: ZPPlayerClassConstructor;
    ZombieClassDefinition: ZPPlayerClassConstructor;
}
