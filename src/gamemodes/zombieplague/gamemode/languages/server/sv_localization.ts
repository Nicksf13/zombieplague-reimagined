export {};
// Gamemode content is mounted at the GAME root. Workshop/FastDL must distribute
// these files too; native localization loads en first, then gmod_language.
for (const locale of [
    "bg", "cs", "da", "de", "el", "en", "en-PT", "es-ES", "et", "fi", "fr", "he",
    "hr", "hu", "it", "ja", "ko", "lt", "nl", "no", "pl", "pt-BR", "pt-PT", "ru",
    "sk", "sv-SE", "th", "tr", "uk", "vi", "zh-CN", "zh-TW",
])
    resource.AddFile("resource/localization/" + locale + "/zombieplague.properties");
