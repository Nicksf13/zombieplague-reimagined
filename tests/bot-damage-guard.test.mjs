import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";
const setup = botSetup + `
local Guard=include("sv_bot_damage_guard.lua").BotDamageGuard
local guard=construct(Guard,1); local bot=newPlayer(TEAM_ZOMBIES,0)
local attacker=Vector(200,0,0)
`;
test("heavy applied damage causes a short face turn with cooldown and no permanent defensive pose", () => run(setup + `
    guard:Damage(10,1000,attacker,now); assert(not guard:Look(bot,now))
    guard:Damage(70,1000,attacker,now+0.1); local look=guard:Look(bot,now+0.1)
    assert(look and look.x<0 and look.z<bot:EyePos().z)
    guard:Damage(100,1000,attacker,now+0.7); assert(not guard:Look(bot,now+0.8))
    guard:Damage(100,1000,attacker,now+2.2); assert(guard:Look(bot,now+2.2))
    guard:Reset(); assert(not guard:Look(bot,now+2.2))
`));
test("defensive facing preserves world movement, uses gradual view turning and suppresses firing away from the target", () => run(setup + `
    local motor=include("sv_bot_motor.lua")
    local target=newPlayer(TEAM_HUMANS,200,false)
    local plan={Senses={Visible=true,Allies=0,Enemies=1,Target=target,AimPosition=target:WorldSpaceCenter()},
        Steering={Position=Vector(100,0,0),Jump=false,Duck=false,Use=false,Stuck=false},Action="attack",Updated=now,ReadyAt=0,DefensiveLook=Vector(-100,-100,0)}
    local cmd=command(); motor.apply(bot,cmd,plan,1,true)
    assert(math.abs(bot:EyeAngles().y)<=11.01 and cmd.buttons & IN_ATTACK==0)
    local yaw=math.rad(bot:EyeAngles().y)
    assert(cmd.forward*math.cos(yaw)+cmd.side*math.sin(yaw)>0)
    assert(math.abs(cmd.forward*math.sin(yaw)-cmd.side*math.cos(yaw))<0.001)
`));
