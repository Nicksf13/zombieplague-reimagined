// Copies an in-game capture export into distributable content; does not render BSPs.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const content = fileURLToPath(new URL("../gamemodes/zombieplague/content/", import.meta.url));
const finite = (value, min, max) => typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
const crcTable = Array.from({ length: 256 }, (_, value) => {
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
    return value >>> 0;
});
function validPng(image) {
    if (image.length < 45 || image.length > 16 * 1024 * 1024 || image.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
        image.readUInt32BE(8) !== 13 || image.toString("ascii", 12, 16) !== "IHDR" ||
        image.readUInt32BE(16) !== 1024 || image.readUInt32BE(20) !== 1024 || image[24] !== 8 ||
        ![2, 6].includes(image[25]) || image[26] !== 0 || image[27] !== 0 || image[28] !== 0) return false;
    const compressed = [];
    let offset = 8, ended = false;
    while (offset + 12 <= image.length) {
        const length = image.readUInt32BE(offset), type = image.toString("ascii", offset + 4, offset + 8);
        if (offset + length + 12 > image.length) return false;
        let crc = -1;
        for (const byte of image.subarray(offset + 4, offset + 8 + length)) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
        if (((crc ^ -1) >>> 0) !== image.readUInt32BE(offset + length + 8)) return false;
        if (type === "IDAT") compressed.push(image.subarray(offset + 8, offset + 8 + length));
        offset += length + 12;
        if (type === "IEND") { ended = length === 0; break; }
    }
    if (!ended || offset !== image.length || compressed.length === 0) return false;
    const stride = 1024 * (image[25] === 2 ? 3 : 4) + 1;
    try {
        const pixels = inflateSync(Buffer.concat(compressed), { maxOutputLength: stride * 1024 });
        if (pixels.length !== stride * 1024) return false;
        for (let row = 0; row < 1024; row++) if (pixels[row * stride] > 4) return false;
        return true;
    } catch { return false; }
}

export async function installOverview(directory, root = content) {
    if (!directory) throw new Error("Expected the in-game export directory.");
    const capture = JSON.parse(await readFile(path.join(directory, "capture.json"), "utf8"));
    const map = capture?.Map;
    if (typeof map !== "string" || !/^[a-z0-9_-]{1,100}$/.test(map)) throw new Error("Invalid capture map.");
    const data = JSON.parse(await readFile(path.join(directory, "overview.json"), "utf8"));
    if (!data || !finite(data.X, -1000000, 1000000) || !finite(data.Y, -1000000, 1000000) ||
        !finite(data.Scale, 0.01, 10000) || data.Size !== 1024 || !Array.isArray(data.Layers) ||
        data.Layers.length < 1 || data.Layers.length > 64) throw new Error("Invalid overview metadata.");
    const base = `zombieplague/radar/${map}`;
    if (data.Material !== base + ".png") throw new Error("Unexpected base material.");
    let previous = -Infinity;
    const layers = data.Layers.map((layer, index) => {
        if (!layer || layer.Material !== base + `_level_${index + 1}.png` ||
            !finite(layer.MinZ, -1000000, 1000000) || !finite(layer.MaxZ, -1000000, 1000000) ||
            layer.MinZ >= layer.MaxZ || layer.MinZ < previous) throw new Error("Invalid overview layer.");
        previous = layer.MaxZ;
        return { Material: layer.Material, MinZ: layer.MinZ, MaxZ: layer.MaxZ };
    });
    const config = { Material: data.Material, X: data.X, Y: data.Y, Scale: data.Scale, Size: data.Size, Layers: layers };
    const images = [];
    for (const material of [config.Material, ...layers.map(layer => layer.Material)]) {
        const image = await readFile(path.join(directory, path.basename(material)));
        if (!validPng(image)) throw new Error("Invalid captured PNG: " + material);
        images.push([material, image]);
    }
    // No output is touched until every referenced image has been checked.
    for (const [material, image] of images) {
        const filename = path.join(root, "materials", material);
        await mkdir(path.dirname(filename), { recursive: true });
        await writeFile(filename, image);
    }
    const target = path.join(root, "resource/zombieplague/radar", map + ".json");
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(config, null, 2) + "\n");
    return { map, images: images.length, config };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
    console.log(JSON.stringify(await installOverview(process.argv[2])));
