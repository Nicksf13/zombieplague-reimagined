import assert from "node:assert/strict";
import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
const setup = botSetup + `
local function encode(value)
    if type(value)=="string" then return string.format("%q",value) end
    if type(value)~="table" then return tostring(value) end
    local list={}
    if #value>0 then
        for _,v in ipairs(value) do list[#list+1]=encode(v) end
        return "["..table.concat(list,",").."]"
    end
    for k,v in pairs(value) do list[#list+1]=encode(k)..":"..encode(v) end
    return "{"..table.concat(list,",").."}"
end
util.TableToJSON=encode
ents={GetAll=function() return {} end}
local human=newPlayer(TEAM_HUMANS,30,false)
local zombie=newPlayer(TEAM_ZOMBIES,0)
function human:UserID() return 10 end
function zombie:UserID() return 11 end
local snapshots=0
local source={Snapshot=function() snapshots=snapshots+1; return {{ID=1,Entity=zombie:EntIndex(),Input={Gate="plan_expired"}}} end,
    ManagedPlayers=function() return {zombie} end}
local recording=construct(include("sv_bot_recording.lua").BotRecording,source,"test-session","test-code")
local function output()
    assert(recording:Save())
    result=files[recording.Path:sub(6)]
end
`;

test("recorder is off by default, exports all players and detached bot evidence as valid JSON", () => {
    const data=JSON.parse(run(setup + `
        recording:Tick(); assert(snapshots==0 and not recording:Save())
        recording:SetEnabled(true); recording:Tick()
        human.position.x=90; now=10.5; recording:Tick()
        output()
    `,"result"));
    assert.equal(data.Version,1); assert.equal(data.Code,"test-code");
    assert.equal(data.Frames.length,2); assert.equal(data.Frames[0].Players.length,2);
    assert.equal(data.Frames[0].Players[0].Position[0],30);
    assert.equal(data.Frames[1].Players[0].Position[0],90);
    assert.equal(data.Frames[0].Bots[0].Input.Gate,"plan_expired");
    assert.equal(data.Frames[0].Players[0].SteamID64,undefined);
});

test("recording keeps a bounded recent window, stopping preserves it and restarting clears it", () => {
    const data=JSON.parse(run(setup + `
        recording:SetEnabled(true)
        for i=0,620 do now=10+i*0.5; recording:Tick() end
        assert(recording:Seconds()<=300)
        recording:SetEnabled(false); local count=snapshots; now=400; recording:Tick(); assert(snapshots==count)
        output()
    `,"result"));
    assert.equal(data.Frames.length,600); assert.equal(data.Enabled,false);
    assert(data.DroppedFrames>0); assert(data.Frames[0].Time>10);
    run(setup + `recording:SetEnabled(true); recording:Tick(); recording:SetEnabled(false); recording:SetEnabled(true); assert(not recording:Save())`);
});

test("saving continues capture, preserves earlier reports, and detects incomplete writes", () => run(setup + `
    recording:SetEnabled(true); recording:Tick(); assert(recording:Save()); local first=recording.Path
    now=10.5; recording:Tick(); assert(recording:Save() and recording.Path~=first and recording.Enabled)
    assert(files[first:sub(6)])
    local saved=recording.Path; failWrite=true
    assert(not recording:Save() and recording.Path==saved)
`));

test("byte limits evict old frames and oversized snapshots are reported as dropped", () => run(setup + `
    local original=util.TableToJSON
    util.TableToJSON=function(value)
        if value.Time then return "{}"..string.rep(" ",260000) end
        return original(value)
    end
    recording:SetEnabled(true)
    for i=0,39 do now=10+i*0.5; recording:Tick() end
    output(); assert(#result<8400000)
    assert(result:find('"DroppedFrames":8',1,true))
    util.TableToJSON=function(value) if value.Time then return string.rep(" ",262145) end; return original(value) end
    now=31; recording:Tick(); output(); assert(result:find('"DroppedFrames":9',1,true))
`));

