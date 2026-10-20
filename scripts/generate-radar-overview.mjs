// Usage: node scripts/generate-radar-overview.mjs <map.bsp> [maximum-world-z]
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSurfaces } from "./radar/bsp-surfaces.mjs";
import { renderOverview } from "./radar/render-overview.mjs";

const [input, ceilingText = "4096"] = process.argv.slice(2), ceiling = Number(ceilingText);
if (!input || !Number.isFinite(ceiling)) throw new Error("Expected a BSP path and optional maximum world Z.");
const name = path.basename(input, ".bsp");
if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error("Invalid map name.");
const polygons = readSurfaces(await readFile(input), ceiling);
const bounds = polygons.reduce((bounds, polygon) => polygon.points.reduce((bounds, point) =>
    [Math.min(bounds[0], point[0]), Math.min(bounds[1], point[1]), Math.max(bounds[2], point[0]), Math.max(bounds[3], point[1])], bounds),
    [Infinity, Infinity, -Infinity, -Infinity]);
const [minX, minY, maxX, maxY] = bounds;
const extent = Math.max(maxX - minX, maxY - minY) * 1.025, size = 1024;
const config = { Material: `zombieplague/radar/${name}.png`, X: (minX + maxX - extent) / 2,
    Y: (minY + maxY + extent) / 2, Scale: extent / size, Size: size };

let recipe;
try { recipe = JSON.parse(await readFile(new URL(`./radar/maps/${name}.json`, import.meta.url), "utf8")); }
catch (error) { if (error.code !== "ENOENT") throw error; }
// Heights are audited per map; this generator does not infer architectural floors.
const levels = recipe?.Levels ?? [];
if (!Array.isArray(levels) || levels.length > 16 || levels.some((z, index) => !Number.isFinite(z) ||
    z < -1000000 || z > ceiling - 32 || (index > 0 && z <= levels[index - 1]))) throw new Error("Invalid map levels.");
const images = new Map([[config.Material, renderOverview(polygons, config, ceiling)]]);
if (levels.length > 0) {
    config.Layers = levels.map((height, index) => {
        const material = `zombieplague/radar/${name}_level_${index + 1}.png`;
        // Cut below the next slab while retaining stair surfaces above this landing.
        const cut = index + 1 < levels.length ? Math.min(height + 128, levels[index + 1] - 64) : ceiling;
        images.set(material, renderOverview(polygons, config, cut));
        return { Material: material, MinZ: index === 0 ? -1000000 : (levels[index - 1] + height) / 2,
            MaxZ: index + 1 === levels.length ? 1000000 : (height + levels[index + 1]) / 2 };
    });
}
const root = fileURLToPath(new URL("../gamemodes/zombieplague/content/", import.meta.url));
for (const directory of ["materials/zombieplague/radar", "resource/zombieplague/radar"])
    await mkdir(path.join(root, directory), { recursive: true });
for (const [material, image] of images) await writeFile(path.join(root, "materials", material), image);
await writeFile(path.join(root, "resource/zombieplague/radar", `${name}.json`), JSON.stringify(config, null, 2) + "\n");
console.log(JSON.stringify({ map: name, polygons: polygons.length, images: images.size, bounds, config }));
