import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { statisticsSetup } from "./helpers/player-statistics.mjs";

const setup = statisticsSetup + `
local uints,strings={},{}
local reads=0
net.ReadUInt=function() reads=reads+1; return table.remove(uints,1) end
net.ReadString=function() reads=reads+1; return table.remove(strings,1) end
local function request(map,role,metric,target,length)
    uints={1,7,role or 0,metric or 0}; strings={map or "",target or ""}
    receivers.ZPStatisticsRequest(length or 200,human)
end
`;

test("public endpoint validates filters, throttles requests and blocks history while disabled", () => run(setup + `
    start(); request(); assert(sent[1]=="ZPStatisticsReply" and sent[2].Status=="ready")
    assert(sent[2].Report.Profile.SteamID64==human.id and schema.reply(sent[2]))
    local before=reads; request(); assert(reads==before)
    advance(1); request("../invalid"); assert(sent[2].Status=="ready")
    advance(1); request("",0,31); assert(sent[2].ID==7)
    advance(1); enabled=false; callbacks.zp_statistics_enabled(); request()
    assert(sent[2].Status=="disabled" and not sent[2].Report)
    before=reads; advance(1); request("",0,0,"",2049); assert(reads==before)
`));

test("pending asynchronous history returns loading and never exposes partial totals", () => run(setup + `
    local loaded
    stats:SetStorage({Load=function(self,done) loaded=done end,Save=function() end})
    start(); request(); assert(sent[2].Status=="loading" and not sent[2].Report)
    loaded({}); advance(1); request(); assert(sent[2].Status=="ready")
`));

test("version two filters weapons while version one retains combined totals and replies stay bounded", () => run(setup + `
    start(); include("sv_infectionmanager.lua")
    zombie.weapon=weapon("zp_weapon_fists")
    InfectionManager:Infect(human,zombie)
    human=zombie
    uints={2,8,1,7}; strings={"","","zp_weapon_fists"}
    receivers.ZPStatisticsRequest(300,human)
    assert(sent[2].Status=="ready" and sent[2].Report.SelfValue==1)
    assert(sent[2].Report.WeaponValues.Infections==1 and next(sent[2].Report.Profile.Weapons)==nil)
    assert(schema.reply(sent[2]))
    advance(1); uints={1,9,1,7}; strings={"",""}
    receivers.ZPStatisticsRequest(200,human)
    assert(sent[2].Report.SelfValue==1)
    advance(1); uints={2,10,1,7}; strings={"","","../bad"}
    receivers.ZPStatisticsRequest(300,human); assert(sent[2].ID==9)
    advance(1); uints={2,11,1,4}; strings={"","","zp_weapon_fists"}
    receivers.ZPStatisticsRequest(300,human); assert(sent[2].ID==9)
`));

test("the public weapon ranking returns effective fractional damage and armor without requiring a kill", () => run(setup + `
    start(); human.weapon=weapon("weapon_ar2"); zombie.armor=10
    damage(zombie,human,15.5,5.25)
    uints={2,8,0,3}; strings={"","","weapon_ar2"}
    receivers.ZPStatisticsRequest(300,human)
    assert(sent[2].Status=="ready" and sent[2].Report.SelfValue==15.5)
    local data=schema.reply(sent[2])
    assert(data.Report.WeaponValues.DamageDealt==15.5 and data.Report.WeaponValues.ArmorDamageDealt==5.25)
    assert(data.Report.Weapons[1].ID=="weapon_ar2")
    advance(1); uints={2,9,0,5}; strings={"","","weapon_ar2"}
    receivers.ZPStatisticsRequest(300,human)
    assert(sent[2].Report.SelfValue==5.25)
`));

test("version three lists bots and selects their profiles while legacy versions retain human-only responses", () => run(setup + `
    local bot=newPlayer("0",TEAM_HUMANS); bot.bot=true; bot.name="Ranked bot"
    start(); stats.Tracking:Add(bot,"Kills",3)
    local id=stats:GetPlayerID(bot)
    uints={3,8,0,0}; strings={"","",""}; receivers.ZPStatisticsRequest(200,human)
    local found=false
    for _,entry in ipairs(sent[2].Report.Leaders) do if entry.ID==id then
        found=true; assert(entry.Bot and entry.SteamID64=="" and entry.Value==3)
    end end
    assert(found and schema.reply(sent[2]))
    advance(1); uints={3,9,0,0}; strings={"",id,""}; receivers.ZPStatisticsRequest(1000,human)
    assert(sent[2].Report.Profile.ID==id and sent[2].Report.Profile.Bot)
    advance(1); uints={2,10,0,0}; strings={"","",""}; receivers.ZPStatisticsRequest(200,human)
    for _,entry in ipairs(sent[2].Report.Leaders) do assert(not entry.Bot and schema.steamID(entry.SteamID64)) end
    advance(1); uints={3,11,0,0}; strings={"","bot:invalid",""}; receivers.ZPStatisticsRequest(200,human)
    assert(sent[2].ID==10)
`));
