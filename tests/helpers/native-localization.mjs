import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const catalogs = new URL("../../gamemodes/zombieplague/content/resource/localization/", import.meta.url);
export const locales = readdirSync(catalogs, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
export const books = Object.fromEntries(locales.map(locale => {
    const url = new URL(`../../gamemodes/zombieplague/content/resource/localization/${locale}/zombieplague.properties`, import.meta.url);
    const source = readFileSync(url, "utf8");
    assert(/^\r?\n/.test(source), `${locale}: native files require an empty first line`);
    const phrases = {};
    for (const line of source.split(/\r?\n/)) {
        if (!line || line.startsWith("#")) continue;
        const separator = line.indexOf("=");
        assert(separator > 0, `${locale}: invalid property`);
        const key = line.slice(0, separator);
        assert(/^zombieplague\.[a-z0-9]+$/.test(key) && !(key in phrases), key);
        phrases[key] = line.slice(separator + 1).replace(/\\([\\:=nrt])/g,
            (_, character) => ({ n: "\n", r: "\r", t: "\t" })[character] ?? character);
    }
    return [locale, phrases];
}));

const table = value => `{${Object.entries(value).map(([key, text]) =>
    `[${JSON.stringify(key)}]=${typeof text === "string" ? JSON.stringify(text) : table(text)}`).join(",")}}`;

// Simulate only the native lookup: en is loaded first, then gmod_language.
// Production never loads or parses properties in Lua.
export const nativeLanguage = `
local translations = ${table(books)}
local selectedLocale = "en"
language = {GetPhrase=function(key)
    return (translations[selectedLocale] or {})[key] or translations.en[key] or key
end}
`;
