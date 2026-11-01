interface GLuaEntity {
    GetInternalVariable(this: GLuaEntity, name: "m_takedamage" | "m_Material"): number | undefined;
    NearestPoint(this: GLuaEntity, position: GLuaVector): GLuaVector;
}
