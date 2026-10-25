interface ZPBotEstimate { Value: number; Samples: number; }
type ZPBotBehaviorEstimates = Partial<Record<ZPBotProfile, ZPBotEstimate>>;
type ZPBotBehaviorMemory = Record<string, ZPBotBehaviorEstimates | undefined>;
interface ZPBotMemory {
    ID: number; Profile: ZPBotProfile;
    Experience: Record<string, ZPBotEstimate | undefined>;
    Metrics?: ZPBotMetrics;
    Behaviors?: ZPBotBehaviorMemory;
}
interface ZPBotSituation {
    Role: ZPBotRole; Health: number; Distance: number;
    Allies: number; Enemies: number; HasAlly: boolean;
    RecentDamage?: boolean;
}
interface ZPBotStatus { ID: number; Profile: ZPBotProfile; Role: ZPBotRole; Action: ZPBotAction; Samples: number; }
interface GLuaWeapon { HitDistance?: number; }
interface ZPBotManager {
    Available(this: ZPBotManager): number;
    Attach(this: ZPBotManager, ply: ZPServerPlayer, profile?: ZPBotProfile): void;
    GetStatus(this: ZPBotManager, ply: ZPServerPlayer): ZPBotStatus | undefined;
    Diagnostics(this: ZPBotManager, page: number, requestID: number): ZPBotMetricsSnapshot;
    Update(this: ZPBotManager): void;
    Command(this: ZPBotManager, ply: ZPServerPlayer, command: GLuaUserCommand): void;
    Reset(this: ZPBotManager, ply: ZPServerPlayer): void;
    Remove(this: ZPBotManager, ply: ZPServerPlayer): void;
    Damage(this: ZPBotManager, target: GLuaEntity, damage: GLuaDamageInfo, took: boolean): void;
    Infection(this: ZPBotManager, target: ZPServerPlayer, attacker: ZPServerPlayer): void;
    Death(this: ZPBotManager, ply: ZPServerPlayer, killer: GLuaEntity, damage?: GLuaDamageInfo): void;
    EndRound(this: ZPBotManager, result: ZPRoundEndReason): void;
    Save(this: ZPBotManager): void;
}
interface GLuaNavArea {
    IsValid(this: GLuaNavArea): boolean;
    GetID(this: GLuaNavArea): number;
    GetCenter(this: GLuaNavArea): GLuaVector;
    GetAdjacentAreas(this: GLuaNavArea): GLuaNavArea[];
    IsBlocked(this: GLuaNavArea, team: -2 | 0 | 1): boolean;
    IsUnderwater(this: GLuaNavArea): boolean;
    HasAttributes(this: GLuaNavArea, attribute: number): boolean;
    ComputeAdjacentConnectionHeightChange(this: GLuaNavArea, other: GLuaNavArea): number;
}
/** @noSelf */
declare namespace navmesh {
    function IsLoaded(): boolean;
    function GetNearestNavArea(position: GLuaVector, anyZ?: boolean, maxDistance?: number, checkLOS?: boolean, checkGround?: boolean): GLuaNavArea | undefined;
}
interface ZPServerPlayer {
    EyeAngles(this: ZPServerPlayer): GLuaAngle;
    SetEyeAngles(this: ZPServerPlayer, angle: GLuaAngle): void;
    OnGround(this: ZPServerPlayer): boolean;
    GetWeapons(this: ZPServerPlayer): GLuaWeapon[];
}
interface GLuaEntity { WorldSpaceCenter(this: GLuaEntity): GLuaVector; }
interface GLuaUserCommand {
    SetForwardMove(this: GLuaUserCommand, speed: number): void;
    SetSideMove(this: GLuaUserCommand, speed: number): void;
    SetViewAngles(this: GLuaUserCommand, angles: GLuaAngle): void;
    SetButtons(this: GLuaUserCommand, buttons: number): void;
    SelectWeapon(this: GLuaUserCommand, weapon: GLuaWeapon): void;
}
declare const MASK_PLAYERSOLID: number, MASK_SHOT: number, NAV_MESH_CROUCH: number, NAV_MESH_JUMP: number;
/** @noSelf */
declare namespace math { function atan2(y: number, x: number): number; }
/** @noSelf */
declare namespace engine { function TickInterval(): number; }
/** @noSelf */
declare namespace util {
    function SHA256(value: string): string;
    function JSONToTable(json: string): unknown;
    function TableToJSON(value: object, pretty?: boolean): string | undefined;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "PlayerFootstep", id: string, callback: (this: void, ply: ZPServerPlayer, position: GLuaVector, foot: number, sound: string, volume: number) => void): void;
    function Add(name: "DoPlayerDeath", id: string, callback: (this: void, ply: ZPServerPlayer, attacker: GLuaEntity, damage: GLuaDamageInfo) => void): void;
    function Add(name: "PostEntityTakeDamage", id: string, callback: (this: void, target: GLuaEntity, damage: GLuaDamageInfo, tookDamage: boolean) => void): void;
    function Add(name: "ZPInfectionEvent", id: string, callback: (this: void, target: ZPServerPlayer, attacker: ZPServerPlayer) => void): void;
    function Add(name: "ZPCureEvent", id: string, callback: (this: void, target: ZPServerPlayer, attacker?: ZPServerPlayer) => void): void;
}
