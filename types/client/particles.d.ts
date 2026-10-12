interface ZPClientParticleInfo {
    File: string; Velocity: GLuaClientVector; Gravity: GLuaClientVector; DieTime: number;
    StartAlpha: number; EndAlpha: number; StartSize: number; EndSize: number; Color: GLuaColor;
}
interface ZPClientExplosion { Pos: GLuaClientVector; ParticleInformations: ZPClientParticleInfo[]; }
interface ZPClientParticleManager { EmitParticleEffect(this: ZPClientParticleManager, explosion: ZPClientExplosion): void; }
interface GLuaParticle {
    SetVelocity(this: GLuaParticle, value: GLuaClientVector): void;
    SetDieTime(this: GLuaParticle, value: number): void;
    SetStartAlpha(this: GLuaParticle, value: number): void;
    SetEndAlpha(this: GLuaParticle, value: number): void;
    SetStartSize(this: GLuaParticle, value: number): void;
    SetEndSize(this: GLuaParticle, value: number): void;
    SetColor(this: GLuaParticle, r: number, g: number, b: number): void;
    SetAirResistance(this: GLuaParticle, value: number): void;
    SetCollide(this: GLuaParticle, value: boolean): void;
}
interface GLuaParticleEmitter { Add(this: GLuaParticleEmitter, file: string, pos: GLuaClientVector): GLuaParticle | undefined; Finish(this: GLuaParticleEmitter): void; }
declare function ParticleEmitter(this: void, position: GLuaClientVector): GLuaParticleEmitter | undefined;
declare function isvector(this: void, value: unknown): value is GLuaClientVector;
declare const ParticleEffectManager: ZPClientParticleManager;
interface ZPGlobals { ParticleEffectManager: ZPClientParticleManager; }
