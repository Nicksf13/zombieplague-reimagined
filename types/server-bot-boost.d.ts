interface ZPServerPlayer {
    GetEyeTrace(this: ZPServerPlayer): GLuaTrace;
    GetGroundEntity(this: ZPServerPlayer): GLuaEntity;
    Ducking(this: ZPServerPlayer): boolean;
}
