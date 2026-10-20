import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { clipBelow, renderOverview } from "../scripts/radar/render-overview.mjs";

function pixels(png) {
    const chunks = [];
    for (let offset = 8; offset < png.length;) {
        const length = png.readUInt32BE(offset), type = png.toString("ascii", offset + 4, offset + 8);
        if (type === "IDAT") chunks.push(png.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
    }
    return inflateSync(Buffer.concat(chunks));
}

test("floor images remove an upper roof while preserving the underlying floor and projection", () => {
    const quad = z => [[0, 0, z], [16, 0, z], [16, 16, z], [0, 16, z]];
    const polygons = [
        // BSP edge splits can put three collinear points before the first corner.
        { points: [[0, 0, 0], [8, 0, 0], [16, 0, 0], [16, 16, 0], [0, 16, 0]],
            color: [200, 50, 50], elevation: 0, outline: false },
        { points: quad(128), color: [50, 200, 50], elevation: 128, outline: false },
    ];
    const config = { X: 0, Y: 16, Scale: 1, Size: 16 };
    const base = renderOverview(polygons, config), lower = renderOverview(polygons, config, 64);
    const middle = 8 * (16 * 3 + 1) + 1 + 8 * 3;
    assert.deepEqual([...pixels(base).subarray(middle, middle + 3)], [50, 200, 50]);
    assert.deepEqual([...pixels(lower).subarray(middle, middle + 3)], [200, 50, 50]);
    assert.equal(base.readUInt32BE(16), lower.readUInt32BE(16));
    assert.equal(base.readUInt32BE(20), lower.readUInt32BE(20));
});

test("floor cuts preserve slopes and do not produce duplicate vertices on an existing landing", () => {
    const slope = clipBelow([[0, 0, 0], [16, 0, 0], [16, 16, 32], [0, 16, 32]], 16);
    assert.equal(slope.length, 4);
    assert(slope.every(point => point[2] <= 16));
    assert(slope.some(point => point[1] === 8 && point[2] === 16));
    const boundary = clipBelow([[0, 0, 16], [16, 0, 32], [16, 16, 0]], 16);
    assert.equal(boundary.length, 3);
    assert(boundary.every((point, index) => point.some((value, axis) => value !== boundary[(index + 1) % boundary.length][axis])));
});

