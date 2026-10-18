interface GLuaBoostTexture { GetName(this: GLuaBoostTexture): string; }
interface GLuaBoostViewModel {
    GetMaterials(this: GLuaBoostViewModel): string[];
    GetSubMaterial(this: GLuaBoostViewModel, index: number): string;
    SetSubMaterial(this: GLuaBoostViewModel, index: number, material?: string): void;
}
interface GLuaEntity extends GLuaBoostViewModel { GetClass(this: GLuaEntity): string; }
declare function GetRenderTarget(this: void, name: string, width: number, height: number): GLuaBoostTexture;
declare function DisableClipping(this: void, disabled: boolean): boolean;
declare function CreateMaterial(this: void, name: string, shader: string, params: Record<string, string | number>): GLuaMaterial;
/** @noSelf */
declare namespace cam { function Start2D(): void; function End2D(): void; }
/** @noSelf */
declare namespace render {
    function PushRenderTarget(texture: GLuaBoostTexture): void;
    function PopRenderTarget(): void;
    function Clear(red: number, green: number, blue: number, alpha: number): void;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "PostDrawViewModel", id: string,
        callback: (this: void, vm: GLuaEntity, ply: ZPClientPlayer, weapon: GLuaEntity, flags: number) => void): void;
    function Add(name: "PlayerBindPress", id: string,
        callback: (this: void, ply: ZPClientPlayer, bind: string, pressed: boolean) => boolean | undefined): void;
}
