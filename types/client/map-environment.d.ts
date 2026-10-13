/** @noSelf */
declare namespace render {
    function RedownloadAllLightmaps(staticProps?: boolean, updateStaticLighting?: boolean): void;
    function SuppressEngineLighting(suppress: boolean): void;
    function ResetModelLighting(red: number, green: number, blue: number): void;
}
interface GLuaMaterial {
    GetName(this: GLuaMaterial): string;
    GetShader(this: GLuaMaterial): string;
    GetVector(this: GLuaMaterial, parameter: string): GLuaVector | undefined;
    SetVector(this: GLuaMaterial, parameter: string, value: GLuaVector): void;
    Recompute(this: GLuaMaterial): void;
}
interface GLuaVector { x: number; y: number; z: number; }
/** @noSelf */
declare namespace util {
    function GetModelMeshes(model: string): { material: string }[] | undefined;
}
interface GLuaBrushSurface { GetMaterial(this: GLuaBrushSurface): GLuaMaterial; }
interface GLuaEntity {
    IsWorld(this: GLuaEntity): boolean;
    GetMaterials(this: GLuaEntity): string[];
    GetBrushSurfaces(this: GLuaEntity): GLuaBrushSurface[] | undefined;
}
declare function Vector(this: void, x: number, y: number, z: number): GLuaVector;
declare function Material(this: void, name: string): GLuaMaterial;
/** @noSelf */
declare namespace game {
    function GetWorld(): GLuaEntity;
    function GetMap(): string;
}
interface GLuaMapFile {
    Seek(this: GLuaMapFile, position: number): void;
    ReadLong(this: GLuaMapFile): number;
    Read(this: GLuaMapFile, length: number): string;
    Size(this: GLuaMapFile): number;
    Close(this: GLuaMapFile): void;
}
/** @noSelf */
declare namespace file {
    function Open(path: string, mode: "rb", realm: "GAME"): GLuaMapFile | undefined;
}
interface ZPMapMaterialCatalogModule {
    ReadMapMaterialNames(this: void): string[];
    IsStaticPropMaterial(this: void, name: string): boolean;
}
declare function include(this: void, path: "cl_map_material_catalog.lua"): ZPMapMaterialCatalogModule;
/** @noSelf */
declare namespace string {
    function gmatch(text: string, pattern: "%b{}"): LuaIterable<string>;
    function gmatch(text: string, pattern: '"([^"]+)"%s*"([^"]*)"'):
        LuaIterable<LuaMultiReturn<[string, string]>>;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "PreRender" | "ShutDown" | "ZPResetMapMaterials" |
        "PostDrawOpaqueRenderables" | "PostDrawTranslucentRenderables" | "PreDrawHUD" | "PostRender" |
        "PreDrawViewModels" | "PreDrawEffects", id: string,
        callback: (this: void) => void): void;
    function Add(name: "PreDrawViewModel", id: string,
        callback: (this: void, viewmodel: GLuaEntity, ply: ZPClientPlayer, weapon: GLuaEntity, flags: number) => void): void;
    function Add(name: "PreDrawPlayerHands", id: string,
        callback: (this: void, hands: GLuaEntity, viewmodel: GLuaEntity, ply: ZPClientPlayer,
            weapon: GLuaEntity, flags: number) => void): void;
    function Add(name: "PreDrawOpaqueRenderables" | "PreDrawTranslucentRenderables", id: string,
        callback: (this: void, drawingDepth: boolean, drawingSkybox: boolean, drawing3DSkybox: boolean) => void): void;
    function Run(name: "ZPResetMapMaterials"): void;
    function Remove(name: string, id: string): void;
}
