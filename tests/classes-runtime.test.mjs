import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

// Construct another instance through the emitted class prototype. Production
// creates these instances with TypeScript's new operator.
const construct = `
local function construct(existing, ...)
    local prototype = assert(getmetatable(existing))
    local instance = setmetatable({}, prototype)
    instance:____constructor(...)
    return instance
end
`;

test("weapon instances keep their registries and available weapon lists independent", () => run(construct + `
    include("sv_utils.lua"); include("sv_weaponmanager.lua")
    local other = construct(WeaponManager)
    local weapon = other:CreateNewWeapon()
    weapon.WeaponID, weapon.PrettyName, weapon.DamageMultiplier = "custom", "Custom", 3
    other:AddWeapon(weapon, WEAPON_PRIMARY)
    assert(other:FindWeaponByWeaponId("custom", WEAPON_PRIMARY) == weapon)
    assert(other:GetWeaponMultiplier("custom") == 3)
    assert(not WeaponManager:FindWeaponByWeaponId("custom", WEAPON_PRIMARY))
    assert(not WeaponManager:GetWeaponMultiplier("custom"))
    other.ServerWeapons[#other.ServerWeapons + 1] = "custom"
    assert(other:ServerHasWeapon("custom") and not WeaponManager:ServerHasWeapon("custom"))
    WeaponManager:SearchWeapons()
    assert(WeaponManager:ServerHasWeapon("m9k_usp") and not other:ServerHasWeapon("m9k_usp"))
    assert(#NATIVE_WEAPONS == 8)
`));

test("class, item and map registrations belong to the receiving instance", () => run(construct + `
    include("sv_utils.lua"); include("sv_classmanager.lua")
    include("sv_extraitems.lua"); include("sv_mapmanager.lua")
    local classes, items, maps = construct(ClassManager), construct(ExtraItemsManager), construct(MapManager)
    local human = classes:NewHumanClass()
    classes:AddZPClass("custom", human, TEAM_HUMANS)
    assert(classes:GetHumanClass("custom") == human and not ClassManager:GetHumanClass("custom"))
    local item = {ID="custom", Name="Custom", Price=1, Order=1}
    items:AddExtraItem(item, ITEM_HUMAN)
    assert(items:GetHumansExtraItems()[1] == item and #ExtraItemsManager:GetHumansExtraItems() == 0)
    local config = {MapName="custom_map"}
    maps:AddMapConfig(config)
    assert(maps:GetMapConfig("custom_map") == config and not MapManager:GetMapConfig("custom_map"))
`));

test("bank callbacks retain their instance and preserve failed balances for retry", () => run(construct + `
    file.Exists = function() return true end
    include("sv_bank.lua")
    local saved, fail = {}, true
    local diagnostics = {}
    print = function(message) diagnostics[#diagnostics+1] = message end
    local storage = {Save=function(id, amount)
        if fail then error("disk unavailable") end
        saved[id] = amount
    end}
    local bank = construct(Bank, storage)
    local id = "76561198012345678"
    bank:SetPlayerAmmoPacks({SteamID64=function() return id end}, 42)
    assert(Bank.AmmoPacksStorage[id] == nil)
    local callback = bank.Save
    callback()
    assert(bank.AmmoPacksStorage[id] == 42 and saved[id] == nil)
    assert(diagnostics[1] == "Error on ammo pack saving:" and #diagnostics == 2)
    fail = false
    callback()
    assert(saved[id] == 42 and bank.AmmoPacksStorage[id] == nil)
    assert(timers.ZPBankSaver[2] == Bank.Save and hooks.ShutDown.ZPBankDepositAll == Bank.Save)
`));

test("detached convar command callbacks list the receiving instance's registry", () => run(construct + `
    function CreateConVar() end
    local lines = {}
    function SendConsoleMessage(_, text) lines[#lines+1] = text end
    function SendColorMessage() end
    include("sv_convar.lua")
    local other = construct(ConvarManager)
    other:CreateConVar("custom", 1, 8, "Only on this instance")
    local callback = other.ListCvars
    callback({}, {})
    assert(lines[2] == "custom - Only on this instance")
    assert(not ConvarManager.Convars.custom)
    assert(commands.cvars == ConvarManager.ListCvars and commands.makecvarslist == ConvarManager.ListCvars)
`));
