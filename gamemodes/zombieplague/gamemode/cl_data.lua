-- Generated from src/gamemodes/zombieplague/gamemode/core/client/cl_data.ts. DO NOT EDIT; run npm run build.
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
local function localizedText(value, depth)
    if depth == nil then
        depth = 0
    end
    local text = ZPClientData.Record(value)
    if not text or depth > 4 or type(text.Phrase) ~= "string" or #text.Phrase > 128 then
        return
    end
    if string.sub(text.Phrase, 1, 13) ~= "zombieplague." then
        return
    end
    local phrase = language.GetPhrase(text.Phrase)
    if text.Arguments == nil then
        return phrase
    end
    local argumentsRecord = ZPClientData.Record(text.Arguments)
    if not argumentsRecord then
        return
    end
    local count = #__TS__ObjectKeys(argumentsRecord)
    if count > 8 then
        return
    end
    local args = {}
    do
        local index = 1
        while index <= count do
            local argument = argumentsRecord[index]
            if type(argument) == "string" and #argument <= 4000 then
                args[#args + 1] = argument
            elseif type(argument) == "number" and argument == argument and math.abs(argument) ~= math.huge then
                args[#args + 1] = argument
            elseif type(argument) == "table" then
                local translated = localizedText(argument, depth + 1)
                if translated == nil then
                    return
                end
                args[#args + 1] = translated
            else
                return
            end
            index = index + 1
        end
    end
    local success, formatted = pcall(
        string.format,
        phrase,
        unpack(args)
    )
    return success and type(formatted) == "string" and formatted or phrase
end
_G.ZPClientData = {
    Record = function(value)
        return type(value) == "table" and value ~= nil and value or nil
    end,
    LocalizedText = localizedText
}
return ____exports
