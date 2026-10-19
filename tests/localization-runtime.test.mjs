import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { books, locales, nativeLanguage } from "./helpers/native-localization.mjs";

test("stamina HUD label resolves in every native catalog", () => {
    for (const locale of locales)
        assert(books[locale]["zombieplague.hudstamina"]?.trim(), `${locale}: missing hudstamina`);
});

test("AI progress history, comparisons and all event labels resolve in every catalog", () => {
    const keys = "title|help|bot|version|scenario|difficulty|role|period|export|exported|counts|summary|combat|interval|improvement|regression|inconclusive|rewardwarning|states|metric|select|empty|graphhelp|metrics".split("|");
    for (const locale of locales) {
        for (const key of keys) assert(books[locale]["zombieplague.botstats" + key]?.trim(), `${locale}: ${key}`);
        assert.equal(books[locale]["zombieplague.botstatsstates"].split("|").length, 14);
        assert.equal(books[locale]["zombieplague.botstatsmetrics"].split("|").length, 10);
    }
});

test("adaptive bot commands and navigation notices resolve in every native catalog", () => {
    for (const locale of locales)
        for (const key of ["aibotusage", "aibotcreated", "aibotnavmissing"])
            assert(books[locale]["zombieplague." + key]?.trim(), `${locale}: ${key}`);
});

test("automatic bot filling labels resolve in every native catalog", () => {
    for (const locale of locales) for (const key of ["title", "help", "enabled", "target", "maximum", "status"])
        assert(books[locale]["zombieplague.botfill" + key]?.trim(), `${locale}: missing botfill${key}`);
});

test("cooperative boost editing and outcome labels resolve in every catalog", () => {
    for (const locale of locales) for (const suffix of ["title", "help", "base", "approach", "exit", "new", "save", "test", "remove", "close", "choose", "results", "capture", "ready", "invalid", "busy", "testing", "success", "failed", "mount", "previewinvalid"])
        assert(books[locale]["zombieplague.botboost" + suffix]?.trim(), `${locale}: missing botboost${suffix}`);
});

test("SWEP editing actions and explicit error reasons exist in every catalog", () => {
    const keys = "edit|selectmode|selecthint|editing|saved|complete|back|discard|confirmremove|live|measure|surface|range|distance|level|rise|reach|stale|capacity|storage|alive|tool|disabled|round|frozen|bots|retry|unsaved|incomplete|draft|actions|menuhint|equip".split("|");
    for (const locale of locales) for (const key of keys)
        assert(books[locale]["zombieplague.botboost" + key]?.trim(), `${locale}: missing botboost${key}`);
});

test("spectator participation controls and notifications resolve in every native catalog", () => {
    for (const locale of locales) for (const key of ["mainmenuspectate", "mainmenuspectatedescription", "mainmenujoin", "mainmenujoindescription",
        "participationspectating", "participationjoined", "participationqueued"])
        assert(books[locale]["zombieplague." + key]?.trim(), `${locale}: missing ${key}`);
});

test("bot metrics labels and behavior names resolve in all native catalogs", () => {
    const keys = ["add", "count", "page", "empty", "previous", "next", "identity", "scope", "decision", "route", "destination", "movement", "water", "stamina", "resources", "combat", "learning", "outcomes", "aggressive", "cooperative", "defensive", "cautious", "attack", "defend", "retreat", "group", "profile", "learned", "explore", "search", "mesh", "local", "none"];
    for (const locale of locales) for (const key of keys)
        assert(books[locale]["zombieplague.botmetrics" + key]?.trim(), `${locale}: missing botmetrics${key}`);
});

test("visual decision graph labels resolve in every native catalog", () => {
    for (const locale of locales) for (const key of ["title", "legend", "inputs", "actions", "chosen", "threat", "distance", "allies", "held", "idle", "details"])
        assert(books[locale]["zombieplague.botvisual" + key]?.trim(), `${locale}: missing botvisual${key}`);
});

test("locomotion controls and metrics resolve in every native catalog", () => {
    for (const locale of locales) for (const key of ["title", "combat", "ground", "air", "water", "ladder", "jump", "space", "duck", "sprint", "stage", "passage", "result", "reward", "progress", "recovery", "resources", "preferences"])
        assert(books[locale]["zombieplague.botmotion" + key]?.trim(), `${locale}: missing botmotion${key}`);
});

