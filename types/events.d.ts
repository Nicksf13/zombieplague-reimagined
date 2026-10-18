interface GLuaEntity {
    GetClass(this: GLuaEntity): string;
    IsPlayer(this: GLuaEntity): this is ZPServerPlayer;
}
interface ZPServerPlayer extends GLuaEntity {
    FirstSpawn?: boolean;
    DeathTime?: number;
    KillSilent(this: ZPServerPlayer): void;
    UnSpectate(this: ZPServerPlayer): void;
    Spectate(this: ZPServerPlayer, mode: number): void;
    GetObserverTarget(this: ZPServerPlayer): GLuaEntity;
    GetObserverMode(this: ZPServerPlayer): number;
    KeyPressed(this: ZPServerPlayer, key: number): boolean;
    KeyDown(this: ZPServerPlayer, key: number): boolean;
    WaterLevel(this: ZPServerPlayer): number;
    GetGravity(this: ZPServerPlayer): number;
    SetGravity(this: ZPServerPlayer, gravity: number): void;
    GetAmmoCount(this: ZPServerPlayer, ammo: number): number;
    SetAmmo(this: ZPServerPlayer, count: number, ammo: number): void;
}
interface GLuaWeapon { GetClass(this: GLuaWeapon): string; SetClip1(this: GLuaWeapon, count: number): void; }
interface GLuaDamageInfo {
    GetAttacker(this: GLuaDamageInfo): GLuaEntity;
    GetInflictor(this: GLuaDamageInfo): GLuaEntity;
    GetDamage(this: GLuaDamageInfo): number;
    ScaleDamage(this: GLuaDamageInfo, factor: number): void;
    IsDamageType(this: GLuaDamageInfo, kind: number): boolean;
}
interface GLuaMoveData { KeyDown(this: GLuaMoveData, key: number): boolean; }
interface ZPGameMode {
    EntityTakeDamage(this: ZPGameMode, target: GLuaEntity, damage: GLuaDamageInfo): boolean | undefined;
    GetFallDamage(this: ZPGameMode, ply: ZPServerPlayer, speed: number): number;
    PlayerShouldTakeDamage(this: ZPGameMode, ply: ZPServerPlayer, attacker: GLuaEntity): boolean;
    AllowPlayerPickup(this: ZPGameMode, ply: ZPServerPlayer, item: GLuaEntity): boolean;
    PlayerDeathSound(this: ZPGameMode): boolean;
    PlayerCanHearPlayersVoice(this: ZPGameMode, listener: ZPServerPlayer, talker: ZPServerPlayer): boolean;
    PlayerCanSeePlayersChat(this: ZPGameMode, text: string, team: boolean, listener: ZPServerPlayer, talker: ZPServerPlayer): boolean;
    PlayerSpawn(this: ZPGameMode, ply: ZPServerPlayer): void;
    PlayerDeathThink(this: ZPGameMode, ply: ZPServerPlayer): boolean;
    PlayerLoadout(this: ZPGameMode, ply: ZPServerPlayer): void;
    PlayerSetModel(this: ZPGameMode, ply: ZPServerPlayer): void;
    PlayerCanPickupWeapon(this: ZPGameMode, ply: ZPServerPlayer, weapon: GLuaWeapon): boolean;
    CanPlayerSuicide(this: ZPGameMode, ply: ZPServerPlayer): boolean;
    PlayerShouldTaunt(this: ZPGameMode): boolean;
}
declare const DMG_FALL: number;
declare const DMG_BURN: number;
declare const OBS_MODE_ROAMING: number;
declare const OBS_MODE_CHASE: number;
declare const IN_ATTACK: number, IN_ATTACK2: number, IN_BACK: number, IN_DUCK: number,
    IN_FORWARD: number, IN_JUMP: number, IN_MOVELEFT: number, IN_MOVERIGHT: number,
    IN_RELOAD: number, IN_SPEED: number, IN_USE: number, IN_WALK: number, IN_ZOOM: number,
    IN_WEAPON1: number, IN_WEAPON2: number;
declare const WMODE_INFINITE_CLIP: 1, WMODE_INFINITE: 2;
declare function PlayerCanSpawn(this: void, ply: ZPServerPlayer): boolean;
declare function CalculateSpectator(this: void, ply: ZPServerPlayer): void;
declare function ShouldResetSpectate(this: void, ply: ZPServerPlayer, teamOnly: boolean): boolean;
declare function ToggleNightvision(this: void, ply: ZPServerPlayer): void;
declare function FlashlightShouldDrain(this: void): boolean;
declare function NightvisionShouldDrain(this: void): boolean;
declare function VoiceShouldDrain(this: void): boolean;
declare function WaterShouldDrain(this: void): boolean;
declare function RunShouldDrain(this: void, ply: ZPServerPlayer): boolean;
interface ZPGlobals {
    FALL_DMG_NONE: 0; FALL_DMG_ZOMBIES: 1; FALL_DMG_HUMANS: 2; FALL_DMG_ALL: 3;
    WMODE_NONE: 0; WMODE_INFINITE_CLIP: 1; WMODE_INFINITE: 2;
    PlayerCanSpawn: typeof PlayerCanSpawn; CalculateSpectator: typeof CalculateSpectator;
    ShouldResetSpectate: typeof ShouldResetSpectate; ToggleNightvision: typeof ToggleNightvision;
    FlashlightShouldDrain: typeof FlashlightShouldDrain; NightvisionShouldDrain: typeof NightvisionShouldDrain;
    VoiceShouldDrain: typeof VoiceShouldDrain; WaterShouldDrain: typeof WaterShouldDrain; RunShouldDrain: typeof RunShouldDrain;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "ZPDamageAttackerIsPlayer", id: string, action: (this: void, attacker: ZPServerPlayer, target: GLuaEntity, damage: GLuaDamageInfo) => void): void;
    function Add(name: "ZPZombieTakeDamage", id: string, action: (this: void, target: ZPServerPlayer, damage: GLuaDamageInfo) => void): void;
    function Add(name: "ZPZombieInflictedDamageOnPlayer" | "ZPHumanInflictedDamageOnPlayer", id: string, action: (this: void, attacker: ZPServerPlayer, target: ZPServerPlayer, damage: GLuaDamageInfo) => void): void;
    function Add(name: "PlayerDeath", id: string, action: (this: void, ply: ZPServerPlayer, weapon: GLuaEntity, killer: GLuaEntity) => void): void;
    function Add(name: "ZPFirstZombieEvent" | "ZPSuffocate" | "ZPCureEvent" | "PlayerBatteryOver", id: string, action: (this: void, ply: ZPServerPlayer) => void): void;
    function Add(name: "SetupMove", id: string, action: (this: void, ply: ZPServerPlayer, move: GLuaMoveData) => void): void;
}
