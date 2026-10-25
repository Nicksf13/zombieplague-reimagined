interface ZPClientPlayer {
    OBBMins(this: ZPClientPlayer): GLuaVector;
    OBBMaxs(this: ZPClientPlayer): GLuaVector;
    IsDormant(this: ZPClientPlayer): boolean;
    GetNoDraw(this: ZPClientPlayer): boolean;
    ShouldDrawLocalPlayer(this: ZPClientPlayer): boolean;
}
declare function EyePos(this: void): GLuaVector;
declare const OBS_MODE_IN_EYE: number;
interface GLuaMaterialTexture {
    GetName(this: GLuaMaterialTexture): string;
    IsError(this: GLuaMaterialTexture): boolean;
    IsErrorTexture(this: GLuaMaterialTexture): boolean;
}
interface GLuaMaterial {
    GetTexture(this: GLuaMaterial, parameter: string): GLuaMaterialTexture | undefined;
    SetTexture(this: GLuaMaterial, parameter: string, texture: GLuaMaterialTexture): void;
}
/** @noSelf */
declare namespace render {
    function SetMaterial(material: GLuaMaterial): void;
    function DrawBeam(start: GLuaVector, end: GLuaVector, width: number,
        textureStart: number, textureEnd: number, color: GLuaColor): void;
    function DrawSprite(position: GLuaVector, width: number, height: number, color: GLuaColor): void;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "PostDrawTranslucentRenderables", id: string,
        callback: (this: void, drawingDepth: boolean, drawingSkybox: boolean, drawing3DSkybox: boolean) => void): void;
}
