-- Generated from src/gamemodes/zombieplague/gamemode/menus/shared/sh_weapon_menu_protocol.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__ObjectKeys(obj)
    local result = {}
    local len = 0
    for key in pairs(obj) do
        len = len + 1
        result[len] = key
    end
    return result
end
-- End of Lua Library inline imports
local ____exports = {}
local function record(value)
    return type(value) == "table" and value ~= nil and value or nil
end
local function category(value)
    return value == "primary" or value == "secondary" or value == "melee"
end
local function requestID(value)
    return type(value) == "number" and value >= 1 and value <= 2147483647 and value % 1 == 0
end
local function identifier(value)
    return type(value) == "string" and #value > 0 and #value <= 128
end
local function snapshot(value)
    local data = record(value)
    local selected = record(data and data.Selected)
    local canReceive = record(data and data.CanReceive)
    local entries = record(data and data.Entries)
    if not data or not selected or not canReceive or not entries or type(data.Truncated) ~= "boolean" then
        return
    end
    for ____, kind in ipairs({"primary", "secondary", "melee"}) do
        if type(selected[kind]) ~= "string" or #selected[kind] > 128 or type(canReceive[kind]) ~= "boolean" then
            return
        end
    end
    local count = #__TS__ObjectKeys(entries)
    if count > 256 then
        return
    end
    local result = {}
    local seen = {}
    do
        local index = 1
        while index <= count do
            local entry = record(entries[index])
            if not entry or not identifier(entry.ID) or not identifier(entry.Name) or not category(entry.Kind) or type(entry.Order) ~= "number" or entry.Order ~= entry.Order or math.abs(entry.Order) == math.huge then
                return
            end
            local key = (entry.Kind .. ":") .. entry.ID
            if seen[key] then
                return
            end
            seen[key] = true
            result[#result + 1] = {ID = entry.ID, Name = entry.Name, Kind = entry.Kind, Order = entry.Order}
            index = index + 1
        end
    end
    return {Entries = result, Selected = {primary = selected.primary, secondary = selected.secondary, melee = selected.melee}, CanReceive = {primary = canReceive.primary, secondary = canReceive.secondary, melee = canReceive.melee}, Truncated = data.Truncated}
end
_G.ZPWeaponMenuProtocol = {
    Category = category,
    RequestID = requestID,
    Selection = function(value)
        local data = record(value)
        if (data and data.Version) ~= 1 or not requestID(data.RequestID) or not category(data.Kind) or not identifier(data.ID) then
            return
        end
        return {Version = 1, RequestID = data.RequestID, Kind = data.Kind, ID = data.ID}
    end,
    Reply = function(value)
        local data = record(value)
        if (data and data.Version) ~= 1 or not requestID(data.RequestID) then
            return
        end
        local code = data.Code
        if code ~= "catalog" and code ~= "saved" and code ~= "issued" and code ~= "invalid_weapon" and code ~= "rate_limited" then
            return
        end
        local state = snapshot(data.Snapshot)
        if code == "catalog" or code == "saved" or code == "issued" then
            if not state then
                return
            end
            return {Version = 1, RequestID = data.RequestID, Code = code, Snapshot = state}
        end
        return {Version = 1, RequestID = data.RequestID, Code = code}
    end
}
return ____exports