test("shelter and hunt states and outcomes resolve in every native catalog", () => {
    for (const locale of locales) for (const key of ["title", "patrol", "shelter", "guard", "hunt", "inspect", "clue", "record", "outcomes", "hold"])
        assert(books[locale]["zombieplague.botplace" + key]?.trim(), `${locale}: missing botplace${key}`);
});
test("navigation rejection reasons and descent phases resolve in every native catalog", () => {
    for (const locale of locales) for (const key of ["connection", "metrics", "phaseroute", "phasealign", "phasecross", "phaseland",
        "reasonready", "reasonmissing", "reasonconnection", "reasonheight", "reasonfall", "reasonlanding", "reasonobstacle", "reasonstalled", "reasonbudget", "reasonground", "reasonoccupied"])
        assert(books[locale]["zombieplague.botnav" + key]?.trim(), `${locale}: missing botnav${key}`);
});

test("extra item shop labels resolve in every native catalog", () => {
    for (const locale of locales)
        for (const key of ["mainmenuextras", "mainmenuextrasdescription", "extramenubuy", "extramenuempty",
            "extramenuwrongteam", "extramenunotalive", "extramenubought", "extramenutruncated"])
            assert(books[locale]["zombieplague." + key]?.trim(), `${locale}: ${key}`);
});

test("map voting and nomination labels resolve in all catalogs", () => {
    const suffixes = ["title", "remaining", "winner", "help", "nominatehelp", "extend", "votes", "won",
        "selected", "leading", "usage", "maplist", "locked", "nominated", "invalid", "command"];
    for (const locale of locales)
        for (const suffix of suffixes) assert(books[locale]["zombieplague.mapvote" + suffix]?.trim(), `${locale}: ${suffix}`);
});

test("class selection labels resolve in all catalogs", () => {
    for (const locale of locales)
        for (const key of ["mainmenuclasses", "mainmenuclassesdescription", "classmenufirst", "classmenunext",
            "classmenuempty", "classmenuinvalid", "classjump", "classdamage", "classcrouchspeed", "classscale",
            "classfootsteps", "classfalldamage", "classabilitycost", "classabilityactivation", "classmenuexpand", "classmenucollapse"])
            assert(books[locale]["zombieplague." + key]?.trim(), `${locale}: ${key}`);
});

test("weapon search, family filters and round preferences resolve in all catalogs", () => {
    const suffixes = ["search", "remember", "rememberhelp", "familyall", "familysmg", "familymachinegun",
        "familyrifle", "familysniper", "familyshotgun", "familypistol", "familyrevolver", "familymelee", "familyother"];
    for (const locale of locales)
        for (const suffix of suffixes) assert(books[locale]["zombieplague.weaponmenu" + suffix]?.trim(), `${locale}: ${suffix}`);
});

test("admin navigation, environment labels, and restart confirmation resolve in every catalog", () => {
    const sources = ["shared/sh_admin_config", "client/cl_admin_menu", "client/cl_admin_menu_hud"]
        .map(name => readFileSync(new URL(`../src/gamemodes/zombieplague/gamemode/menus/${name}.ts`, import.meta.url), "utf8"))
        .join("\n");
    const keys = [...new Set([...sources.matchAll(/"(zombieplague\.[a-z]+)"/g)].map(match => match[1]))];
    assert(keys.includes("zombieplague.adminreloadwarning"));
    for (const locale of locales)
        for (const key of keys) assert(books[locale][key]?.trim(), `${locale}: missing admin label ${key}`);
});

test("main menu convar labels resolve in every native catalog", () => {
    const settings = readFileSync(new URL("../gamemodes/zombieplague/zombieplague.txt", import.meta.url), "utf8");
    const keys = [...settings.matchAll(/"text"\s+"#([^"]+)"/g)].map(match => match[1]);
    assert.equal(keys.length, 20);
    for (const locale of locales) {
        for (const key of keys) assert(books[locale][key]?.trim(), `${locale}: missing menu label ${key}`);
    }
    assert.equal(books["pt-BR"]["zombieplague.cvarminplayers"], "Mínimo de jogadores");
});

