import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const buildRoot = path.join(root, ".build");

test("build rejects type errors, detects stale Lua and preserves unmigrated files", async () => {
    await mkdir(buildRoot, { recursive: true });
    const fixture = await mkdtemp(path.join(buildRoot, "build-test-"));
    try {
        for (const name of ["scripts", "src", "types", "tsconfig.json", "tsconfig.base.json", "tsconfig.server.json", "tsconfig.client.json", "migration.json"]) {
            await cp(path.join(root, name), path.join(fixture, name), { recursive: true });
        }
        await symlink(path.join(root, "node_modules"), path.join(fixture, "node_modules"), "junction");
        const manifest = JSON.parse(await readFile(path.join(root, "migration.json"), "utf8"));
        for (const name of manifest.files) {
            const output = path.join(fixture, `${name}.lua`);
            await mkdir(path.dirname(output), { recursive: true });
            await cp(path.join(root, `${name}.lua`), output);
        }
        const sentinel = path.join(fixture, "gamemodes/zombieplague/gamemode/__unmigrated_fixture.lua");
        await writeFile(sentinel, "-- Unmigrated GLua must survive the build.\n");
        const source = path.join(fixture, "src/gamemodes/zombieplague/gamemode/shared.ts");
        const originalSource = await readFile(source, "utf8");
        const output = path.join(fixture, "gamemodes/zombieplague/gamemode/shared.lua");
        const originalOutputs = await Promise.all(manifest.files.map(name => readFile(path.join(fixture, `${name}.lua`), "utf8")));
        const run = (...args) => spawnSync(process.execPath, [path.join(fixture, "scripts/build.mjs"), ...args], {
            cwd: fixture, encoding: "utf8", windowsHide: true,
        });

        await writeFile(source, `${originalSource}\nRoundManager.SetRespawn("invalid");\n`);
        const failed = run();
        assert.equal(failed.status, 1);
        assert.match(failed.stdout + failed.stderr, /not assignable/);
        for (const [index, name] of manifest.files.entries()) {
            assert.equal(await readFile(path.join(fixture, `${name}.lua`), "utf8"), originalOutputs[index]);
        }

        await writeFile(source, originalSource);
        const clientSource = path.join(fixture, "src/gamemodes/zombieplague/gamemode/cl_init.ts");
        const originalClient = await readFile(clientSource, "utf8");
        await writeFile(clientSource, `${originalClient}\nnet.Receive("InvalidClientSender", (_len, sender: ZPPlayer) => {});\n`);
        const clientFailed = run();
        assert.equal(clientFailed.status, 1);
        assert.match(clientFailed.stdout + clientFailed.stderr, /client failed/);
        for (const [index, name] of manifest.files.entries()) {
            assert.equal(await readFile(path.join(fixture, `${name}.lua`), "utf8"), originalOutputs[index]);
        }
        await writeFile(clientSource, originalClient);
        const stale = "-- Manual edit that build:check must report.\n";
        await writeFile(output, stale);
        const checked = run("--check");
        assert.equal(checked.status, 1);
        assert.match(checked.stderr, /Generated Lua is outdated/);
        assert.equal(await readFile(output, "utf8"), stale, "Check mode must not write runtime files");

        const built = run();
        assert.equal(built.status, 0, built.stdout + built.stderr);
        assert.equal(await readFile(output, "utf8"), originalOutputs[0]);
        assert.equal(await readFile(sentinel, "utf8"), "-- Unmigrated GLua must survive the build.\n");

        // Grouped TS sources must still emit only to their original GMod paths.
        for (const [runtime, sourcePath] of Object.entries(manifest.sourcePaths)) {
            const generated = await readFile(path.join(fixture, `${runtime}.lua`), "utf8");
            assert(generated.startsWith(`-- Generated from src/${sourcePath}.ts.`));
            assert.equal(await readFile(path.join(fixture, `src/${sourcePath}.ts`), "utf8"),
                await readFile(path.join(root, `src/${sourcePath}.ts`), "utf8"));
            await assert.rejects(readFile(path.join(fixture, `${sourcePath}.lua`)), { code: "ENOENT" });
        }
        const [mappedRuntime, mappedSource] = Object.entries(manifest.sourcePaths)[0];
        const manifestPath = path.join(fixture, "migration.json");
        await writeFile(manifestPath, JSON.stringify({ ...manifest, sourcePaths: {
            ...manifest.sourcePaths, [mappedRuntime]: "../../outside",
        } }));
        const unsafeMapping = run();
        assert.equal(unsafeMapping.status, 1);
        assert.match(unsafeMapping.stderr, /Invalid source mapping/);
        await writeFile(manifestPath, JSON.stringify({ ...manifest, sourcePaths: {
            ...manifest.sourcePaths, [manifest.files[0]]: mappedSource,
        } }));
        const duplicatedSource = run();
        assert.equal(duplicatedSource.status, 1);
        assert.match(duplicatedSource.stderr, /exactly once/);
        await writeFile(manifestPath, JSON.stringify(manifest));

        await writeFile(path.join(fixture, "migration.json"), JSON.stringify({ files: manifest.files.slice(1) }));
        const unregistered = run();
        assert.equal(unregistered.status, 1);
        assert.match(unregistered.stderr, /exactly once/);
    } finally {
        const resolved = path.resolve(fixture);
        if (path.dirname(resolved) !== buildRoot || !path.basename(resolved).startsWith("build-test-")) {
            throw new Error("Unexpected test fixture path");
        }
        await rm(resolved, { recursive: true, force: true });
    }
});
