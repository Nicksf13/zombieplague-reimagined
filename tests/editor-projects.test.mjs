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
            ["gamemode/menus/client/cl_class_menu.ts", "client"],
            ["gamemode/menus/client/cl_class_menu_hud.ts", "client"],
            ["gamemode/menus/client/cl_extra_menu.ts", "client"],
            ["gamemode/menus/client/cl_extra_menu_hud.ts", "client"],
            ["gamemode/menus/client/cl_map_vote.ts", "client"],
            ["gamemode/menus/client/cl_map_vote_hud.ts", "client"],
            ["gamemode/rounds/shared/sh_map_vote_protocol.ts", "server"],
            ["gamemode/rounds/server/sv_votemap.ts", "server"],
            ["gamemode/rounds/server/sv_map_nominations.ts", "server"],
            ["gamemode/menus/server/sv_extra_menu.ts", "server"],
            ["gamemode/menus/shared/sh_extra_menu_protocol.ts", "server"],
            ["gamemode/menus/shared/sh_class_menu_protocol.ts", "server"],
            ["gamemode/menus/server/sv_class_menu.ts", "server"],
            ["gamemode/menus/server/sv_class_menu_apply.ts", "server"],
            ["gamemode/menus/server/sv_weapon_menu.ts", "server"],
            ["gamemode/player/server/sv_player_participation.ts", "server"],
            ["gamemode/player/server/sv_spectator_rules.ts", "server"],
            ["gamemode/player/server/sv_spectator_overview.ts", "server"],
            ["gamemode/player/shared/sh_spectator_protocol.ts", "server"],
            ["gamemode/player/client/cl_spectator_overview.ts", "client"],
            ["gamemode/player/client/cl_spectator_overview_hud.ts", "client"],
            ["gamemode/player/client/cl_spectator_overview_map.ts", "client"],
            ["gamemode/player/server/sv_player_spawns.ts", "server"],
            ["gamemode/player/server/sv_spawn_occupancy.ts", "server"],
            ["gamemode/bots/server/sv_bot_shared_learning.ts", "server"],
            ["gamemode/bots/server/sv_bot_behavior.ts", "server"],
            ["gamemode/bots/server/sv_bot_learning_migration.ts", "server"],
            ...["sv_bot_experience_trace", "sv_bot_execution", "sv_bot_damage_events", "sv_bot_motion_causality", "sv_bot_motion_experiences"].map(name => ["gamemode/bots/server/" + name + ".ts", "server"]),
            ["gamemode/menus/shared/sh_admin_config.ts", "server"],
            ...["sh_server_cvars", "sh_server_cvar_catalog"].map(name => ["gamemode/menus/shared/" + name + ".ts", "server"]),
            ["gamemode/menus/server/sv_server_cvars.ts", "server"],
            ...["cl_server_cvars", "cl_server_cvars_hud"].map(name => ["gamemode/menus/client/" + name + ".ts", "client"]),
            ["gamemode/menus/server/sv_admin_settings.ts", "server"],
            ["gamemode/menus/client/cl_admin_menu.ts", "client"],
            ["gamemode/menus/client/cl_admin_menu_hud.ts", "client"],
            ["gamemode/menus/client/cl_admin_rounds.ts", "client"],
            ["gamemode/menus/client/cl_admin_rounds_hud.ts", "client"],
            ["gamemode/rounds/server/sv_admin_rounds.ts", "server"],
            ["gamemode/interface/client/cl_key_input.ts", "client"],
            ["gamemode/player/shared/sh_dance.ts", "server"],
            ["gamemode/player/shared/sh_emotes.ts", "server"],
            ["gamemode/menus/client/cl_emote_wheel.ts", "client"],
            ["gamemode/menus/client/cl_emote_wheel_hud.ts", "client"],
            ["gamemode/player/server/sv_dance.ts", "server"],
            ["gamemode/player/client/cl_dance.ts", "client"],
            ["gamemode/player/client/cl_dance_camera.ts", "client"],
            ["gamemode/maps/server/sv_map_environment.ts", "server"],
            ["gamemode/maps/server/sv_map_lighting.ts", "server"],
            ["gamemode/maps/server/sv_sun_orbit.ts", "server"],
            ["gamemode/maps/client/cl_map_environment.ts", "client"],
            ["gamemode/maps/client/cl_map_material_catalog.ts", "client"],
            ["gamemode/player/client/cl_nightvision.ts", "client"],
            ["gamemode/effects/client/cl_special_aura.ts", "client"],
            ["gamemode/weapons/server/sv_weapon_definition.ts", "server"],
            ["gamemode/menus/shared/sh_weapon_menu_protocol.ts", "server"],
            ["gamemode/bots/shared/sh_bot_metrics_protocol.ts", "server"],
            ["gamemode/bots/shared/sh_bot_motion_protocol.ts", "server"],
            ["gamemode/bots/shared/sh_bot_place_protocol.ts", "server"],
            ["gamemode/bots/shared/sh_bot_safe_protocol.ts", "server"],
            ["gamemode/bots/server/sv_bot_safe_store.ts", "server"],
            ["gamemode/bots/server/sv_bot_safe_points.ts", "server"],
            ["gamemode/bots/client/cl_bot_safe_points.ts", "client"],
            ["gamemode/bots/client/cl_bot_safe_hud.ts", "client"],
            ["gamemode/bots/client/cl_bot_safe_markers.ts", "client"],
            ["gamemode/bots/client/cl_bot_tool_screen.ts", "client"],
            ["gamemode/weapons/shared/sweps/zp_bot_safe_tool.ts", "server"],
            ["gamemode/bots/shared/sh_bot_boost_protocol.ts", "server"],
            ["gamemode/bots/shared/sh_bot_boost_rules.ts", "server"],
            ...["sv_bot_boost", "sv_bot_boost_store", "sv_bot_boost_geometry", "sv_bot_boost_actions", "sv_bot_boost_editor", "sv_bot_boost_tool"].map(name => ["gamemode/bots/server/" + name + ".ts", "server"]),
            ["gamemode/weapons/shared/sweps/zp_bot_boost_tool.ts", "server"],
            ...["cl_bot_boost", "cl_bot_boost_hud", "cl_bot_boost_markers", "cl_bot_boost_preview", "cl_bot_boost_presentation", "cl_bot_boost_screen"].map(name => ["gamemode/bots/client/" + name + ".ts", "client"]),
            ...["sv_bot_place_learning", "sv_bot_place_catalog", "sv_bot_places", "sv_bot_ladder"].map(name => ["gamemode/bots/server/" + name + ".ts", "server"]),
            ["gamemode/bots/client/cl_bot_motion_hud.ts", "client"],
            ["gamemode/bots/client/cl_bot_metrics.ts", "client"],
            ["gamemode/bots/client/cl_bot_recording.ts", "client"],
            ...["sv_bot_recording", "sv_bot_recording_service", "sv_bot_recording_obstacles"].map(name => [`gamemode/bots/server/${name}.ts`, "server"]),
            ["gamemode/bots/shared/sh_bot_statistics_analysis.ts", "server"],
            ...["sv_bot_statistics", "sv_bot_statistics_store", "sv_bot_statistics_timeline", "sv_bot_statistics_service", "sv_bot_learning_gate"].map(name => ["gamemode/bots/server/" + name + ".ts", "server"]),
            ...["cl_bot_statistics", "cl_bot_statistics_hud", "cl_bot_statistics_graph"].map(name => ["gamemode/bots/client/" + name + ".ts", "client"]),
            ["gamemode/bots/client/cl_bot_population.ts", "client"],
            ["gamemode/bots/client/cl_bot_population_hud.ts", "client"],
            ["gamemode/player/server/sv_player_spectator.ts", "server"],
            ...["sv_bot_population_config", "sv_bot_spawner", "sv_bot_population", "sv_bot_population_service", "sv_bot_training"]
                .map(name => [`gamemode/bots/server/${name}.ts`, "server"]),
            ...["sv_bot_precision", "sv_bot_precision_support"].map(name => [`gamemode/bots/server/${name}.ts`, "server"]),
            ...["sv_bot_traffic", "sv_bot_damage_guard", "sv_bot_statistics_minutes"].map(name => [`gamemode/bots/server/${name}.ts`, "server"]),
            ...["sv_bot_objectives", "sv_bot_hearing", "sv_bot_jump_control", "sv_bot_activity", "sv_bot_search", "sv_bot_weapon_ammo", "sv_bot_weapons", "sv_bot_ammo_purchase"].map(name => [`gamemode/bots/server/${name}.ts`, "server"]),
            ["gamemode/bots/client/cl_bot_metrics_hud.ts", "client"],
            ["gamemode/bots/client/cl_bot_metrics_card.ts", "client"],
            ["gamemode/bots/client/cl_bot_decision_graph.ts", "client"],
            ...["sv_bots", "sv_bot_brain", "sv_bot_storage", "sv_bot_navigation", "sv_bot_perception", "sv_bot_motor", "sv_bot_controller", "sv_bot_commands", "sv_bot_metrics", "sv_bot_contexts", "sv_bot_metrics_service", "sv_bot_motion_storage", "sv_bot_motion_physics", "sv_bot_motion", "sv_bot_motion_actions", "sv_bot_pathfinding"]
                .map(name => [`gamemode/bots/server/${name}.ts`, "server"]),
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