test("AI training is an opt-in multiplayer launch option with translated capacity help", () => {
    const settings = readFileSync(new URL("../gamemodes/zombieplague/zombieplague.txt", import.meta.url), "utf8");
    const entry = [...settings.matchAll(/\b\d+\s*\{([^{}]*)\}/g)].find(match => match[1].includes('"zp_bot_training"'))?.[1];
    assert(entry);
    assert.match(entry, /"type"\s+"CheckBox"/);
    assert.match(entry, /"default"\s+"0"/);
    assert(!entry.includes('"singleplayer"'));
    for (const locale of locales) {
        assert(books[locale]["zombieplague.cvarbottraining"]?.trim());
        assert(books[locale]["zombieplague.cvarbottraininghelp"]?.includes("64"));
    }
    assert.equal(books["pt-BR"]["zombieplague.cvarbottraining"], "Treinar IA");
    const count = [...settings.matchAll(/\b\d+\s*\{([^{}]*)\}/g)].find(match => match[1].includes('"zp_bot_training_count"'))?.[1];
    assert(count);
    assert.match(count, /"type"\s+"Numeric"/);
    assert.match(count, /"default"\s+"2"/);
    assert(!count.includes('"singleplayer"'));
    for (const locale of locales) assert(books[locale]["zombieplague.cvarbottrainingcount"]?.trim());
});

test("night brightness controls stay together in the main menu text group, including singleplayer", () => {
    const settings = readFileSync(new URL("../gamemodes/zombieplague/zombieplague.txt", import.meta.url), "utf8");
    const entries = [...settings.matchAll(/\b\d+\s*\{([^{}]*)\}/g)].map(match =>
        Object.fromEntries([...match[1].matchAll(/"([^"]+)"\s+"([^"]*)"/g)]
            .map(field => [field[1], field[2]])));
    // GMod renders Text controls before Numeric and CheckBox controls, regardless
    // of their order in the settings file. Keep the environment fields adjacent.
    const textFields = entries.filter(entry => entry.type === "Text");
    assert.deepEqual(textFields.map(entry => entry.name), [
        "zp_map_skybox", "zp_map_night_brightness", "zp_map_night_exposure",
    ]);
    for (const entry of textFields) assert.equal(entry.singleplayer, "1", entry.name);
    assert.equal(textFields[2].default, "100");
    const cycle = entries.find(entry => entry.name === "zp_map_day_cycle");
    assert.equal(cycle?.type, "CheckBox");
    assert.equal(cycle.default, "0");
    assert.equal(cycle.singleplayer, "1");
    assert.equal(cycle.replicate, "0");
});

