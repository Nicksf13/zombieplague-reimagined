-- Generated from src/gamemodes/zombieplague/gamemode/core/server/sv_convar.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__ArraySort(self, compareFn)
    if compareFn ~= nil then
        table.sort(
            self,
            function(a, b) return compareFn(nil, a, b) < 0 end
        )
    else
        table.sort(self)
    end
    return self
end

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
local function listConvars(ply, convars)
    local sorted = {}
    for name, description in pairs(convars) do
        sorted[#sorted + 1] = {Name = name, Description = description}
    end
    __TS__ArraySort(
        sorted,
        function(____, a, b) return a.Name < b.Name and -1 or (a.Name > b.Name and 1 or 0) end
    )
    SendConsoleMessage(ply, "Convars server list:")
    for ____, item in ipairs(sorted) do
        SendConsoleMessage(ply, (item.Name .. " - ") .. item.Description)
    end
    SendColorMessage(
        ply,
        "ConVars has been printed on the console",
        Color(255, 255, 0)
    )
end
____exports.ConvarManager = __TS__Class()
local ConvarManager = ____exports.ConvarManager
ConvarManager.name = "ConvarManager"
function ConvarManager.prototype.____constructor(self)
    self.Convars = {}
    self.ListCvars = function(ply) return listConvars(ply, self.Convars) end
end
function ConvarManager.prototype.CreateConVar(self, name, value, flags, description)
    CreateConVar(
        name,
        tostring(value),
        flags,
        description
    )
    self.Convars[name] = description
end
local convarManager = __TS__New(____exports.ConvarManager)
_G.ConvarManager = convarManager
Commands:AddCommand(
    "cvars",
    "List all cvars available for zombieplague",
    convarManager.ListCvars,
    "",
    true
)
Commands:AddCommand(
    "makecvarslist",
    "Make a list of all cvars available for zombieplague",
    convarManager.ListCvars,
    "",
    true
)
return ____exports
