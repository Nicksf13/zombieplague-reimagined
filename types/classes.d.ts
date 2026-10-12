interface ZPAbility {
    DrainOnActivation: boolean;
    Drain: number;
    MaxAbilityPower: number;
    CanUseAbility(this: ZPAbility): boolean;
    UseAction(this: ZPAbility, ply: ZPServerPlayer): void;
}
interface ZPClassDefinition {
    Name: string;
    Description: string;
    MaxHealth: number;
    Armor?: number;
    PModel: string;
    Speed: number;
    RunSpeed: number;
    CrouchSpeed: number;
    Gravity: number;
    Battery?: number;
    Breath: number;
    JumpPower: number;
    Footstep: boolean;
    DamageAmplifier: number;
    Order: number;
    Scale?: number;
    Ability?: ZPAbility;
    FallFunction(this: ZPClassDefinition): boolean;
    ShouldBeEnabled(this: ZPClassDefinition): boolean;
    WeaponGive?(this: ZPClassDefinition, ply: ZPServerPlayer): void;
    InfectionFunction?: (this: void, attacker: ZPServerPlayer, infected: ZPServerPlayer) => void;
}
interface ZPServerClassManager {
    ZombieClasses: Record<string, ZPClassDefinition>;
    HumanClasses: Record<string, ZPClassDefinition>;
    GetZombieClasses(this: ZPServerClassManager): Record<string, ZPClassDefinition>;
    GetHumanClasses(this: ZPServerClassManager): Record<string, ZPClassDefinition>;
    GetZPClass(this: ZPServerClassManager, id: string, team: ZPTeam): ZPClassDefinition | undefined;
    GetHumanClass(this: ZPServerClassManager, id: string): ZPClassDefinition | undefined;
    GetZombieClass(this: ZPServerClassManager, id: string): ZPClassDefinition | undefined;
    SetZPClass(this: ZPServerClassManager, ply: ZPServerPlayer, id: string, team: ZPTeam): void;
    NewHumanClass(this: ZPServerClassManager): ZPClassDefinition;
    NewZombieClass(this: ZPServerClassManager): ZPClassDefinition;
    AddZPClass(this: ZPServerClassManager, id: string, definition: ZPClassDefinition, team: ZPTeam): void;
    CreateClassAbility(this: ZPServerClassManager, drain: boolean,
        activate: (this: void, ply: ZPServerPlayer) => void,
        reset?: (this: void, ply: ZPServerPlayer) => void, delay?: number): ZPAbility;
}
interface ZPExtraItem {
    ID?: string;
    Name?: string;
    Price?: number;
    Type?: 0 | 1;
    Order: number;
    BuySounds?: string[];
    OnBuy?(this: ZPExtraItem, ply: ZPServerPlayer): void;
    CanBuy(this: ZPExtraItem, ply: ZPServerPlayer): boolean;
    ShouldBeEnabled(this: ZPExtraItem): boolean;
    RemoveFunction?: (this: void) => void;
}
interface ZPServerPlayer {
    SetAbilityTimer(this: ZPServerPlayer, name: string, delay: number, reset: (this: void) => void): void;
    GetAbilityPower(this: ZPServerPlayer): number;
    DrainAbilityPower(this: ZPServerPlayer, amount: number): void;
    GetZPClass(this: ZPServerPlayer): ZPClassDefinition;
    SetHumanClass(this: ZPServerPlayer, value: ZPClassDefinition): void;
    SetZombieClass(this: ZPServerPlayer, value: ZPClassDefinition): void;
    SetNextHumanClass(this: ZPServerPlayer, value: ZPClassDefinition): void;
    SetNextZombieClass(this: ZPServerPlayer, value: ZPClassDefinition): void;
    IsNemesis(this: ZPServerPlayer): boolean | undefined;
    IsSurvivor(this: ZPServerPlayer): boolean | undefined;
    OldHealth?: number;
    OldMaxHealth?: number;
    OldSpeed?: number;
    OldRunSpeed?: number;
    OldJumpPower?: number;
    CamouflageZombieWeapon?: string;
    Health(this: ZPServerPlayer): number;
    Armor(this: ZPServerPlayer): number;
    GetMaxHealth(this: ZPServerPlayer): number;
    GetWalkSpeed(this: ZPServerPlayer): number;
    GetRunSpeed(this: ZPServerPlayer): number;
    GetJumpPower(this: ZPServerPlayer): number;
    SetHealth(this: ZPServerPlayer, value: number): void;
    SetArmor(this: ZPServerPlayer, value: number): void;
    SetMaxHealth(this: ZPServerPlayer, value: number): void;
    SetWalkSpeed(this: ZPServerPlayer, value: number): void;
    SetRunSpeed(this: ZPServerPlayer, value: number): void;
    SetCrouchedWalkSpeed(this: ZPServerPlayer, value: number): void;
    SetAuxGravity(this: ZPServerPlayer, value: number): void;
    SetJumpPower(this: ZPServerPlayer, value: number): void;
    SetModel(this: ZPServerPlayer, model: string): void;
    SetupHands(this: ZPServerPlayer): void;
    Kill(this: ZPServerPlayer): void;
    EmitSound(this: ZPServerPlayer, path: string): void;
    GetWeapons(this: ZPServerPlayer): GLuaWeapon[];
    GetZombieClass(this: ZPServerPlayer): ZPClassDefinition;
    GetHumanClass(this: ZPServerPlayer): ZPClassDefinition;
    GiveZombieAllowedWeapon(this: ZPServerPlayer, id: string): void;
    RemoveZombieAllowedWeapon(this: ZPServerPlayer, id: string): void;
    SelectWeapon(this: ZPServerPlayer, id: string): void;
    ZombieMadness(this: ZPServerPlayer, duration?: number): void;
}
interface GLuaWeapon {
    GetClass(this: GLuaWeapon): string;
    Clip1(this: GLuaWeapon): number;
}
interface ZPServerWeaponManager {
    ServerHasWeapon(this: ZPServerWeaponManager, id: string): boolean;
    IsChoosableWeapon(this: ZPServerWeaponManager, id: string): boolean;
    AddWeaponMultiplier(this: ZPServerWeaponManager, id: string, multiplier: number): void;
}
interface ZPRoundDefinition {
    Name: string;
    StartFunction(this: void, ply?: ZPServerPlayer): void;
}
interface ZPServerRoundManager {
    GetRounds(this: ZPServerRoundManager): Record<string, ZPRoundDefinition>;
    StartRound(this: ZPServerRoundManager, round: ZPRoundDefinition, ply?: ZPServerPlayer): void;
    GetAliveHumans(this: ZPServerRoundManager): ZPServerPlayer[];
    GetAliveZombies(this: ZPServerRoundManager): ZPServerPlayer[];
}
interface ZPInfectionManager {
    Infect(this: ZPInfectionManager, target: ZPServerPlayer, attacker: ZPServerPlayer): void;
    Cure(this: ZPInfectionManager, target: ZPServerPlayer, attacker: ZPServerPlayer): void;
}
declare const InfectionManager: ZPInfectionManager;
declare const ZPClass: ZPClassDefinition;
declare const ExtraItem: ZPExtraItem;
declare const ITEM_HUMAN: 0;
declare const ITEM_ZOMBIE: 1;
declare const WMODE_NONE: 0;
/** @noSelf */
declare namespace timer {
    function RepsLeft(name: string): number;
    function Destroy(name: string): void;
}
interface ZPGlobals { ClassManager: ZPServerClassManager; ZPClass: ZPClassDefinition; }
