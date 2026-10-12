-- Generated from src/gamemodes/zombieplague/gamemode/bank/server/storage/text.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.TextBankStorage = __TS__Class()
local TextBankStorage = ____exports.TextBankStorage
TextBankStorage.name = "TextBankStorage"
function TextBankStorage.prototype.____constructor(self)
    self.Save = function(id, amount)
        file.Write(
            ("zombie_plague/" .. id) .. ".txt",
            tostring(amount)
        )
    end
end
function TextBankStorage.prototype.Init(self)
    if not file.Exists("zombie_plague", "DATA") then
        file.CreateDir("zombie_plague")
    end
end
function TextBankStorage.prototype.GetPlayerAmmopacks(self, ply)
    return tonumber(file.Read(
        ("zombie_plague/" .. ply:SteamID64()) .. ".txt",
        "DATA"
    ) or "0") or 0
end
Bank.BankStorageSource = __TS__New(____exports.TextBankStorage)
return ____exports
