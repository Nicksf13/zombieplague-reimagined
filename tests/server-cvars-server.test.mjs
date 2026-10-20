import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
local now,callbacks,convars,writes=10,{},{},{}
local roundDefinition={MinPlayers=2}
RoundManager={GetRounds=function() return {SimpleRound=roundDefinition} end}
local scheduled,reloads={},{}
timer.Simple=function(delay,callback) scheduled[#scheduled+1]=callback end
game={GetMap=function() return "gm_construct" end}
function RunConsoleCommand(command,map) reloads[#reloads+1]={command,map} end
function CurTime() return now end
include("sh_admin_config.lua"); include("sh_server_cvars.lua")
ConvarManager.Convars={}
for _,entry in ipairs(ZPServerCvars.Entries) do
    ConvarManager.Convars[entry.Name]=entry.Default
    local convar={value=entry.Default}
    function convar:GetString() return self.value end
    function convar:SetString(value)
        local previous=self.value; self.value=value; writes[#writes+1]={entry.Name,value}
        if previous~=value and callbacks[entry.Name] then callbacks[entry.Name](entry.Name,previous,value) end
    end
    convars[entry.Name]=convar
end
function GetConVar(name) return convars[name] end
cvars.AddChangeCallback=function(name,callback) callbacks[name]=callback end
net.WriteUInt=function(value) sent[#sent+1]=value end
local uints,strings,reads={},{},0
net.ReadUInt=function() reads=reads+1; return table.remove(uints,1) end
net.ReadString=function() reads=reads+1; return table.remove(strings,1) end
local ply={admin=true,superadmin=true}
function ply:IsAdmin() return self.admin end
function ply:IsSuperAdmin() return self.superadmin end
function ply:SteamID64() return "76561198000000001" end
include("sv_server_cvars.lua")
local id=0
local function category(id)
    for index,value in ipairs(ZPServerCvars.Categories) do if value.ID==id then return index-1 end end
    error(id)
end
local function field(group,name)
    for index,value in ipairs(ZPServerCvars.ForCategory(group)) do if value.Name==name then return index-1 end end
    error(name)
end
local function request(group,changes,revision,length,version)
    now=now+0.3; id=id+1
    uints={version or 2,changes and 1 or 0,id,category(group)}; strings={}
    if changes then
        uints[#uints+1]=revision or 1; uints[#uints+1]=#changes
        for _,change in ipairs(changes) do
            uints[#uints+1]=type(change[1])=="number" and change[1] or field(group,change[1])
            strings[#strings+1]=change[2]
        end
    end
    receivers.ZPServerCvarsRequest(length or (changes and 2000 or 49),ply)
    return sent
end
local function confirm(group,revision,token,player,length)
    now=now+0.3; id=id+1; uints={2,2,id,category(group),revision,token}
    receivers.ZPServerCvarsRequest(length or 111,player or ply)
end
`;

test("administrators can change radar activation without reload and invalid modes cannot be saved", () => run(setup + `
    ply.superadmin=false
    assert(request("radar",{{"zp_radar_mode","1"}})[5]==1)
    assert(convars.zp_radar_mode.value=="1" and #writes==1)
    local revision=request("radar")[6]
    assert(request("radar",{{"zp_radar_mode","3"}},revision)[5]==2)
    assert(convars.zp_radar_mode.value=="1" and #writes==1)
`));

test("administrators can toggle allied radar contacts live using the audited settings menu", () => run(setup + `
    ply.superadmin=false
    assert(convars.zp_radar_allies.value=="1")
    assert(request("radar",{{"zp_radar_allies","0"}})[5]==1)
    assert(convars.zp_radar_allies.value=="0" and #writes==1 and #reloads==0)
    local revision=request("radar")[6]
    assert(request("radar",{{"zp_radar_allies","2"}},revision)[5]==2)
    assert(convars.zp_radar_allies.value=="0" and #writes==1)
`));

test("server cvar RPC authenticates before reads and restricts bot configuration to superadmins", () => run(setup + `
    ply.admin=false; request("movement"); request("movement",{{"zp_run_should_drain","1"}})
    assert(reads==0 and #writes==0 and #sent==0)
    ply.admin=true; request("movement",nil,nil,32769); request("movement",nil,nil,48)
    assert(reads==0)
    ply.superadmin=false
    assert(request("bots")[5]==0)
    assert(request("bots",{{"zp_bot_learning","0"}})[5]==2 and #writes==0)
    assert(request("statistics",{{"zp_bot_stats_scenario","test"}})[5]==2 and #writes==0)
    request("movement")
    assert(request("movement",{{"zp_run_should_drain","1"}})[5]==1 and #writes==1)
`));

test("a category save validates the whole batch and writes only changed allowlisted fields", () => run(setup + `
    local revision=request("movement")[6]
    for _,bad in ipairs({"2","true","1;quit",string.rep("a",129)}) do
        assert(request("movement",{{"zp_realistic_mode","1"},{"zp_run_should_drain",bad}},revision)[5]==2)
        assert(#writes==0 and convars.zp_realistic_mode.value=="0")
    end
    assert(request("movement",{{"zp_run_should_drain","1"},{"zp_run_should_drain","0"}},revision)[5]==2)
    assert(request("movement",{{255,"1"}},revision)[5]==2 and #writes==0)
    local saved=request("movement",{{"zp_realistic_mode","0"},{"zp_run_should_drain","1"}},revision)
    assert(saved[5]==1 and #writes==1 and writes[1][1]=="zp_run_should_drain")
    assert(saved[6]>revision and saved.recipient==ply)
    assert(request("movement",{{"zp_run_should_drain","0"}},revision)[5]==2 and #writes==1)
`));

test("external changes invalidate snapshots and unrelated out-of-range values are preserved", () => run(setup + `
    local revision=request("movement")[6]
    convars.zp_run_drain:SetString("2000000000")
    local before=#writes
    assert(request("movement",{{"zp_run_should_drain","1"}},revision)[5]==2 and #writes==before)
    local reply=request("movement"); local actual=reply[9+field("movement","zp_run_drain")*2]
    assert(actual=="2000000000")
    assert(request("movement",{{"zp_run_should_drain","1"}},reply[6])[5]==1)
    assert(convars.zp_run_drain.value=="2000000000" and #writes==before+1)
`));

test("missing and foreign registrations cannot be edited while direct built-ins are available", () => run(setup + `
    ConvarManager.Convars.zp_run_should_drain=nil
    local reply=request("movement")
    assert(reply[8+field("movement","zp_run_should_drain")*2]==false)
    assert(request("movement",{{"zp_run_should_drain","1"}},reply[6])[5]==2 and #writes==0)
    ConvarManager.Convars.zp_givetake_ammopacks_allowed=nil
    request("ammopacks")
    assert(request("ammopacks",{{"zp_givetake_ammopacks_allowed","0"}})[5]==1 and #writes==1)
    convars.zp_health_regen=nil
    local snapshot=request("zombies")
    assert(snapshot[8+field("zombies","zp_health_regen")*2]==false)
`));

test("rate limits, malformed versions, environment routing and invalid categories do not write", () => run(setup + `
    request("movement")
    uints={1,1,999,category("movement"),1,1,0}; strings={"1"}
    receivers.ZPServerCvarsRequest(2000,ply); assert(sent[5]==2 and #writes==0)
    for _,header in ipairs({{3,1,999,1},{1,3,999,1},{1,1,0,1},{1,1,999,255},{1,1,999,0}}) do
        now=now+1; uints=header; strings={"1"}; receivers.ZPServerCvarsRequest(2000,ply)
    end
    assert(#writes==0)
    hooks.PlayerDisconnected.ZPServerCvars(ply)
    assert(request("movement")[5]==0)
`));

test("cached round settings require an explicit reload and reading never authorizes it", () => run(setup + `
    local catalog=request("rounds"); assert(catalog[#catalog-1]==false and catalog[#catalog]==0)
    local saved=request("rounds",{{"zp_min_players","3"}},catalog[6])
    assert(saved[#saved-1]==true and saved[#saved]>0 and #scheduled==0 and #reloads==0)
    local token,revision=saved[#saved],saved[6]
    local read=request("rounds"); assert(read[#read-1]==true and read[#read]==0)
    confirm("rounds",revision,token); assert(#scheduled==0)
    saved=request("rounds",{{"zp_round_time","301"}},revision)
    token,revision=saved[#saved],saved[6]
    confirm("rounds",revision,token); assert(#scheduled==1 and #reloads==0)
    confirm("rounds",revision,token); assert(#scheduled==1)
    scheduled[1](); assert(#reloads==1 and reloads[1][1]=="changelevel" and reloads[1][2]=="gm_construct")
`));

test("the actual default round caches the minimum until its registration runs again", () => run(setup + `
    local definitions={}
    RoundManager.GetRounds=function() return definitions end
    function RoundManager:AddRoundType(id,definition) definitions[id]=definition end
    cvars.Number=function(name,fallback) return convars[name] and tonumber(convars[name].value) or fallback end
    include("sv_round_defaults.lua"); RoundManager:AddDefaultRounds()
    assert(definitions.SimpleRound.MinPlayers==2)
    local saved=request("rounds",{{"zp_min_players","4"}},request("rounds")[6])
    assert(saved[#saved-1]==true and definitions.SimpleRound.MinPlayers==2)
    -- Simulate only the registration step of a reload, not a running GMod map.
    RoundManager:AddDefaultRounds()
    assert(definitions.SimpleRound.MinPlayers==4)
    local snapshot=request("rounds"); assert(snapshot[#snapshot-1]==false)
`));

test("reverting cached values clears reload need while live, event and spawn edits do not request reload", () => run(setup + `
    for _,edit in ipairs({{"movement","zp_zombie_should_run","0"},{"movement","zp_run_drain","1"},
        {"zombies","zp_first_zombie_reward_health","300"},{"rounds","zp_round_time","400"}}) do
        local revision=request(edit[1])[6]
        local saved=request(edit[1],{{edit[2],edit[3]}},revision)
        assert(saved[5]==1 and saved[#saved-1]==false and saved[#saved]==0)
    end
    local revision=request("rounds")[6]
    local saved=request("rounds",{{"zp_min_players","3"}},revision)
    local token=saved[#saved]; revision=saved[6]
    saved=request("rounds",{{"zp_min_players","2"}},revision)
    assert(saved[#saved-1]==false and saved[#saved]==0)
    confirm("rounds",saved[6],token); assert(#scheduled==0)
    -- The baseline is the actual registered round, including startup ordering differences.
    roundDefinition.MinPlayers=4
    local read=request("rounds"); assert(read[#read-1]==true and read[#read]==0)
    saved=request("rounds",{{"zp_min_players","4.0"}},read[6])
    assert(saved[#saved-1]==false and saved[#saved]==0)
`));

test("reload tokens reject wrong players, categories, expired receipts and concurrent edits", () => run(setup + `
    local function saved()
        local revision=request("rounds")[6]
        local result=request("rounds",{{"zp_min_players","3"}},revision)
        return result[6],result[#result]
    end
    local revision,token=saved()
    local other={IsAdmin=function() return true end,IsSuperAdmin=function() return true end,SteamID64=function() return "other" end}
    confirm("rounds",revision,token,other); assert(#scheduled==0)
    confirm("movement",revision,token); assert(#scheduled==0)
    revision,token=saved(); now=now+61
    confirm("rounds",revision,token); assert(#scheduled==0)
    revision,token=saved(); convars.zp_round_time:SetString("302")
    confirm("rounds",revision,token); assert(#scheduled==0)
    revision,token=saved()
    confirm("rounds",revision,token,nil,110); assert(#scheduled==0)
    revision,token=saved(); ply.admin=false
    confirm("rounds",revision,token); assert(#scheduled==0)
`));

test("reload rechecks authorization and revision when the deferred command executes", () => run(setup + `
    for _,reason in ipairs({"permission","disconnect","revision","revert"}) do
        local revision=request("rounds")[6]
        local saved=request("rounds",{{"zp_min_players","3"}},revision)
        confirm("rounds",saved[6],saved[#saved]); assert(#scheduled>0)
        if reason=="permission" then ply.admin=false
        elseif reason=="disconnect" then hooks.PlayerDisconnected.ZPServerCvars(ply)
        elseif reason=="revision" then convars.zp_round_time:SetString("402")
        else convars.zp_min_players:SetString("2") end
        scheduled[#scheduled](); assert(#reloads==0)
        ply.admin=true
    end
`));

test("version one category clients retain their original response layout and cannot request reload", () => run(setup + `
    local read=request("rounds",nil,nil,nil,1)
    assert(read[2]==1 and #read==7+2*#ZPServerCvars.ForCategory("rounds"))
    local saved=request("rounds",{{"zp_min_players","3"}},read[6],nil,1)
    assert(saved[2]==1 and saved[5]==1 and #scheduled==0)
    now=now+1; uints={1,2,999,category("rounds"),saved[6],1}
    receivers.ZPServerCvarsRequest(111,ply); assert(#scheduled==0)
`));
