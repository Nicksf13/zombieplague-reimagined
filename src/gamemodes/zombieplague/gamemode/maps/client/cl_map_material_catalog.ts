// BSP material references cover decals, overlays and detail sprites that are
// absent from worldspawn's brush surfaces. Read only bounded, uncompressed lumps.
const headerSize = 1036;
const maxLumpSize = 8 * 1024 * 1024;
let staticMaterials: Record<string, boolean> = {};

export function IsStaticPropMaterial(this: void, name: string): boolean {
    return staticMaterials[name.toLowerCase().replaceAll("\\", "/")] === true;
}

function readStaticPropMaterials(this: void, map: GLuaMapFile,
    add: (this: void, name: string, skyline: boolean) => void): void {
    map.Seek(8 + 35 * 16);
    const offset = map.ReadLong(), length = map.ReadLong();
    map.ReadLong();
    if (map.ReadLong() !== 0 || offset < headerSize || length < 4 ||
        length > maxLumpSize || offset > map.Size() - length) return;
    map.Seek(offset);
    const entries = map.ReadLong();
    if (entries < 0 || entries > (length - 4) / 16) return;
    for (let index = 0; index < entries; index++) {
        map.Seek(offset + 4 + index * 16);
        const id = map.ReadLong();
        const flagsAndVersion = map.ReadLong();
        const start = map.ReadLong(), size = map.ReadLong();
        // GAMELUMP_STATIC_PROPS ('sprp'); low 16 bits are compression flags.
        if (id !== 1936749168 || flagsAndVersion % 65536 !== 0 || size < 4 ||
            size > maxLumpSize || start < headerSize || start > map.Size() - size) continue;
        map.Seek(start);
        const count = map.ReadLong();
        if (count < 0 || count > 4096 || count > (size - 4) / 128) continue;
        const seen: Record<string, boolean> = {};
        for (let modelIndex = 0; modelIndex < count; modelIndex++) {
            const modelName = map.Read(128).split("\0")[0];
            const model = modelName !== undefined ? modelName.toLowerCase() : undefined;
            if (!model || !model.startsWith("models/") || !model.endsWith(".mdl") ||
                model.includes("..") || model.includes(":") || seen[model]) continue;
            seen[model] = true;
            // Static props are not entities and their materials need not occur
            // in the BSP brush texture table, including unlit skyline cards.
            const skyline = model.includes("_skybox") || model.includes("/props_buildings/");
            for (const mesh of util.GetModelMeshes(model) ?? []) add(mesh.material, skyline);
        }
    }
}

function readLump(this: void, map: GLuaMapFile, index: number): string | undefined {
    map.Seek(8 + index * 16);
    const offset = map.ReadLong();
    const length = map.ReadLong();
    map.ReadLong(); // lump version
    const uncompressedSize = map.ReadLong();
    if (uncompressedSize !== 0 || offset < headerSize || length <= 0 ||
        length > maxLumpSize || offset > map.Size() - length)
        return undefined;
    map.Seek(offset);
    const data = map.Read(length);
    return data.length === length ? data : undefined;
}

export function ReadMapMaterialNames(this: void): string[] {
    staticMaterials = {};
    const map = file.Open(`maps/${game.GetMap()}.bsp`, "rb", "GAME");
    if (!map)
        return [];
    const names: string[] = [];
    const seen: Record<string, boolean> = {};
    const add = function(this: void, name: string): void {
        const normalized = name.trim().toLowerCase().replaceAll("\\", "/");
        if (normalized.length === 0 || normalized.length > 260 || normalized.includes("..") ||
            normalized.startsWith("/") || normalized.includes(":") || seen[normalized])
            return;
        seen[normalized] = true;
        names.push(normalized);
    };
    // Valve's VBSP header; do not interpret truncated files or other formats.
    if (map.Size() >= headerSize && map.Read(4) === "VBSP") {
        readStaticPropMaterials(map, (name, skyline) => {
            if (skyline) staticMaterials[name.trim().toLowerCase().replaceAll("\\", "/")] = true;
            add(name);
        });
        const textures = readLump(map, 43);
        if (textures)
            for (const name of textures.split("\0"))
                add(name);
        const entities = readLump(map, 0);
        if (entities) {
            for (const block of string.gmatch(entities, "%b{}")) {
                const fields: Record<string, string | undefined> = {};
                for (const [key, value] of string.gmatch(block, '"([^"]+)"%s*"([^"]*)"'))
                    fields[key.toLowerCase()] = value;
                const classname = fields.classname?.toLowerCase();
                const name = classname === "worldspawn" ? fields.detailmaterial :
                    classname === "infodecal" || classname === "info_decal" ? fields.texture :
                    classname === "info_overlay" ? fields.material : undefined;
                if (name)
                    add(name);
            }
        }
    }
    map.Close();
    return names;
}
