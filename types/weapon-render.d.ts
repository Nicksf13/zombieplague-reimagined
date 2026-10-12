interface GLuaMaterial {}
// Available in CLIENT branches of the shared SWEPs.
/** @noSelf */
declare namespace language { function GetPhrase(phrase: string): string; }
interface GLuaMatrix { Scale(this: GLuaMatrix, value: GLuaVector): void; GetTranslation(this: GLuaMatrix): GLuaVector; GetAngles(this: GLuaMatrix): GLuaAngle; }
interface GLuaEntity {
    LookupBone(this: GLuaEntity, name: string): number | undefined;
    GetBoneMatrix(this: GLuaEntity, index: number): GLuaMatrix | undefined;
    GetBoneCount(this: GLuaEntity): number | undefined;
    GetBoneName(this: GLuaEntity, index: number): string;
    GetBoneParent(this: GLuaEntity, index: number): number;
    ManipulateBoneScale(this: GLuaEntity, index: number, value: GLuaVector): void;
    ManipulateBoneAngles(this: GLuaEntity, index: number, value: GLuaAngle): void;
    ManipulateBonePosition(this: GLuaEntity, index: number, value: GLuaVector): void;
    GetManipulateBoneScale(this: GLuaEntity, index: number): GLuaVector;
    GetManipulateBoneAngles(this: GLuaEntity, index: number): GLuaAngle;
    GetManipulateBonePosition(this: GLuaEntity, index: number): GLuaVector;
    SetMaterial(this: GLuaEntity, material: string): void; GetMaterial(this: GLuaEntity): string;
    SetSkin(this: GLuaEntity, skin: number): void; GetSkin(this: GLuaEntity): number;
    SetBodygroup(this: GLuaEntity, id: number, value: number): void; GetBodygroup(this: GLuaEntity, id: number): number;
    SetParent(this: GLuaEntity, entity: GLuaEntity): void; SetNoDraw(this: GLuaEntity, value: boolean): void;
    EnableMatrix(this: GLuaEntity, name: string, matrix: GLuaMatrix): void;
    DrawModel(this: GLuaEntity): void;
}
interface ZPBoneModification { scale: GLuaVector; pos: GLuaVector; angle: GLuaAngle; }
interface ZPConstructionBase {
    bone: string; rel: string; pos: GLuaVector; angle: GLuaAngle; color: GLuaColor; hide?: boolean;
}
interface ZPModelElement extends ZPConstructionBase {
    type: "Model"; model: string; size: GLuaVector; surpresslightning: boolean;
    bonemerge: boolean; highrender: boolean; nocull: boolean; material: string; skin: number; bodygroup: Record<number, number>;
    modelEnt?: GLuaEntity; createdModel?: string;
}
interface ZPSpriteElement extends ZPConstructionBase {
    type: "Sprite"; sprite: string; size: GLuaVector; spriteMaterial?: GLuaMaterial; createdSprite?: string;
    nocull?: boolean; additive?: boolean; vertexalpha?: boolean; vertexcolor?: boolean; ignorez?: boolean;
}
interface ZPQuadElement extends ZPConstructionBase { type: "Quad"; size: number; draw_func?: (this: void, weapon: ZPScriptedWeapon) => void; }
type ZPConstructionElement = ZPModelElement | ZPSpriteElement | ZPQuadElement;
type ZPConstructionElements = Record<string, ZPConstructionElement>;
interface ZPScriptedWeapon {
    ViewModelFlip: boolean; ShowViewModel: boolean; ShowWorldModel: boolean;
    ViewModelBoneMods: Record<string, ZPBoneModification>; SCKMaterials: Record<string, GLuaMaterial>;
    IronSightsPos: GLuaVector; IronSightsAng: GLuaVector;
    VElements: ZPConstructionElements; WElements: ZPConstructionElements;
    vRenderOrder?: string[]; wRenderOrder?: string[];
    InitializeConstruction(this: ZPScriptedWeapon): void;
    RemoveConstructionModels(this: ZPScriptedWeapon): void;
    ViewModelDrawn(this: ZPScriptedWeapon): void;
    DrawWorldModel(this: ZPScriptedWeapon): void;
    GetBoneOrientation(this: ZPScriptedWeapon, elements: ZPConstructionElements, element: ZPConstructionElement,
        entity: GLuaEntity, override?: string, visited?: Record<string, boolean>): LuaMultiReturn<[GLuaVector | undefined, GLuaAngle | undefined]>;
    CreateModels(this: ZPScriptedWeapon, elements: ZPConstructionElements): void;
    UpdateBonePositions(this: ZPScriptedWeapon, vm: GLuaViewModel): void;
    ResetBonePositions(this: ZPScriptedWeapon, vm: GLuaViewModel): void;
}
declare const RENDER_GROUP_VIEW_MODEL_OPAQUE: number;
declare function ClientsideModel(this: void, model: string, group: number): GLuaEntity;
declare function CreateMaterial(this: void, name: string, shader: string, params: Record<string, string | number>): GLuaMaterial;
declare function Matrix(this: void): GLuaMatrix;
declare function isvector(this: void, value: unknown): value is GLuaVector;
declare function isangle(this: void, value: unknown): value is GLuaAngle;
declare function istable(this: void, value: unknown): value is Record<string, unknown>;
/** @noSelf */
declare namespace file { function Exists(path: string, realm: "GAME"): boolean; }
/** @noSelf */
declare namespace render {
    function SuppressEngineLighting(value: boolean): void;
    function SetColorModulation(r: number, g: number, b: number): void;
    function SetBlend(value: number): void;
    function SetMaterial(material: GLuaMaterial): void;
    function DrawSprite(position: GLuaVector, width: number, height: number, color: GLuaColor): void;
}
/** @noSelf */
declare namespace cam { function Start3D2D(position: GLuaVector, angles: GLuaAngle, scale: number): void; function End3D2D(): void; }
/** @noSelf */
declare namespace table { function FullCopy<T>(value: T): T; }
