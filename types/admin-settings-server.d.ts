declare function GetConVar(this: void, name: string): GLuaConVar | undefined;
interface GLuaConVar { SetString(this: GLuaConVar, value: string): void; }
/** @noSelf */
declare namespace net { function WriteUInt(value: number, bits: number): void; }
