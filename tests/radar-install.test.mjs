import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { installOverview } from "../scripts/install-radar-overview.mjs";
import { renderOverview } from "../scripts/radar/render-overview.mjs";

test("captured overviews install only a complete validated stack with safe material paths", async () => {
    const temporary = await mkdtemp(path.join(os.tmpdir(), "zp-radar-install-"));
    try {
        const root = path.join(temporary, "content");
        const config = { Material: "zombieplague/radar/zm_street.png", X: -1024, Y: 1024, Scale: 2, Size: 1024,
            Layers: [{ Material: "zombieplague/radar/zm_street_level_1.png", MinZ: -1000000, MaxZ: 1000000 }] };
        await writeFile(path.join(temporary, "capture.json"), JSON.stringify({ Map: "zm_street" }));
        await writeFile(path.join(temporary, "overview.json"), JSON.stringify(config));
        const png = renderOverview([], config);
        await writeFile(path.join(temporary, "zm_street.png"), png);
        await assert.rejects(installOverview(temporary, root), /ENOENT/);
        const target = path.join(root, "resource/zombieplague/radar/zm_street.json");
        await assert.rejects(readFile(target), /ENOENT/);
        await writeFile(path.join(temporary, "zm_street_level_1.png"), png);
        const result = await installOverview(temporary, root);
        assert.equal(result.images, 2);
        assert.deepEqual(JSON.parse(await readFile(target, "utf8")), config);
        assert.deepEqual(await readFile(path.join(root, "materials", config.Material)), png);
        const tall = { ...config, Layers: Array.from({ length: 64 }, (_, index) => ({
            Material: `zombieplague/radar/zm_street_level_${index + 1}.png`, MinZ: index * 128, MaxZ: (index + 1) * 128 })) };
        for (let index = 2; index <= 64; index++) await writeFile(path.join(temporary, `zm_street_level_${index}.png`), png);
        await writeFile(path.join(temporary, "overview.json"), JSON.stringify(tall));
        assert.equal((await installOverview(temporary, root)).images, 65);
        await writeFile(path.join(temporary, "overview.json"), JSON.stringify(config));
        await installOverview(temporary, root);
        const broken = Buffer.from(png); broken[40] ^= 1;
        await writeFile(path.join(temporary, "zm_street_level_1.png"), broken);
        await assert.rejects(installOverview(temporary, root), /PNG/);
        assert.deepEqual(JSON.parse(await readFile(target, "utf8")), config);
        await writeFile(path.join(temporary, "overview.json"), JSON.stringify({ ...config, Material: "../escape.png" }));
        await assert.rejects(installOverview(temporary, root), /material/);
        assert.deepEqual(JSON.parse(await readFile(target, "utf8")), config);
        await writeFile(path.join(temporary, "capture.json"), JSON.stringify({ Map: "../../escape" }));
        await assert.rejects(installOverview(temporary, root), /map/);
    } finally { await rm(temporary, { recursive: true, force: true }); }
});
