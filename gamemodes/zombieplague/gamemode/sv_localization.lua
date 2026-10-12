-- Generated from src/gamemodes/zombieplague/gamemode/languages/server/sv_localization.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
for ____, locale in ipairs({
    "en",
    "pt-BR",
    "es-ES",
    "ru",
    "uk",
    "zh-TW",
    "ja",
    "ko"
}) do
    resource.AddFile(("resource/localization/" .. locale) .. "/zombieplague.properties")
end
return ____exports
