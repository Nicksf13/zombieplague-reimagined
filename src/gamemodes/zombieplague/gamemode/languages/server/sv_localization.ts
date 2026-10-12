export {};
// Gamemode content is mounted at the GAME root. Workshop/FastDL must distribute
// these files too; native localization loads en first, then gmod_language.
for (const locale of ["en", "pt-BR", "es-ES", "ru", "uk", "zh-TW", "ja", "ko"])
    resource.AddFile("resource/localization/" + locale + "/zombieplague.properties");
