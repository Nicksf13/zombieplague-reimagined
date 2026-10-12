-- Generated from src/gamemodes/zombieplague/gamemode/messaging/server/sv_message.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ArrayIncludes(self, searchElement, fromIndex)
    if fromIndex == nil then
        fromIndex = 0
    end
    local len = #self
    local k = fromIndex
    if fromIndex < 0 then
        k = len + fromIndex
    end
    if k < 0 then
        k = 0
    end
    for i = k + 1, len do
        if self[i] == searchElement then
            return true
        end
    end
    return false
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
AddCSLuaFile("cl_message.lua")
____exports.ServerMessageManager = __TS__Class()
local ServerMessageManager = ____exports.ServerMessageManager
ServerMessageManager.name = "ServerMessageManager"
function ServerMessageManager.prototype.____constructor(self)
end
function ServerMessageManager.prototype.BroadcastMessage(self, text)
    for ____, ply in ipairs(player.GetAll()) do
        self:SendMessage(ply, text)
    end
end
function ServerMessageManager.prototype.BroadcastColorMessage(self, text, color, exclude)
    for ____, ply in ipairs(player.GetAll()) do
        if not exclude or not __TS__ArrayIncludes(exclude, ply) then
            self:SendColorMessage(ply, text, color)
        end
    end
end
function ServerMessageManager.prototype.BroadcastSound(self, path, exclude)
    for ____, ply in ipairs(player.GetAll()) do
        if not exclude or not __TS__ArrayIncludes(exclude, ply) then
            self:SendSound(ply, path)
        end
    end
end
function ServerMessageManager.prototype.BroadcastNotifyMessage(self, text, duration, color)
    for ____, ply in ipairs(player.GetAll()) do
        self:SendNotifyMessage(ply, text, duration, color)
    end
end
function ServerMessageManager.prototype.SendMessage(self, ply, text)
    self:SendColorMessage(
        ply,
        text,
        Color(255, 255, 255)
    )
end
function ServerMessageManager.prototype.SendColorMessage(self, ply, text, color)
    if type(text) ~= "string" then
        return self:SendLocalized(ply, "chat", text, color)
    end
    net.Start("SendMessage")
    net.WriteColor(color)
    net.WriteString(text)
    net.Send(ply)
end
function ServerMessageManager.prototype.SendConsoleMessage(self, ply, text)
    if type(text) ~= "string" then
        return self:SendLocalized(ply, "console", text)
    end
    net.Start("SendConsoleMessage")
    net.WriteString(text)
    net.Send(ply)
end
function ServerMessageManager.prototype.SendPopupMessage(self, ply, text)
    if type(text) ~= "string" then
        return self:SendLocalized(ply, "popup", text)
    end
    net.Start("SendPopupMessage")
    net.WriteString(text)
    net.Send(ply)
end
function ServerMessageManager.prototype.SendSound(self, ply, path)
    net.Start("SendSound")
    net.WriteString(path)
    net.Send(ply)
end
function ServerMessageManager.prototype.SendNotifyMessage(self, ply, text, duration, color)
    if type(text) ~= "string" then
        return self:SendLocalized(
            ply,
            "notify",
            text,
            color,
            duration
        )
    end
    net.Start("SendNotifyMessage")
    net.WriteInt(duration or 5, 8)
    net.WriteString(text)
    net.WriteColor(color or Color(255, 255, 255))
    net.Send(ply)
end
function ServerMessageManager.prototype.SendLocalized(self, ply, kind, text, color, duration)
    if color == nil then
        color = Color(255, 255, 255)
    end
    if duration == nil then
        duration = 5
    end
    net.Start("SendLocalizedMessage")
    net.WriteString(kind)
    net.WriteTable(text)
    net.WriteColor(color)
    net.WriteInt(duration, 8)
    net.Send(ply)
end
local messageManager = __TS__New(____exports.ServerMessageManager)
_G.BroadcastMessage = function(text) return messageManager:BroadcastMessage(text) end
_G.BroadcastColorMessage = function(text, color, exclude) return messageManager:BroadcastColorMessage(text, color, exclude) end
_G.BroadcastSound = function(path, exclude) return messageManager:BroadcastSound(path, exclude) end
_G.BroadcastNotifyMessage = function(text, duration, color) return messageManager:BroadcastNotifyMessage(text, duration, color) end
_G.SendMessage = function(ply, text) return messageManager:SendMessage(ply, text) end
_G.SendColorMessage = function(ply, text, color) return messageManager:SendColorMessage(ply, text, color) end
_G.SendConsoleMessage = function(ply, text) return messageManager:SendConsoleMessage(ply, text) end
_G.SendPopupMessage = function(ply, text) return messageManager:SendPopupMessage(ply, text) end
_G.SendSound = function(ply, path) return messageManager:SendSound(ply, path) end
_G.SendNotifyMessage = function(ply, text, duration, color) return messageManager:SendNotifyMessage(ply, text, duration, color) end
for ____, name in ipairs({
    "SendMessage",
    "SendConsoleMessage",
    "SendPopupMessage",
    "SendSound",
    "SendNotifyMessage",
    "SendLocalizedMessage"
}) do
    util.AddNetworkString(name)
end
return ____exports
