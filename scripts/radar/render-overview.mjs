import { deflateSync } from "node:zlib";

export function renderOverview(polygons, config, ceiling = Infinity) {
    const { X: x, Y: y, Scale: scale, Size: size } = config;
    const pixels = Buffer.alloc(size * size * 3);
    const depth = new Float64Array(size * size).fill(-Infinity);
    for (let offset = 0; offset < pixels.length; offset += 3) pixels.set([27, 34, 39], offset);
    // Draw lower surfaces first; roofs occlude lower floors as in a static overhead view.
    polygons.sort((a, b) => a.elevation - b.elevation);
    for (const polygon of polygons) {
        const clipped = clipBelow(polygon.points, ceiling);
        if (clipped.length < 3) continue;
        const points = clipped.map(point => [(point[0] - x) / scale, (y - point[1]) / scale, point[2]]);
        const a = points[0], plane = heightPlane(points);
        if (!plane) continue;
        const [slopeX, slopeY] = plane;
        const top = Math.max(0, Math.ceil(Math.min(...points.map(point => point[1])) - 0.5));
        const bottom = Math.min(size - 1, Math.floor(Math.max(...points.map(point => point[1])) - 0.5));
        for (let py = top; py <= bottom; py++) {
            const intersections = [], scanY = py + 0.5;
            for (let index = 0; index < points.length; index++) {
                const a = points[index], b = points[(index + 1) % points.length];
                if ((a[1] > scanY) !== (b[1] > scanY)) intersections.push(a[0] + (scanY - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
            }
            intersections.sort((a, b) => a - b);
            for (let index = 0; index + 1 < intersections.length; index += 2) {
                const left = Math.max(0, Math.ceil(intersections[index] - 0.5)), right = Math.min(size - 1, Math.floor(intersections[index + 1] - 0.5));
                for (let px = left; px <= right; px++) {
                    const index = py * size + px;
                    const height = a[2] + slopeX * (px + 0.5 - a[0]) + slopeY * (py + 0.5 - a[1]);
                    if (height < depth[index]) continue;
                    depth[index] = height;
                    const boundary = polygon.outline && (px === left || px === right);
                    pixels.set(boundary ? polygon.color.map(channel => Math.round(channel * 0.78)) : polygon.color, (py * size + px) * 3);
                }
            }
        }
    }
    function crc32(buffer) {
        let crc = -1;
        for (const byte of buffer) {
            crc ^= byte;
            for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
        }
        return (crc ^ -1) >>> 0;
    }
    function chunk(type, data) {
        const buffer = Buffer.alloc(data.length + 12);
        buffer.writeUInt32BE(data.length); buffer.write(type, 4); data.copy(buffer, 8);
        buffer.writeUInt32BE(crc32(buffer.subarray(4, -4)), buffer.length - 4);
        return buffer;
    }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2;
    const raw = Buffer.alloc((size * 3 + 1) * size);
    for (let row = 0; row < size; row++) pixels.copy(raw, row * (size * 3 + 1) + 1, row * size * 3, (row + 1) * size * 3);
    const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header),
        chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
    
    return png;
}

export function clipBelow(points, ceiling) {
    const result = [];
    const push = point => {
        const previous = result.at(-1);
        if (!previous || point.some((value, axis) => Math.abs(value - previous[axis]) > 0.000001)) result.push(point);
    };
    for (let index = 0; index < points.length; index++) {
        const a = points[index], b = points[(index + 1) % points.length];
        if (a[2] <= ceiling) push(a);
        if ((a[2] <= ceiling) !== (b[2] <= ceiling)) {
            const fraction = (ceiling - a[2]) / (b[2] - a[2]);
            push(a.map((value, axis) => value + fraction * (b[axis] - value)));
        }
    }
    if (result.length > 1 && result[0].every((value, axis) => Math.abs(value - result.at(-1)[axis]) <= 0.000001)) result.pop();
    return result;
}

function heightPlane(points) {
    const a = points[0];
    // Clipping and BSP edge splits may leave collinear vertices at the beginning.
    for (let index = 1; index + 1 < points.length; index++) {
        const b = points[index], c = points[index + 1];
        const dx1 = b[0] - a[0], dy1 = b[1] - a[1], dz1 = b[2] - a[2];
        const dx2 = c[0] - a[0], dy2 = c[1] - a[1], dz2 = c[2] - a[2], determinant = dx1 * dy2 - dx2 * dy1;
        if (Math.abs(determinant) >= 0.00001)
            return [(dz1 * dy2 - dz2 * dy1) / determinant, (dx1 * dz2 - dx2 * dz1) / determinant];
    }
}
