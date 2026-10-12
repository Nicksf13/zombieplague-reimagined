interface GLuaVector { x: number; y: number; z: number; }
interface GLuaEntity {
    SetKeyValue(this: GLuaEntity, key: string, value: string | number): void;
    SetOwner(this: GLuaEntity, ply: ZPPlayer): void;
    SetPos(this: GLuaEntity, position: GLuaVector): void;
    Spawn(this: GLuaEntity): void;
    Activate(this: GLuaEntity): void;
    Fire(this: GLuaEntity, input: string, parameter: string, delay: number): void;
}
interface ZPServerPlayer { GetPos(this: ZPServerPlayer): GLuaVector; }
/** @noSelf */
declare namespace ents { function Create(className: string): GLuaEntity; }
/** @noSelf */
declare namespace hook {
    function Add(name: string, id: string, callback: (this: void) => void): void;
    function Remove(name: string, id: string): void;
}