test("all 32 GMod languages have complete native catalogs and valid format parameters", () => {
    assert.deepEqual(locales, [
        "bg", "cs", "da", "de", "el", "en", "en-PT", "es-ES", "et", "fi", "fr", "he",
        "hr", "hu", "it", "ja", "ko", "lt", "nl", "no", "pl", "pt-BR", "pt-PT", "ru",
        "sk", "sv-SE", "th", "tr", "uk", "vi", "zh-CN", "zh-TW",
    ]);
    const keys = Object.keys(books.en).sort();
    for (const locale of locales) {
        assert.deepEqual(Object.keys(books[locale]).sort(), keys, `${locale}: incomplete catalog`);
        for (const name of ["extraitemex41name", "extraitemmilkormk1name", "extraitemnervegasname",
            "extraitemorbitalstrikename", "extraitemrpg7name"]) {
            assert.equal(typeof books[locale][`zombieplague.${name}`], "string", `${locale}/${name}`);
        }
        for (const [key, value] of Object.entries(books[locale])) {
            assert(value.trim(), `${locale}/${key}: empty translation`);
            assert(!value.includes("\uFFFD"), `${locale}/${key}: broken Unicode`);
            assert.deepEqual(value.match(/%[sdif]/g) ?? [], books.en[key].match(/%[sdif]/g) ?? [], `${locale}/${key}`);
        }
    }
    assert.equal(books["pt-BR"]["zombieplague.extraitembought"], "Você comprou: '%s'.");
    assert.match(books.ru["zombieplague.humandefaultclassname"], /[А-Яа-я]/);
    assert.match(books["zh-TW"]["zombieplague.humandefaultclassname"], /[\u3400-\u9fff]/);
    const manifest = JSON.parse(readFileSync(new URL("../migration.json", import.meta.url), "utf8"));
    assert(!manifest.files.some(path => /\/(?:sv_language|cl_language)$|\/languages\//.test(path)));
});

test("new catalogs and added translations carry an English review notice", () => {
    const originalLocales = ["en", "pt-BR", "es-ES", "ru", "uk", "zh-TW", "ja", "ko"];
    for (const locale of locales) {
        if (locale === "en") continue;
        const source = readFileSync(new URL(
            `../gamemodes/zombieplague/content/resource/localization/${locale}/zombieplague.properties`, import.meta.url), "utf8");
        const notice = originalLocales.includes(locale)
            ? "# The following translations were auto-generated and are pending confirmation."
            : "# This translation was auto-generated and is pending confirmation.";
        assert(source.includes(notice), `${locale}: missing review notice`);
    }
});

test("native catalogs are registered as gamemode content without sending language tables", () => run(`
    local resources = {}
    resource.AddFile = function(path) resources[path] = true end
    include("sv_localization.lua")
    local count = 0
    for path in pairs(resources) do
        assert(path:match("^resource/localization/[^/]+/zombieplague.properties$"))
        count = count + 1
    end
    assert(count == ${locales.length})
    for _, locale in ipairs({${locales.map(locale => JSON.stringify(locale)).join(",")}}) do
        assert(resources["resource/localization/" .. locale .. "/zombieplague.properties"], locale)
    end
    GM = {}
    function FindMetaTable() return {} end
    include("sv_player.lua")
    assert(not Dictionary and not registered.SendPlayerLanguage)
    assert(not receivers.SendLanguage and #sent == 0)
`));

test("one server payload resolves independently for each client's native language", () => run(nativeLanguage + `
    include("cl_data.lua")
    local message = {Phrase="zombieplague.noticeinfect", Arguments={"#zombieplague.classhealth", "José%"}}
    local english = ZPClientData.LocalizedText(message)
    selectedLocale = "pt-BR"
    local portuguese = ZPClientData.LocalizedText(message)
    assert(english ~= portuguese)
    assert(english:find("#zombieplague.classhealth", 1, true) and portuguese:find("José%", 1, true))
    local purchase = {Phrase="zombieplague.extraitembought", Arguments={{Phrase="zombieplague.extraitemarmorname"}}}
    assert(ZPClientData.LocalizedText(purchase) == "Você comprou: 'Colete'.")
    assert(ZPClientData.LocalizedText({Phrase="zombieplague.roundsleft", Arguments={7}}) == "7 rodada(s) restante(s)!")
    selectedLocale = "unsupported"
    assert(ZPClientData.LocalizedText(purchase) == "You bought: 'Armor'.")
    assert(ZPClientData.LocalizedText({Phrase="zombieplague.unknown"}) == "zombieplague.unknown")
`));

test("localized message transport preserves old raw channels and renders every presentation", () => run(nativeLanguage + `
    local captured, popup, chatText, consoleText, panels = {}, nil, nil, nil, {}
    NOTIFY_GENERIC, FILL = 0, 1
    function ScrW() return 1920 end
    net.WriteColor = function(color) sent[#sent+1] = color end
    net.WriteInt = function(value) sent[#sent+1] = value end
    net.ReadColor = function() return Color(10,20,30) end
    net.ReadInt = function() return 7 end
    include("sv_message.lua")
    local ply = {}
    local payload = {Phrase="zombieplague.extraitembought", Arguments={{Phrase="zombieplague.extraitemarmorname"}}}
    SendPopupMessage(ply, payload)
    assert(sent[1] == "SendLocalizedMessage" and sent[2] == "popup" and sent[3] == payload and sent.recipient == ply)
    assert(not registered.SendPlayerLanguage)
    SendPopupMessage(ply, "literal %s")
    assert(sent[1] == "SendPopupMessage" and sent[2] == "literal %s" and #sent == 2)
    SendNotifyMessage(ply, payload, 7, Color(10,20,30))
    assert(sent[2] == "notify" and sent[4].g == 20 and sent[5] == 7)
    chat = {AddText=function(...) local args={...}; chatText=args[#args] end}
    notification = {AddLegacy=function(text) popup=text end}
    print = function(text) consoleText=text end
    vgui = {Create=function(kind)
        local panel = setmetatable({kind=kind}, {__index=function(_, method)
            return function(self, value) captured[method]=value end
        end})
        panels[#panels+1]=panel
        return panel
    end}
    include("cl_data.lua"); include("cl_message.lua")
    selectedLocale = "pt-BR"
    readTable = payload
    for _, kind in ipairs({"popup", "chat", "console", "notify"}) do
        readString = kind
        receivers.SendLocalizedMessage()
    end
    assert(popup == "Você comprou: 'Colete'." and chatText == popup and consoleText == popup)
    assert(captured.SetText == popup and captured.SetLife == 7 and captured.SetColor.g == 20)
    readString = "literal %s"; receivers.SendPopupMessage()
    assert(popup == "literal %s")
    readString, readTable = "popup", {Phrase=false}
    receivers.SendLocalizedMessage()
    assert(popup == "literal %s")
`));

test("client validates localized payloads and tolerates bad translation formats", () => run(nativeLanguage + `
    include("cl_data.lua")
    for _, value in ipairs({false, "text", {}, {Phrase=false}, {Phrase="other.key"},
        {Phrase="zombieplague.roundsleft", Arguments=false},
        {Phrase="zombieplague.roundsleft", Arguments={true}},
        {Phrase="zombieplague.roundsleft", Arguments={[2]=5}},
        {Phrase="zombieplague.roundsleft", Arguments={0/0}}}) do
        assert(ZPClientData.LocalizedText(value) == nil)
    end
    local deep = {Phrase="zombieplague.extraitembought"}
    local current = deep
    for i=1,6 do current.Arguments={{Phrase="zombieplague.extraitembought"}}; current=current.Arguments[1] end
    assert(ZPClientData.LocalizedText(deep) == nil)
    local tooMany = {Phrase="zombieplague.roundsleft", Arguments={}}
    for i=1,9 do tooMany.Arguments[i]=i end
    assert(ZPClientData.LocalizedText(tooMany) == nil)
    translations.en["zombieplague.badformat"] = "%q %d"
    assert(ZPClientData.LocalizedText({Phrase="zombieplague.badformat", Arguments={"name"}}) == "%q %d")
`));

test("class display uses native lookup on each call after a language change", () => run(nativeLanguage + `
    local meta = {}
    function FindMetaTable() return meta end
    include("cl_player.lua")
    local ply = setmetatable({}, {__index=meta})
    function ply:IsZombie() return false end
    function ply:IsHuman() return true end
    ply:SetHumanClass("HumanDefaultClassName")
    assert(ply:GetZPClass() == "Human")
    selectedLocale = "pt-BR"
    assert(ply:GetZPClass() == "Humano")
    ply:SetNemesis(true)
    assert(ply:GetZPClass() == language.GetPhrase("zombieplague.nemesis"))
`));

test("infection gameplay sends phrase keys and literal player names without accessing a dictionary", () => run(nativeLanguage + `
    include("sv_message.lua")
    include("cl_data.lua")
    include("sv_infectionmanager.lua")
    local packets = {}
    net.WriteColor = function(color) sent[#sent+1]=color end
    net.WriteInt = function(value) sent[#sent+1]=value end
    net.Send = function(ply) packets[#packets+1]={player=ply, text=sent[3]} end
    local target = {Name=function() return "José" end, Infect=function() end, AddDeaths=function() end,
        SteamID64=function() return "76561198000000001" end}
    local attacker = {Name=function() return "Alice%" end, GetZombieClass=function() return {} end,
        AddFrags=function() end, AddPoints=function() end}
    player = {GetAll=function() return {target,attacker} end}
    RoundManager = {IsRealisticMod=function() return false end, LastHuman=function() return false end}
    hook.Call = function() end
    InfectionManager:Infect(target, attacker)
    assert(#packets==2 and packets[1].player==target and packets[2].player==attacker)
    local text = packets[1].text
    assert(text.Phrase=="zombieplague.noticeinfect" and text.Arguments[1]=="José" and text.Arguments[2]=="Alice%")
    local english = ZPClientData.LocalizedText(text)
    selectedLocale = "pt-BR"
    assert(ZPClientData.LocalizedText(text) ~= english and not Dictionary)
`));
