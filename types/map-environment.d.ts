declare const FCVAR_ARCHIVE: number;
interface ZPMapLightingServer {
    GetSkybox(original?: string): string;
    IsNight(): boolean;
    ApplyEnvironment(): void;
    SyncPlayer(player: ZPPlayer): void;
}
interface ZPMapLightingModule { lighting: ZPMapLightingServer; }
interface ZPSunOrbit {
    Update(seconds: number | undefined, proceduralSky: boolean): void;
    Restore(): void;
}
interface ZPSunOrbitModule { orbit: ZPSunOrbit; }
interface ZPSkyPaint extends GLuaEntity {
    GetTopColor(this: ZPSkyPaint): GLuaVector;
    GetBottomColor(this: ZPSkyPaint): GLuaVector;
    GetSunNormal(this: ZPSkyPaint): GLuaVector;
    GetSunColor(this: ZPSkyPaint): GLuaVector;
    GetDuskIntensity(this: ZPSkyPaint): number;
    GetStarFade(this: ZPSkyPaint): number;
}
interface GLuaEntity {
    GetInternalVariable(this: GLuaEntity, name: "m_vDirection"): GLuaVector | undefined;
    SetSaveValue(this: GLuaEntity, name: "m_vDirection", value: GLuaVector): boolean;
    Remove(this: GLuaEntity): void;
}
declare function include(this: void, path: "sv_sun_orbit.lua"): ZPSunOrbitModule;
declare function include(this: void, path: "sv_map_lighting.lua"): ZPMapLightingModule;
/** @noSelf */
declare namespace os {
    function date(format: "*t"): { hour: number; min: number; sec: number; };
}
interface GLuaConVar { GetString(this: GLuaConVar): string; }
/** @noSelf */
declare namespace ents {
    function FindByClass(className: "env_skypaint"): ZPSkyPaint[];
    function FindByClass(className: string): GLuaEntity[];
}
/** @noSelf */
declare namespace engine { function LightStyle(style: number, pattern: string): void; }
/** @noSelf */
declare namespace cvars {
    function AddChangeCallback(name: string,
        callback: (this: void, name: string, oldValue: string, newValue: string) => void, identifier?: string): void;
}
/** @noSelf */
declare namespace hook {
    function Run(name: "ZPResetSunOrbit"): void;
    function Add(name: "EntityKeyValue", id: string,
        callback: (this: void, entity: GLuaEntity, key: string, value: string) => string | undefined): void;
    function Add(name: "AcceptInput", id: string,
        callback: (this: void, entity: GLuaEntity, input: string, activator: GLuaEntity,
            caller: GLuaEntity, value: string | number | boolean | undefined) => true | undefined): void;
    function Add(name: "ZPPlayerEnvironmentReady", id: string,
        callback: (this: void, player: ZPServerPlayer) => void): void;
}
