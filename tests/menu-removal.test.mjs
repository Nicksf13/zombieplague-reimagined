import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

test("retired menu files are absent from the manifest and runtime", () => {
    const root = new URL("../", import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL("migration.json", root), "utf8"));
    for (const name of ["cl_menu", "cl_menu_network", "cl_derma", "sv_weaponselection",
        "vgui/vgui_keybinding", "vgui/vgui_hudcustomizer"]) {
        const runtime = `gamemodes/zombieplague/gamemode/${name}`;
        assert(!manifest.files.includes(runtime));
        assert(!(runtime in manifest.sourcePaths));
        assert(!existsSync(new URL(`${runtime}.lua`, root)));
    }
    for (const runtime of manifest.files) {
        const lua = readFileSync(new URL(`${runtime}.lua`, root), "utf8");
        assert(!/OpenBackMenu|OpenZPMenu|ZPMenuKeyListener|ChooseMenu/.test(lua), runtime);
    }
});

test("client initialization and saved F4 bindings cannot install the old menu hooks", () => run(`
    GM = {}
    KEY_NONE, KEY_F3, KEY_T = 0, 94, 30
    local loaded = {}
    local realInclude = include
    include = function(path)
        loaded[path] = true
        if path == "cl_data.lua" or path == "cl_keymanager.lua" or path == "cl_init.lua" then
            return realInclude(path)
        end
    end
    file.Exists = function() return true end
    file.Read = function() return "saved" end
    file.Write = function() end
    util.JSONToTable = function() return {ZombiePlagueMenu={ZPMenu=95}} end
    util.TableToJSON = function() return "{}" end
    concommand = {Add=function() end}
    net.SendToServer = function() end
    input = {IsKeyDown=function() return true end}
    function LocalPlayer() return {IsTyping=function() return false end} end
    function CurTime() return 10 end
    include("cl_init.lua")
    hooks.InitPostEntity.PlayerRdy()
    assert(sent[1] == "RequestServerStatus")
    assert(not loaded["cl_menu.lua"] and not loaded["cl_derma.lua"])
    assert(not MMenu and not OptionMenu and not CreateMenu and not OpenZPMenu)
    assert(not receivers.OpenBackMenu and not receivers.OpenZPMenu)
    assert(not KeyManager.EventGroups.ZombiePlagueMenu and not KeyManager.Keys.ZombiePlagueMenu)
    assert(not hooks.SetupMove and not hooks.HUDPaint)
    hooks.Think.KeyManagerHook()
    assert(sent[1] ~= "RequestHumanMenu" and sent[1] ~= "RequestZombieMenu")
`));

test("server managers keep gameplay hooks without registering menu commands or receivers", () => run(`
    GM = {}
    include("sv_classmanager.lua")
    include("sv_weaponmanager.lua")
    include("sv_extraitems.lua")
    include("sh_roundmanager.lua")
    include("sv_roundmanager.lua")
    include("sv_event_players.lua")
    include("sv_votemap.lua")
    for _, name in ipairs({"OpenZPMenu", "OpenBackMenu", "RequestHumanMenu", "RequestZombieMenu",
        "RequestPrimaryWeaponMenu", "RequestSecondaryWeaponMenu", "RequestMeleeWeaponMenu",
        "RequestExtraItemMenu", "OpenExtraItemMenu", "RequestLanguageMenu", "RequestRoundsMenu",
        "RequestSpectator", "SendPrimaryWeapon", "SendSecondaryWeapon", "SendMeleeWeapon",
        "SendHumanClass", "SendZombieClass", "BuyExtraItem", "SendLanguage", "SendRounds", "SendVotemap"}) do
        assert(not receivers[name], name)
        assert(not registered[name], name)
    end
    for _, name in ipairs({"zp", "humans", "zombies", "weapons", "primaryweapon", "secondaryweapon",
        "meleeweapon", "extraitem", "languages"}) do
        assert(not commands[name], name)
    end
    assert(receivers.RequestAbility and receivers.RequestNightvision)
    assert(hooks.ZPEndRound.ZPExtraItemsRemove and hooks.PostPlayerDeath.RoundEndCheck)
    assert(hooks.PlayerDeath.ZPPlayerDeath and hooks.ZPNewRound.zp_round_start_notify_rounds_left)
    assert(not WeaponManager.OpenWeaponMenu and not ClassManager.OpenZPClassMenu)
    assert(not ExtraItemsManager.OpenExtraItemMenu and not Dictionary)
    assert(not RoundManager.OpenRoundsMenu)
    assert(#sent == 0)
    -- Class names still synchronize from server to client for the HUD.
    function FindMetaTable() return {} end
    include("sv_player.lua")
    assert(registered.SendHumanClass and registered.SendZombieClass)
    assert(not receivers.SendHumanClass and not receivers.SendZombieClass)
`));
