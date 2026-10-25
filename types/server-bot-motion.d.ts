interface ZPServerPlayer {
    GetStepSize(this: ZPServerPlayer): number;
    GetHull(this: ZPServerPlayer): LuaMultiReturn<[GLuaVector, GLuaVector]>;
    GetHullDuck(this: ZPServerPlayer): LuaMultiReturn<[GLuaVector, GLuaVector]>;
    GetCrouchedWalkSpeed(this: ZPServerPlayer): number;
    GetMoveType(this: ZPServerPlayer): number;
    GetVelocity(this: ZPServerPlayer): GLuaVector;
}
interface GLuaEntity { GetName(this: GLuaEntity): string; }
interface GLuaNavArea {
    GetHidingSpots(this: GLuaNavArea, type?: number): GLuaVector[];
    Contains(this: GLuaNavArea, position: GLuaVector): boolean;
    GetClosestPointOnArea(this: GLuaNavArea, position: GLuaVector): GLuaVector;
    GetLadders(this: GLuaNavArea): GLuaNavLadder[];
}
interface GLuaNavLadder {
    IsValid(this: GLuaNavLadder): boolean;
    GetID(this: GLuaNavLadder): number;
    GetBottom(this: GLuaNavLadder): GLuaVector;
    GetTop(this: GLuaNavLadder): GLuaVector;
    GetNormal(this: GLuaNavLadder): GLuaVector;
    GetBottomArea(this: GLuaNavLadder): GLuaNavArea;
    GetTopForwardArea(this: GLuaNavLadder): GLuaNavArea;
    GetTopBehindArea(this: GLuaNavLadder): GLuaNavArea;
    GetTopLeftArea(this: GLuaNavLadder): GLuaNavArea;
    GetTopRightArea(this: GLuaNavLadder): GLuaNavArea;
}
declare const MOVETYPE_LADDER: number;
declare const DMG_DROWN: number;
/** @noSelf */
declare namespace file { function Read(path: string, realm: "GAME"): string | undefined; }
/** @noSelf */
declare namespace navmesh { function GetNavArea(position: GLuaVector, beneathLimit: number): GLuaNavArea | undefined; }