test("nearby solid props include model and bounds while distant and nonsolid decoration are excluded", () => {
    const data=JSON.parse(run(setup + `
        local function prop(id,x,solid)
            return {EntIndex=function() return id end,IsPlayer=function() return false end,GetSolid=function() return solid end,
                GetPos=function() return Vector(x,0,0) end,WorldSpaceCenter=function() return Vector(x,0,30) end,
                GetAngles=function() return Angle(0,45,0) end,OBBMins=function() return Vector(-20,-20,0) end,
                OBBMaxs=function() return Vector(20,20,60) end,GetClass=function() return "prop_physics" end,
                GetModel=function() return "models/props/crate.mdl" end,GetCollisionGroup=function() return 0 end}
        end
        ents.GetAll=function() return {prop(30,40,6),prop(31,10000,6),prop(32,0,0)} end
        recording:SetEnabled(true); recording:Tick(); output()
    `,"result"));
    const obstacles=data.Frames[0].Obstacles;
    assert.equal(obstacles.Rows.length,1); assert.equal(obstacles.Rows[0].Entity,30);
    assert.equal(obstacles.Rows[0].Model,"models/props/crate.mdl");
    assert.deepEqual(obstacles.Rows[0].Maxs,[20,20,60]);
});

test("server validates permissions, exact packet length, request version and save rate", () => run(setup + `
    local service=construct(include("sv_bot_recording_service.lua").BotRecordingService,recording)
    net.WriteUInt=function(value) sent[#sent+1]=value end
    local reads=0; local queue={1,1,1}
    net.ReadUInt=function() reads=reads+1; return table.remove(queue,1) end
    service:Receive(41,human); assert(reads==0 and not recording.Enabled)
    human.admin=true; service:Receive(40,human); assert(reads==0)
    service:Receive(41,human); assert(recording.Enabled and sent[1]=="ZPBotRecordingReply")
    queue={1,2,2}; service:Receive(41,human); assert(recording.Enabled)
    now=11; queue={9,2,2}; service:Receive(41,human); assert(recording.Enabled)
    now=12; queue={1,3,2}; service:Receive(41,human); assert(not recording.Enabled)
    now=13; recording:SetEnabled(true); recording:Tick(); queue={1,4,3}; service:Receive(41,human)
    local first=recording.Path; assert(first~="")
    now=14; queue={1,5,3}; service:Receive(41,human); assert(recording.Path==first and sent[5]==2)
`));

test("motor exposes attack eligibility without reporting an issued swing as a hit", () => run(botSetup + `
    local motor=include("sv_bot_motor.lua")
    local bot=newPlayer(TEAM_ZOMBIES,0); bot.weapon=newWeapon(-1); bot.weapon.HitDistance=40
    local human=newPlayer(TEAM_HUMANS,50,false)
    bot.angles=Angle(math.deg(math.atan(24/50)),0,0)
    local plan={Senses={Visible=true,Target=human,EnemyPosition=human:GetPos(),AimPosition=human:WorldSpaceCenter()},
        Steering={Jump=false,Duck=false},Action="attack",Updated=now,ReadyAt=now+1}
    local observed
    motor.apply(bot,command(),plan,1,true,function(value) observed=value end)
    assert(observed.AttackGate=="reaction_wait" and observed.Commanded.Keys & IN_ATTACK==0)
    plan.ReadyAt=0; wall=true
    motor.apply(bot,command(),plan,1,true,function(value) observed=value end)
    assert(observed.AttackGate=="line_of_fire_blocked" and observed.Commanded.Keys & IN_ATTACK==0)
    wall=false
    motor.apply(bot,command(),plan,1,true,function(value) observed=value end)
    assert(observed.AttackGate=="issued" and observed.Commanded.Keys & IN_ATTACK~=0)
    assert(human:Health()==100)
`));
