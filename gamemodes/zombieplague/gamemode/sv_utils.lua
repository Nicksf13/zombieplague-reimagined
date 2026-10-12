-- Generated from src/gamemodes/zombieplague/gamemode/core/server/sv_utils.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
_G.WARNING_MESSAGE = 1
_G.ERROR_MESSAGE = 2
_G.INFO_MESSAGE = 3
_G.Utils = {
    RecursiveFileSearch = function(self, currentPath, suffix)
        local files, directories = file.Find(currentPath .. "/*", "LUA")
        local found = {}
        for ____, name in ipairs(files) do
            if string.EndsWith(name, suffix) then
                found[(currentPath .. "/") .. name] = (currentPath .. "/") .. name
            else
                self:Print(WARNING_MESSAGE, ((("'" .. currentPath) .. "/") .. name) .. "' is not a .lua, ignoring it!")
            end
        end
        for ____, directory in ipairs(directories) do
            for key, value in pairs(self:RecursiveFileSearch((currentPath .. "/") .. directory, suffix)) do
                found[key] = value
            end
        end
        return found
    end,
    Print = function(self, kind, message)
        local prefix = kind == WARNING_MESSAGE and "WARNING" or (kind == ERROR_MESSAGE and "ERROR" or (kind == INFO_MESSAGE and "INFO" or ""))
        print((("[" .. prefix) .. "] ") .. message)
    end
}
return ____exports
