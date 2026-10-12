import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { books, locales, nativeLanguage } from "./helpers/native-localization.mjs";

test("all eight native catalogs preserve translations, extra-item phrases and format parameters", () => {
    for (const locale of locales) {
        assert(Object.keys(books[locale]).length >= 135, locale);
        for (const key of Object.keys(books[locale])) assert(key in books.en, key);
        for (const name of ["extraitemex41name", "extraitemmilkormk1name", "extraitemnervegasname",
            "extraitemorbitalstrikename", "extraitemrpg7name"]) {
            assert.equal(typeof books[locale][`zombieplague.${name}`], "string", `${locale}/${name}`);
        }
        for (const [key, value] of Object.entries(books[locale])) {
            assert.deepEqual(value.match(/%[sdif]/g) ?? [], books.en[key].match(/%[sdif]/g) ?? [], `${locale}/${key}`);
        }
    }
    assert.equal(books["pt-BR"]["zombieplague.extraitembought"], "Você comprou: '%s'.");
    assert.match(books.ru["zombieplague.humandefaultclassname"], /[А-Яа-я]/);
    assert.match(books["zh-TW"]["zombieplague.humandefaultclassname"], /[\u3400-\u9fff]/);
    const manifest = JSON.parse(readFileSync(new URL("../migration.json", import.meta.url), "utf8"));
    assert(!manifest.files.some(path => /\/(?:sv_language|cl_language)$|\/languages\//.test(path)));
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
    assert(count == 8 and resources["resource/localization/pt-BR/zombieplague.properties"])
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
