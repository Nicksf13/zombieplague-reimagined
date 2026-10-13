import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Exercise the editor's discovery, rather than passing a tsconfig to the compiler.
function startLanguageServer() {
    const child = spawn(process.execPath, [
        path.join(root, "node_modules/typescript/lib/tsserver.js"), "--disableAutomaticTypingAcquisition",
    ], { cwd: root, windowsHide: true });
    const exited = once(child, "exit");
    const pending = new Map();
    let buffer = Buffer.alloc(0), sequence = 0, stderr = "";
    child.stderr.on("data", chunk => { stderr += chunk; });
    const fail = error => {
        for (const request of pending.values()) {
            clearTimeout(request.timer);
            request.reject(error);
        }
        pending.clear();
    };
    child.on("error", fail);
    child.on("exit", code => fail(new Error(`tsserver exited (${code}): ${stderr}`)));
    child.stdout.on("data", chunk => {
        buffer = Buffer.concat([buffer, chunk]);
        while (true) {
            const boundary = buffer.indexOf("\r\n\r\n");
            if (boundary < 0) return;
            const header = buffer.subarray(0, boundary).toString("utf8");
            const length = Number(header.match(/Content-Length: (\d+)/)?.[1]);
            assert(Number.isFinite(length), header);
            if (buffer.length < boundary + 4 + length) return;
            const message = JSON.parse(buffer.subarray(boundary + 4, boundary + 4 + length).toString("utf8"));
            buffer = buffer.subarray(boundary + 4 + length);
            if (message.type !== "response") continue;
            const request = pending.get(message.request_seq);
            if (!request) continue;
            pending.delete(message.request_seq);
            clearTimeout(request.timer);
            if (message.success) request.resolve(message.body);
            else request.reject(new Error(message.message));
        }
    });
    return {
        request(command, args) {
            return new Promise((resolve, reject) => {
                const seq = ++sequence;
                const timer = setTimeout(() => {
                    pending.delete(seq);
                    reject(new Error(`tsserver timed out: ${command}`));
                }, 15000);
                pending.set(seq, { resolve, reject, timer });
                child.stdin.write(JSON.stringify({ seq, type: "request", command, arguments: args }) + "\n");
            });
        },
        async close() {
            child.kill();
            await exited;
        },
    };
}

test("editor discovers both realms and their ambient dependencies without runtime imports", async () => {
    const server = startLanguageServer();
    try {
        // Opening a client file first reproduced the inferred-project failure.
        for (const [source, config] of [
            ["gamemode/interface/client/cl_hud.ts", "client"],
            ["gamemode/menus/client/cl_weapon_menu_hud.ts", "client"],
            ["gamemode/menus/server/sv_weapon_menu.ts", "server"],
            ["gamemode/menus/shared/sh_admin_config.ts", "server"],
            ["gamemode/menus/server/sv_admin_settings.ts", "server"],
            ["gamemode/menus/client/cl_admin_menu.ts", "client"],
            ["gamemode/menus/client/cl_admin_menu_hud.ts", "client"],
            ["gamemode/maps/server/sv_map_environment.ts", "server"],
            ["gamemode/maps/server/sv_map_lighting.ts", "server"],
            ["gamemode/maps/server/sv_sun_orbit.ts", "server"],
            ["gamemode/maps/client/cl_map_environment.ts", "client"],
            ["gamemode/maps/client/cl_map_material_catalog.ts", "client"],
            ["gamemode/player/client/cl_nightvision.ts", "client"],
            ["gamemode/weapons/server/sv_weapon_definition.ts", "server"],
            ["gamemode/menus/shared/sh_weapon_menu_protocol.ts", "server"],
        ]) {
            const file = path.join(root, "src/gamemodes/zombieplague", source);
            await server.request("open", { file, projectRootPath: root });
            const info = await server.request("projectInfo", { file, needFileNameList: true });
            assert.equal(path.normalize(info.configFileName), path.join(root, `tsconfig.${config}.json`), source);
            const included = info.fileNames.map(name => path.normalize(name));
            assert(included.includes(path.join(root, "types/glua.d.ts")), source);
            assert(included.some(name => name.endsWith(path.normalize("@typescript-to-lua/language-extensions/index.d.ts"))), source);
            assert.equal(included.includes(path.join(root, "types/client/hud.d.ts")), config === "client", source);
            assert.deepEqual(await server.request("semanticDiagnosticsSync", { file }), [], source);
            assert.deepEqual(await server.request("syntacticDiagnosticsSync", { file }), [], source);
        }
    } finally {
        await server.close();
    }
});
