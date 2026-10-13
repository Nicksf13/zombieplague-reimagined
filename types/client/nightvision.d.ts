interface GLuaNightvisionAngle { p: number; y: number; r: number; }
interface ZPClientPlayer {
    EyeAngles(this: ZPClientPlayer): GLuaNightvisionAngle;
}
interface GLuaNightvisionLight {
    IsValid(this: GLuaNightvisionLight): boolean;
    SetTexture(this: GLuaNightvisionLight, texture: string): void;
    SetFOV(this: GLuaNightvisionLight, fov: number): void;
    SetNearZ(this: GLuaNightvisionLight, distance: number): void;
    SetFarZ(this: GLuaNightvisionLight, distance: number): void;
    SetBrightness(this: GLuaNightvisionLight, brightness: number): void;
    SetEnableShadows(this: GLuaNightvisionLight, enabled: boolean): void;
    SetPos(this: GLuaNightvisionLight, position: GLuaClientVector): void;
    SetAngles(this: GLuaNightvisionLight, angles: GLuaNightvisionAngle): void;
    SetColor(this: GLuaNightvisionLight, color: GLuaColor): void;
    Update(this: GLuaNightvisionLight): void;
    Remove(this: GLuaNightvisionLight): void;
}
declare function ProjectedTexture(this: void): GLuaNightvisionLight | undefined;
/** @noSelf */
declare namespace hook {
    function Add(name: "ZPResetNightvisionLight", id: string, callback: (this: void) => void): void;
    function Run(name: "ZPResetNightvisionLight"): void;
}
