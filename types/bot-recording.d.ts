interface GLuaEntity {
    GetClass(this: GLuaEntity): string;
    GetSolid(this: GLuaEntity): number;
    GetCollisionGroup(this: GLuaEntity): number;
    OBBMins(this: GLuaEntity): GLuaVector;
    OBBMaxs(this: GLuaEntity): GLuaVector;
}
/** @noSelf */
declare namespace ents { function GetAll(): GLuaRecordingEntity[]; }
interface GLuaRecordingEntity extends GLuaEntity { GetModel(this: GLuaRecordingEntity): string | undefined; }
