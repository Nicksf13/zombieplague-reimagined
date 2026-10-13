// Minimal real binary BSP header/lumps; the fixture implements GMod's File API.
// Offsets and compression metadata can be corrupted to exercise bounds checks.
export function bspFixture({ entities = "", textures = [], staticModels = [], mutate } = {}) {
    const entitiesBytes = Buffer.from(entities, "utf8");
    const texturesBytes = Buffer.from(textures.join("\0") + "\0", "utf8");
    const gameSize = staticModels.length ? 24 + staticModels.length * 128 : 0;
    const bytes = Buffer.alloc(1036 + entitiesBytes.length + texturesBytes.length + gameSize);
    bytes.write("VBSP");
    bytes.writeInt32LE(20, 4);
    bytes.writeInt32LE(1036, 8);
    bytes.writeInt32LE(entitiesBytes.length, 12);
    entitiesBytes.copy(bytes, 1036);
    bytes.writeInt32LE(1036 + entitiesBytes.length, 8 + 43 * 16);
    bytes.writeInt32LE(texturesBytes.length, 12 + 43 * 16);
    texturesBytes.copy(bytes, 1036 + entitiesBytes.length);
    if (gameSize) {
        const start = 1036 + entitiesBytes.length + texturesBytes.length;
        bytes.writeInt32LE(start, 8 + 35 * 16);
        bytes.writeInt32LE(gameSize, 12 + 35 * 16);
        bytes.writeInt32LE(1, start);
        bytes.writeInt32LE(1936749168, start + 4);
        bytes.writeInt32LE(10 << 16, start + 8);
        bytes.writeInt32LE(start + 20, start + 12);
        bytes.writeInt32LE(gameSize - 20, start + 16);
        bytes.writeInt32LE(staticModels.length, start + 20);
        staticModels.forEach((model, index) => bytes.write(model, start + 24 + index * 128, 127));
    }
    if (mutate) mutate(bytes);
    const literal = [...bytes].map(byte => "\\" + String(byte).padStart(3, "0")).join("");
    return `
        local bspData="${literal}"
        local bspOpens,bspCloses,bspReads=0,0,0
        file.Open=function(path,mode,realm)
            assert(path=="maps/gm_fixture.bsp" and mode=="rb" and realm=="GAME")
            bspOpens=bspOpens+1
            local stream={position=0}
            function stream:Size() return #bspData end
            function stream:Seek(position) assert(position>=0 and position<=#bspData); self.position=position end
            function stream:Read(length)
                assert(length>=0 and length<=8*1024*1024)
                bspReads=bspReads+length
                local data=bspData:sub(self.position+1,self.position+length)
                self.position=self.position+#data
                return data
            end
            function stream:ReadLong()
                local b1,b2,b3,b4=self:Read(4):byte(1,4)
                assert(b4,"Truncated BSP integer")
                local value=b1+b2*256+b3*65536+b4*16777216
                return value>=2147483648 and value-4294967296 or value
            end
            function stream:Close() bspCloses=bspCloses+1 end
            return stream
        end
    `;
}
