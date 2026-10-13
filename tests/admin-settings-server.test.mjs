import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
local now, callbacks, convars, writes, reloads, scheduled = 10, {}, {}, {}, {}, {}
function CurTime() return now end
include("sh_admin_config.lua")
for _, entry in ipairs(ZPAdminConfig.Entries) do
    local convar={value=entry.Default}
    function convar:GetBool() return self.value~="0" end
    function convar:GetString() return self.value end
    function convar:SetString(value)
        local previous=self.value
        self.value=value
        writes[#writes+1]=entry.Name
        if previous~=value and callbacks[entry.Name] then callbacks[entry.Name](entry.Name,previous,value) end
    end
    convars[entry.Name]=convar
end
function GetConVar(name) return convars[name] end
cvars.AddChangeCallback=function(name,callback) callbacks[name]=callback end
timer.Simple=function(delay,callback) scheduled[#scheduled+1]=callback end
function RunConsoleCommand(command,map) reloads[#reloads+1]={command,map} end
game={GetMap=function() return "gm_construct" end}
net.WriteUInt=function(value) sent[#sent+1]=value end
local uints, strings, reads = {}, {}, 0
net.ReadUInt=function() reads=reads+1; return table.remove(uints,1) end
net.ReadString=function() reads=reads+1; return table.remove(strings,1) end
local ply={admin=true}
function ply:IsAdmin() return self.admin end
function ply:SteamID64() return "76561198000000001" end
include("sv_admin_settings.lua")
local id=0
local function request(action,revision,values,token,length)
    now=now+0.3; id=id+1
    uints={1,action,id,revision,token}; strings={table.unpack(values or {})}
    receivers.ZPAdminSettingsRequest(length or (action==0 and 41 or action==1 and 1000 or 103),ply)
    return sent
end
local function catalog() return request(0) end
local function defaults() return {"1","1","0","","c","100"} end
`;

test("admin settings reject unauthorized and oversized requests before reading data", () => run(setup + `
    ply.admin=false
    for action=0,2 do request(action,1,defaults(),123) end
    assert(reads==0 and #writes==0 and #reloads==0 and #scheduled==0 and #sent==0)
    ply.admin=true
    request(1,1,defaults(),0,2049); request(0,1,nil,0,40)
    assert(reads==0)
    local reply=catalog()
    assert(reply[1]=="ZPAdminSettingsReply" and reply[3]==0 and reply[4]==1)
    assert(reply[5]==false and reply[6]==0 and reply[7]=="1" and reply[12]=="100")
    assert(reply.recipient==ply)
`));

test("the whole admin batch is validated before writes and only allowed values reach convars", () => run(setup + `
    local revision=catalog()[4]
    for _,bad in ipairs({"101","-1","NaN","inf","1e2","20;quit",string.rep("1",129)}) do
        local values=defaults(); values[6]=bad
        assert(request(1,revision,values)[3]==2 and #writes==0)
    end
    for _,bad in ipairs({"a","n","bc",""}) do
        local values=defaults(); values[5]=bad
        assert(request(1,revision,values)[3]==2 and #writes==0)
    end
    for _,bad in ipairs({"sky;quit","../cfg/server","sky name","sky\\\\name"}) do
        local values=defaults(); values[4]=bad
        assert(request(1,revision,values)[3]==2 and #writes==0)
    end
    local values=defaults(); values[2]="2"
    assert(request(1,revision,values)[3]==2 and #writes==0)
    values={"1","0","1","sky_borealis01","b"," 10.5 "}
    local reply=request(1,revision,values)
    assert(reply[3]==1 and reply[5]==false and #writes==6)
    assert(convars.zp_map_night:GetString()=="0" and convars.zp_map_night_exposure:GetString()=="10.5")
    assert(#scheduled==0 and #reloads==0)
    -- Changes by console or another admin invalidate an old form.
    local before=#writes
    assert(request(1,revision,defaults())[3]==2 and #writes==before)
    local fresh=catalog()[4]
    convars.zp_map_skybox:SetString("sky_day01_01")
    before=#writes
    assert(request(1,fresh,defaults())[3]==2 and #writes==before)
`));

test("only audio changes require reload and confirmation tokens expire and cannot be replayed", () => run(setup + `
    local revision=catalog()[4]
    local values=defaults(); values[1]="0"
    local saved=request(1,revision,values)
    assert(saved[3]==1 and saved[5]==true and saved[6]>0)
    local token=saved[6]; revision=saved[4]
    assert(#scheduled==0)
    request(2,revision,nil,token+1); assert(#scheduled==0)
    now=now+61; request(2,revision,nil,token); assert(#scheduled==0)
    local fresh=catalog(); assert(fresh[5]==true and fresh[6]==0)
    request(2,fresh[4],nil,token); assert(#scheduled==0)
    values[5]="d"; fresh=request(1,fresh[4],values)
    token=fresh[6]; revision=fresh[4]
    local other={IsAdmin=function() return true end,SteamID64=function() return "76561198000000002" end}
    uints={1,2,999,revision,token}
    receivers.ZPAdminSettingsRequest(103,other); assert(#scheduled==0)
    request(2,revision,nil,token)
    assert(#scheduled==1 and #reloads==0)
    request(2,revision,nil,token); assert(#scheduled==1)
    scheduled[1]()
    assert(#reloads==1 and reloads[1][1]=="changelevel" and reloads[1][2]=="gm_construct")
`));

test("reverting audio clears pending reload and permissions are rechecked before reloading", () => run(setup + `
    local values=defaults(); values[1]="0"
    local saved=request(1,catalog()[4],values)
    local restored=request(1,saved[4],defaults())
    assert(restored[5]==false and restored[6]==0)
    request(2,restored[4],nil,saved[6]); assert(#scheduled==0)
    saved=request(1,restored[4],values)
    request(2,saved[4],nil,saved[6]); assert(#scheduled==1)
    ply.admin=false; scheduled[1](); assert(#reloads==0)
    ply.admin=true; local fresh=catalog()
    values[5]="e"; fresh=request(1,fresh[4],values)
    hooks.PlayerDisconnected.ZPAdminSettings(ply)
    request(2,fresh[4],nil,fresh[6]); assert(#scheduled==1)
`));

test("admin requests are rate limited and malformed headers do not mutate configuration", () => run(setup + `
    catalog()
    uints={1,1,999,1}; strings=defaults()
    receivers.ZPAdminSettingsRequest(1000,ply)
    assert(sent[3]==2 and #writes==0)
    now=now+1; uints={2,1,999,1}; strings=defaults()
    receivers.ZPAdminSettingsRequest(1000,ply)
    assert(#writes==0)
    uints={1,3,999,1}; receivers.ZPAdminSettingsRequest(1000,ply)
    uints={1,1,0,1}; receivers.ZPAdminSettingsRequest(1000,ply)
    assert(#writes==0 and #scheduled==0)
`));
