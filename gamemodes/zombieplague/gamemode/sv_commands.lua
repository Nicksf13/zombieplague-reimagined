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
local botConsoleMessages = {
    usage = "Usage: zp_addbot [1-16] or /bot [1-16].",
    singleplayer = "Bots require multiplayer. Start a local game with at least 2 player slots.",
    full = "No player slots available.",
    created = "Added %d idle test bot(s).",
    failed = "Could not create a bot. Check server player slots."
}
local function reportBots(ply, result, count)
    local args = count == nil and ({}) or ({count})
    if IsValid(ply) then
        SendConsoleMessage(ply, {Phrase = "zombieplague.bot" .. result, Arguments = args})
    else
        print("[ZP] " .. string.format(
            botConsoleMessages[result],
            unpack(args)
        ))
    end
end
local function addIdleBots(ply, args)
    if IsValid(ply) and not ply:IsSuperAdmin() then
        SendPopupMessage(ply, {Phrase = "zombieplague.commandnotaccess"})
        return
    end
    local count = args[1] == nil and 1 or tonumber(args[1])
    if #args > 1 or count == nil or count < 1 or count > 16 or count % 1 ~= 0 then
        reportBots(ply, "usage")
        return
    end
    if game.SinglePlayer() then
        reportBots(ply, "singleplayer")
        return
    end
    local available = math.max(
        0,
        game.MaxPlayers() - player.GetCount()
    )
    if available == 0 then
        reportBots(ply, "full")
        return
    end
    local created = 0
    do
        local index = 0
        while index < math.min(count, available) do
            local bot = player.CreateNextBot("ZP Test Bot " .. tostring(#player.GetBots() + 1))
            if not IsValid(bot) then
                reportBots(ply, "failed")
                break
            end
            bot.ZPIdleTestBot = true
            RoundManager:AddPlayerToPlay(bot)
            created = created + 1
            index = index + 1
        end
    end
    if created > 0 then
        reportBots(ply, "created", created)
    end
end
if BOT_MODE then
    commands:AddCommand(
        "bot",
        "Add idle test bots to the match",
        addIdleBots,
        "[1-16]",
        true,
        function(ply) return ply:IsSuperAdmin() end
    )
    concommand.Add(
        "zp_addbot",
        function(ply, _command, args) return addIdleBots(ply, args) end
    )
    hook.Add(
        "StartCommand",
        "ZPIdleTestBots",
        function(ply, command)
            if not ply:IsBot() or not ply.ZPIdleTestBot then
                return
            end
            command:ClearButtons()
            command:ClearMovement()
            command:SetImpulse(0)
        end
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
