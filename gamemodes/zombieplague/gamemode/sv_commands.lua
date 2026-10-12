-- Generated from src/gamemodes/zombieplague/gamemode/core/server/sv_commands.ts. DO NOT EDIT; run npm run build.
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
-- End of Lua Library inline imports
local ____exports = {}
____exports.Commands = __TS__Class()
local Commands = ____exports.Commands
Commands.name = "Commands"
function Commands.prototype.____constructor(self)
    self.CommandList = {}
end
function Commands.prototype.AddCommand(self, names, description, action, help, privateCommand, permission)
    local aliases = type(names) == "string" and ({names}) or names
    for ____, name in ipairs(aliases) do
        if not self.CommandList[name] then
            self.CommandList[name] = {
                Description = description,
                Function = action,
                Help = help or "",
                Private = privateCommand,
                PermissionFunction = permission
            }
        end
    end
end
local commands = __TS__New(____exports.Commands)
_G.Commands = commands
commands:AddCommand(
    "commands",
    "Print the server's commands.",
    function(ply)
        SendColorMessage(
            ply,
            "Server's command list has been printed!",
            Color(255, 255, 0)
        )
        local text = "--------------------------Commands--------------------------\n"
        for name, command in pairs(commands.CommandList) do
            if not command.Private or ply:IsSuperAdmin() then
                text = text .. ((((((name .. " - Description: ") .. command.Description) .. " - Sintax: /") .. name) .. " ") .. command.Help) .. "\n"
            end
        end
        SendConsoleMessage(ply, text .. "------------------------------------------------------------")
    end
)
if BOT_MODE then
    commands:AddCommand(
        "bot",
        "Add a bot to the server",
        function()
            RunConsoleCommand("bot")
            timer.Create(
                "bot",
                1,
                1,
                function()
                    local manager = RoundManager
                    local participants = manager:GetPlayersToPlay()
                    for ____, bot in ipairs(player.GetBots()) do
                        if not __TS__ArrayIncludes(participants, bot) then
                            manager:AddPlayerToPlay(bot)
                        end
                    end
                end
            )
        end,
        "",
        true,
        function(ply) return ply:IsSuperAdmin() end
    )
end
hook.Add(
    "PlayerSay",
    "Commands",
    function(ply, text)
        local args = string.Explode(
            " ",
            string.lower(text)
        )
        local first = args[1] or ""
        if string.sub(first, 1, 1) ~= "/" and string.sub(first, 1, 1) ~= "!" then
            return
        end
        local command = commands.CommandList[string.sub(first, 2)]
        table.remove(args, 1)
        if not command then
            return
        end
        if args[1] == "help" or args[1] == "ajuda" then
            SendColorMessage(
                ply,
                "Help:\n" .. command.Help,
                Color(255, 255, 0)
            )
        elseif not command.PermissionFunction or command.PermissionFunction(ply) then
            command.Function(ply, args)
        else
            SendPopupMessage(ply, {Phrase = "zombieplague.commandnotaccess"})
        end
        if command.Private then
            return ""
        end
    end
)
return ____exports
