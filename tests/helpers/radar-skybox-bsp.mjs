import { readFileSync } from "node:fs";

// Keep only classifier lumps from the real map. All offsets are rebuilt; polygon
// textures, lighting and other large payloads are unnecessary for these tests.
export function skyboxBspFixture({ entities, mutate, leafVersion = 1 } = {}) {
    const original = readFileSync(new URL("../../gamemodes/zombieplague/content/maps/zm_canals.bsp", import.meta.url));
    const chunks = [], header = Buffer.alloc(1036);
    header.write("VBSP"); header.writeInt32LE(20, 4);
    let cursor = 1036;
    for (const index of [0, 1, 5, 10, 14]) {
        const start = original.readInt32LE(8 + index * 16), size = original.readInt32LE(12 + index * 16);
        let chunk = index === 0 && entities !== undefined ? Buffer.from(entities + "\0") : original.subarray(start, start + size);
        if (index === 10 && leafVersion === 0) {
            const old = Buffer.alloc(size / 32 * 56);
            for (let leaf = 0; leaf < size / 32; leaf++) chunk.copy(old, leaf * 56, leaf * 32, leaf * 32 + 30);
            chunk = old;
        }
        header.writeInt32LE(cursor, 8 + index * 16); header.writeInt32LE(chunk.length, 12 + index * 16);
        header.writeInt32LE(index === 10 ? leafVersion : original.readInt32LE(16 + index * 16), 16 + index * 16);
        chunks.push(chunk); cursor += chunk.length;
    }
    const bytes = Buffer.concat([header, ...chunks]);
    if (mutate) mutate(bytes);
    const floats = [], offset = header.readInt32LE(8 + 16), length = header.readInt32LE(12 + 16);
    for (let index = 0; index < length; index += 20)
        for (const field of [0, 4, 8, 12]) floats.push(`[${offset + index + field}]=${bytes.readFloatLE(offset + index + field)}`);
    const literal = [...bytes].map(byte => "\\" + String(byte).padStart(3, "0")).join("");
    return `
        local bspBytes="${literal}"
        local bspFloats={${floats.join(",")}}
        local bspClosed=0
        game={GetMap=function() return "zm_canals" end}
        file.Open=function(path,mode,realm)
            assert(path=="maps/zm_canals.bsp" and mode=="rb" and realm=="GAME")
            local stream={position=0}
            function stream:Size() return #bspBytes end
            function stream:Seek(position) assert(position>=0 and position<=#bspBytes);self.position=position end
            function stream:Read(length)
                assert(length>=0 and self.position+length<=#bspBytes)
                local data=bspBytes:sub(self.position+1,self.position+length);self.position=self.position+length;return data
            end
            function stream:ReadLong()
                local a,b,c,d=self:Read(4):byte(1,4)
                local value=a+b*256+c*65536+d*16777216
                return value>=2147483648 and value-4294967296 or value
            end
            function stream:ReadFloat()
                local value=bspFloats[self.position];assert(value~=nil,"Unexpected float offset")
                self.position=self.position+4;return value
            end
            function stream:Close() bspClosed=bspClosed+1 end
            return stream
        end
    `;
}
