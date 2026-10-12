import { spawnSync } from "node:child_process";
import { watch } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import luaparse from "luaparse";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const check = process.argv.includes("--check");
const watching = process.argv.includes("--watch");

async function listSources(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        const target = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...await listSources(target));
        else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) files.push(target);
    }
    return files;
}

async function build() {
    const manifest = JSON.parse(await readFile(path.join(root, "migration.json"), "utf8"));
    if (!Array.isArray(manifest.files) || manifest.files.length === 0) {
        throw new Error("migration.json must contain a nonempty files array.");
    }
    const files = manifest.files;
    const validPath = name => typeof name === "string" && /^gamemodes\/(?:[a-zA-Z0-9_-]+\/)+[a-zA-Z0-9_-]+$/.test(name);
    for (const name of files) {
        if (!validPath(name)) {
            throw new Error(`Invalid migration path: ${name}`);
        }
    }
    const sourcePaths = manifest.sourcePaths === undefined ? {} : manifest.sourcePaths;
    if (sourcePaths === null || typeof sourcePaths !== "object" || Array.isArray(sourcePaths)) {
        throw new Error("sourcePaths must map runtime paths to TypeScript source paths.");
    }
    for (const [output, source] of Object.entries(sourcePaths)) {
        if (!files.includes(output) || !validPath(source)) throw new Error(`Invalid source mapping: ${output}`);
    }
    const mappedSources = files.map(name => sourcePaths[name] ?? name);
    const sources = (await listSources(path.join(root, "src")))
        .map(file => path.relative(path.join(root, "src"), file).replaceAll("\\", "/").slice(0, -3));
    if (new Set(files).size !== files.length || new Set(mappedSources).size !== files.length ||
        sources.length !== files.length || sources.some(file => !mappedSources.includes(file))) {
        throw new Error("Every TypeScript source must appear exactly once in migration.json.");
    }

    const buildRoot = path.join(root, ".build");
    await mkdir(buildRoot, { recursive: true });
    const staging = await mkdtemp(path.join(buildRoot, "lua-"));
    try {
        for (const [realm, config] of [["server", "tsconfig.server.json"], ["client", "tsconfig.client.json"]]) {
            const result = spawnSync(process.execPath, [
                path.join(root, "node_modules/typescript-to-lua/dist/tstl.js"),
                "--project", path.join(root, config), "--outDir", path.join(staging, realm),
            ], { cwd: root, stdio: "inherit" });
            if (result.error) throw result.error;
            if (result.status !== 0) throw new Error(`TypeScriptToLua ${realm} failed; runtime files were not updated.`);
        }

        // Validate all emitted files before touching the gamemode.
        const outputs = [];
        for (const name of files) {
            const source = sourcePaths[name] ?? name;
            const client = /\/(?:cl_[^/]+|vgui\/[^/]+)$/.test(name);
            const generated = await readFile(path.join(staging, client ? "client" : "server", `${source}.lua`), "utf8");
            if (/\/(?:shared|sh_[^/]+)$/.test(name)) {
                const sharedClient = await readFile(path.join(staging, "client", `${source}.lua`), "utf8");
                if (generated !== sharedClient) throw new Error(`Shared output differs between realms: ${name}`);
            }
            luaparse.parse(generated, { luaVersion: "5.1" });
            const header = `-- Generated from src/${source}.ts. DO NOT EDIT; run npm run build.\n`;
            outputs.push({ target: path.join(root, `${name}.lua`), content: header + generated });
        }
        if (check) {
            const outdated = [];
            for (const output of outputs) {
                let current;
                try { current = await readFile(output.target, "utf8"); }
                catch (error) { if (error.code !== "ENOENT") throw error; }
                if (current?.replaceAll("\r\n", "\n") !== output.content.replaceAll("\r\n", "\n")) {
                    outdated.push(path.relative(root, output.target));
                }
            }
            if (outdated.length) throw new Error(`Generated Lua is outdated. Run npm run build:\n${outdated.join("\n")}`);
        } else {
            for (const output of outputs) {
                await mkdir(path.dirname(output.target), { recursive: true });
                await writeFile(output.target, output.content);
            }
        }
        console.log(`${check ? "Verified" : "Generated"} ${outputs.length} Lua 5.1 files.`);
    } finally {
        // Only remove the fresh temporary directory inside this project's .build.
        const resolved = path.resolve(staging);
        if (path.dirname(resolved) !== buildRoot || !path.basename(resolved).startsWith("lua-")) {
            throw new Error("Refusing to remove an unexpected build directory.");
        }
        await rm(resolved, { recursive: true, force: true });
    }
}

if (process.argv.slice(2).some(arg => !["--check", "--watch"].includes(arg)) || (check && watching)) {
    console.error("Usage: node scripts/build.mjs [--check | --watch]");
    process.exitCode = 1;
} else if (watching) {
    const run = async () => {
        try { await build(); }
        catch (error) { console.error(error.message); }
    };
    let timer;
    let running = false;
    let pending = false;
    const rebuild = async () => {
        if (running) { pending = true; return; }
        running = true;
        do { pending = false; await run(); } while (pending);
        running = false;
    };
    const schedule = () => {
        clearTimeout(timer);
        timer = setTimeout(rebuild, 150);
    };
    for (const directory of ["src", "types"]) {
        watch(path.join(root, directory), { recursive: true }, schedule);
    }
    for (const file of ["tsconfig.json", "tsconfig.base.json", "tsconfig.server.json", "tsconfig.client.json", "migration.json"]) {
        watch(path.join(root, file), schedule);
    }
    await rebuild();
    console.log("Watching TypeScript sources and configuration. Ctrl+C to stop.");
} else {
    try { await build(); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
}
