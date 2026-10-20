// Source BSP layout: https://github.com/ValveSoftware/source-sdk-2013/blob/master/src/public/bspfile.h
export function readSurfaces(bsp, ceiling) {
    if (bsp.toString("ascii", 0, 4) !== "VBSP") throw new Error("Expected a Source BSP.");
    function lump(index) {
        const offset = bsp.readUInt32LE(8 + index * 16), length = bsp.readUInt32LE(12 + index * 16);
        if (bsp.readUInt32LE(20 + index * 16) !== 0) throw new Error(`Compressed lump ${index} is unsupported; use an uncompressed BSP.`);
        if (offset + length > bsp.length) throw new Error(`Invalid lump ${index}.`);
        return bsp.subarray(offset, offset + length);
    }
    const vertices = lump(3), edges = lump(12), surfedges = lump(13), faces = lump(7), planes = lump(1);
    const texinfo = lump(6), texdata = lump(2), strings = lump(43), stringTable = lump(44), models = lump(14);
    const dispinfo = lump(26), dispverts = lump(33);
    const firstFace = models.readInt32LE(40), faceCount = models.readInt32LE(44);
    const polygons = [];
    for (let faceIndex = firstFace; faceIndex < firstFace + faceCount; faceIndex++) {
        const offset = faceIndex * 56, plane = faces.readUInt16LE(offset) * 20;
        const normalZ = planes.readFloatLE(plane + 8) * (faces[offset + 2] ? -1 : 1);
        if (normalZ < 0.1) continue;
        const info = faces.readInt16LE(offset + 10);
        if (info < 0) continue;
        const texture = texinfo.readInt32LE(info * 72 + 68);
        const stringID = texdata.readInt32LE(texture * 32 + 12), start = stringTable.readInt32LE(stringID * 4);
        const material = strings.toString("utf8", start, strings.indexOf(0, start)).toLowerCase();
        if (material.startsWith("tools/") && !material.includes("water")) continue;
        const points = [], first = faces.readInt32LE(offset + 4), count = faces.readInt16LE(offset + 8);
        for (let edgeIndex = 0; edgeIndex < count; edgeIndex++) {
            const edge = surfedges.readInt32LE((first + edgeIndex) * 4);
            const vertex = edges.readUInt16LE(Math.abs(edge) * 4 + (edge < 0 ? 2 : 0)) * 12;
            points.push([vertices.readFloatLE(vertex), vertices.readFloatLE(vertex + 4), vertices.readFloatLE(vertex + 8)]);
        }
        if (points.length < 3 || points.some(point => point[2] > ceiling)) continue;
        const base = /water/.test(material) ? [52, 101, 122] : /grass|dirt|sand/.test(material) ? [96, 117, 78] :
            /roof|brick/.test(material) ? [133, 113, 100] : [143, 151, 156];
        function addPolygon(points) {
            const elevation = points.reduce((sum, point) => sum + point[2], 0) / points.length;
            const brightness = Math.max(0.65, Math.min(1.25, 0.85 + elevation / 3500));
            polygons.push({ points, elevation, material, outline: !/grass|dirt|sand|water/.test(material), color: base.map(channel => Math.round(channel * brightness)) });
        }
        const displacement = faces.readInt16LE(offset + 12);
        if (displacement < 0 || points.length !== 4) { addPolygon(points); continue; }
        // The BSP base quad is flat; using it would paint grass over water and erase hills.
        const disp = displacement * 176, origin = [0, 4, 8].map(axis => dispinfo.readFloatLE(disp + axis));
        const nearest = points.map(point => point.reduce((sum, value, axis) => sum + (value - origin[axis]) ** 2, 0));
        const corner = nearest.indexOf(Math.min(...nearest)), ordered = points.map((_, index) => points[(corner + index) % 4]);
        const steps = 2 ** dispinfo.readInt32LE(disp + 20), firstVertex = dispinfo.readInt32LE(disp + 12), grid = [];
        for (let row = 0; row <= steps; row++) {
            const u = row / steps;
            for (let column = 0; column <= steps; column++) {
                const v = column / steps, index = (firstVertex + row * (steps + 1) + column) * 20;
                grid.push(origin.map((_, axis) => {
                    const a = ordered[0][axis] * (1 - u) + ordered[1][axis] * u;
                    const b = ordered[3][axis] * (1 - u) + ordered[2][axis] * u;
                    return a * (1 - v) + b * v + dispverts.readFloatLE(index + axis * 4) * dispverts.readFloatLE(index + 12);
                }));
            }
        }
        for (let row = 0; row < steps; row++) for (let column = 0; column < steps; column++) {
            const a = row * (steps + 1) + column, b = a + steps + 1;
            addPolygon([grid[a], grid[a + 1], grid[b + 1]]); addPolygon([grid[a], grid[b + 1], grid[b]]);
        }
    }
    if (!polygons.length) throw new Error("No upward world surfaces found.");
    
    return polygons;
}
