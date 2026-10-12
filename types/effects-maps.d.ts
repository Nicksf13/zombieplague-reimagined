interface ZPParticleInfo {
    File: string;
    Gravity: GLuaVector;
    Velocity: GLuaVector;
    DieTime: number;
    StartAlpha: number;
    EndAlpha: number;
    StartSize: number;
    EndSize: number;
    Color: GLuaColor;
}
interface ZPExplosion { Pos: GLuaVector; ParticleInformations: ZPParticleInfo[]; }
interface ZPServerParticleManager {
    EmitExplosion(this: ZPServerParticleManager, amount: number, color: GLuaColor, position: GLuaVector): void;
    CreateExplosionParticleEffect(this: ZPServerParticleManager, color: GLuaColor): ZPParticleInfo;
    EmitParticleEffect(this: ZPServerParticleManager, explosion: ZPExplosion): void;
}
interface ZPMapConfig {
    Prefix?: string;
    MapName?: string;
    Start?(this: ZPMapConfig, round?: ZPRoundDefinition): void;
}
interface ZPServerMapManager {
    Configs: ZPMapConfig[];
    AddMapConfig(this: ZPServerMapManager, config: ZPMapConfig): void;
    GetMapConfig(this: ZPServerMapManager, name: string): ZPMapConfig | undefined;
}
interface ZPServerPlayer {
    Infect(this: ZPServerPlayer, silent?: boolean): void;
    Cure(this: ZPServerPlayer): void;
    AddFrags(this: ZPServerPlayer, amount: number): void;
    AddDeaths(this: ZPServerPlayer, amount: number): void;
    AddPoints(this: ZPServerPlayer, amount: number): void;
    Spawn(this: ZPServerPlayer): void;
}
interface ZPGlobals {
    InfectionManager: ZPInfectionManager;
    ParticleEffectManager: ZPServerParticleManager;
    MapManager: ZPServerMapManager;
    MapConfig: ZPMapConfig;
}
declare const GAMEMODE: ZPGameMode;
declare const ParticleEffectManager: ZPServerParticleManager;
declare const MapConfig: ZPMapConfig;
declare function Vector(this: void, x: number, y: number, z: number): GLuaVector;
/** @noSelf */
declare namespace math {
    function random(min: number, max: number): number;
    function Rand(min: number, max: number): number;
}
/** @noSelf */
declare namespace hook {
    function Call(name: string, gamemode?: ZPGameMode, ...args: unknown[]): unknown;
    function Add(name: "ZPPrePreparingRound", id: string, callback: (this: void, round?: ZPRoundDefinition) => void): void;
}
/** @noSelf */
declare namespace game { function GetMap(): string; }
/** @noSelf */
declare namespace string { function StartWith(text: string, prefix: string): boolean; }
