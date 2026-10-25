import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local bots=include("sv_bots.lua").bots
local host=newPlayer(TEAM_HUMANS,-4000,false); host.admin=true
`;

test("adaptive commands check permissions, arguments, capacity and missing navigation; idle bots remain separate", () => run(setup + `
    consoleCommands.zp_addaibot(host,"zp_addaibot",{"4"})
    assert(#players==5 and messages[#messages].Phrase=="zombieplague.aibotcreated")
    assert(messages[#messages].Arguments[1]==4 and messages[#messages-1].Phrase=="zombieplague.aibotnavmissing")
    local profiles={}
    for i=2,5 do
        local status=bots:GetStatus(players[i]); assert(status and not profiles[status.Profile])
        profiles[status.Profile]=true; assert(players[i]:SteamID64()=="0" and not players[i].ZPIdleTestBot)
    end
    local ordinary=newPlayer(TEAM_HUMANS,0,false)
    consoleCommands.zp_addaibot(ordinary,"zp_addaibot",{})
    assert(messages[#messages].Phrase=="zombieplague.commandnotaccess" and #players==6)
    for _,args in ipairs({{"0"},{"17"},{"1.5"},{"nan"},{"1","unknown"},{"1","random","extra"}}) do
        consoleCommands.zp_addaibot(host,"zp_addaibot",args)
        assert(messages[#messages].Phrase=="zombieplague.aibotusage" and #players==6)
    end
    singleplayer=true; commands.aibot(host,{"1"}); assert(messages[#messages].Phrase=="zombieplague.botsingleplayer")
    singleplayer=false; maxplayers=6; commands.aibot(host,{"1"}); assert(messages[#messages].Phrase=="zombieplague.botfull")
    local idle=newPlayer(TEAM_HUMANS,0,true); idle.ZPIdleTestBot=true; bots:Attach(idle)
    assert(not bots:GetStatus(idle))
    local cmd=command(); bots:Command(idle,cmd); assert(cmd.buttons==99 and cmd.forward==99)
`));

test("perception retains a last known position without following hidden targets or targeting teammates", () => run(botSetup + `
    local Perception=include("sv_bot_perception.lua").BotPerception
    local senses,bot,target=construct(Perception),newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400)
    local snapshot=senses:Observe(bot,players,now)
    assert(snapshot.Visible and snapshot.Target==target and snapshot.EnemyPosition.x==400)
    wall=true; target.position=Vector(900,0,0)
    snapshot=senses:Observe(bot,players,now+1)
    assert(not snapshot.Visible and snapshot.EnemyPosition.x==400)
    assert(senses:Observe(bot,players,now+4).Target)
    assert(not senses:Observe(bot,players,now+13).Target)
    wall=false; target.team=TEAM_HUMANS
    snapshot=senses:Observe(bot,players,now+5); assert(not snapshot.Target and snapshot.Allies==0 and snapshot.AllyPosition)
    target.team=TEAM_ZOMBIES; target.position=Vector(-500,0,0)
    assert(not senses:Observe(bot,players,now+6).Target)
`));

test("managed inputs respect freeze, round transitions, reaction delay, line of sight and stale plans", () => run(setup + `
    local bot,target=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400,false)
    bots:Attach(bot,"defensive"); now=11; bots:Update()
    local cmd=command(); bots:Command(bot,cmd)
    assert(cmd.buttons & IN_ATTACK==0 and cmd.impulse==0 and cmd.side~=0)
    now=11.5; bots:Update(); bots:Command(bot,cmd); assert(cmd.buttons & IN_ATTACK~=0)
    wall=true; bots:Command(bot,cmd); assert(cmd.buttons & IN_ATTACK==0)
    wall=false; bot.frozen=true; bots:Command(bot,cmd); assert(cmd.buttons==0 and cmd.forward==0 and cmd.side==0)
    bot.frozen=false; RoundManager.state=ROUND_ENDING; bots:Command(bot,cmd); assert(cmd.buttons==0)
    RoundManager.state=ROUND_PLAYING; now=13; bots:Command(bot,cmd); assert(cmd.buttons==0)
    local ordinary=command(); bots:Command(host,ordinary); assert(ordinary.buttons==99 and ordinary.forward==99)
`));

test("bots explore immediately after the real freeze timer releases them, before infection and tactical learning", () => run(setup + `
    loaded=true
    local start,destination=newArea(1,0),newArea(2,400); start.adjacent={destination}; destination.adjacent={start}
    local bot,target=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400,false)
    function playerMeta:Freeze(value) self.frozen=value end
    RoundManager.GetAlivePlayers=function() return {bot,target} end
    timer.Destroy=function(name) timers[name]=nil end
    net.WriteInt=function() end; net.Broadcast=function() end
    CountDownSound,UnfreezeSounds={},{}
    include("sv_round_lifecycle.lua")
    RoundManager.NewRound=function(self) self.state=ROUND_PLAYING end
    RoundManager.state=ROUND_STARTING_NEW_ROUND
    bots:Attach(bot,"aggressive"); RoundManager:FreezeTime()
    now=11; bots:Update(); local cmd=command(); bots:Command(bot,cmd)
    assert(RoundManager.FreezeTimeActive and cmd.buttons==0 and cmd.forward==0 and cmd.side==0)
    assert(not bots:Diagnostics(0,1).Rows[1].Active)
    timers.ZombiePlagueTimer[2]()
    assert(not bot:IsFrozen() and not RoundManager.FreezeTimeActive and RoundManager.state==ROUND_STARTING_NEW_ROUND)
    assert(timers.ZombiePlagueTimer[1]==10, "infection countdown remains unchanged")
    bots:Update(); bots:Command(bot,cmd)
    assert(cmd.forward>0 and cmd.buttons & IN_ATTACK==0, "exploration starts in the first eligible Think")
    local row=bots:Diagnostics(0,2).Rows[1]
    assert(row.Active and not row.Decision and row.Action=="group" and row.Samples==0)
    bots:Damage(bot,damage(target,20),true)
    now=11.2; bots:Update(); bots:Command(bot,cmd)
    row=bots:Diagnostics(0,3).Rows[1]
    assert(row.Totals.ActiveSeconds>0 and row.Totals.DamageTaken==0 and row.Samples==0)
    timers.ZombiePlagueTimer[2]()
    now=11.5; bots:Update(); bots:Command(bot,cmd)
    assert(bots:Diagnostics(0,4).Rows[1].Decision, "normal combat begins after infection countdown")
`));

test("preparation suppresses stale combat inputs and all nonplayable phases still stop bot movement", () => run(setup + `
    local bot,target=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    local cmd=command(); now=11.5; bots:Update(); bots:Command(bot,cmd)
    assert(cmd.buttons & IN_ATTACK~=0)
    RoundManager.state=ROUND_STARTING_NEW_ROUND
    bots:Command(bot,cmd); assert(cmd.buttons & IN_ATTACK==0)
    bot.weapon.clip=0; bot.weapons[2]=newWeapon(30)
    bots:Command(bot,cmd); assert(cmd.buttons & IN_RELOAD==0 and not cmd.selected)
    for _,state in ipairs({ROUND_WAITING_PLAYERS,ROUND_ENDING,ROUND_RESTARTING,ROUND_VOTEMAP,ROUND_CHANGING_MAP}) do
        RoundManager.state=state; bots:Command(bot,cmd)
        assert(cmd.buttons==0 and cmd.forward==0 and cmd.side==0)
        assert(not bots:Diagnostics(0,1).Rows[1].Active)
    end
    RoundManager.state=ROUND_PLAYING; RoundManager.FreezeTimeActive=true
    bots:Command(bot,cmd); assert(cmd.buttons==0 and cmd.forward==0, "global freeze is authoritative")
`));

test("human bots reload and select only existing weapons while zombies chase and attack at melee range", () => run(setup + `
    local bot,target=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,500,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    bot.weapon.clip=0
    local cmd=command(); bots:Command(bot,cmd); assert(cmd.buttons & IN_RELOAD~=0 and cmd.buttons & IN_ATTACK==0)
    local loadedWeapon=newWeapon(12); bot.weapons[2]=loadedWeapon
    target.position=Vector(200,0,0); now=11.3; bots:Update()
    bots:Command(bot,cmd); assert(cmd.selected==loadedWeapon)
    bot.team=TEAM_ZOMBIES; target.team=TEAM_HUMANS; bot.weapon=newWeapon(-1); bot.weapons={bot.weapon}
    now=12; bots:Update(); bots:Command(bot,cmd)
    assert(bots:GetStatus(bot).Role=="zombie", "changed role")
    assert(cmd.forward>0,"zombie chases: "..cmd.forward)
    assert(cmd.buttons & IN_ATTACK==0,"no distant melee")
    target.position=Vector(65,0,0)
    now=13; bots:Update(); bots:Command(bot,cmd)
    now=13.5; bots:Update(); bots:Command(bot,cmd); assert(cmd.buttons & IN_ATTACK~=0)
`));

test("learning credits actual damage and infection to the original role, then survives bot removal and reload", () => run(setup + `
    local bot,target=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    hooks.PostEntityTakeDamage.ZPAdaptiveBots(bot,damage(target,20),false)
    bots:Reset(bot); assert(bots:GetStatus(bot).Samples==0)
    now=12; bots:Update(); bots:Command(bot,command())
    hooks.PostEntityTakeDamage.ZPAdaptiveBots(bot,damage(target,20),true)
    hooks.PostEntityTakeDamage.ZPAdaptiveBots(target,damage(bot,10),true)
    bot.team=TEAM_ZOMBIES
    hooks.ZPInfectionEvent.ZPAdaptiveBots(bot,target)
    assert(bots:GetStatus(bot).Samples==0 and bots:GetStatus(bot).Role=="zombie")
    bots:Save(); local saved=sharedMemory(1,"human","HumanDefault")
    assert(saved.Experience["v2:human:healthy:balanced:mid:quiet:attack"].Value<0)
    bots:Remove(bot); local replacement=newPlayer(TEAM_HUMANS,0)
    bots:Attach(replacement)
    assert(bots:GetStatus(replacement).ID==1 and bots:GetStatus(replacement).Samples==1)
    local Controller=include("sv_bot_controller.lua").BotController
    local reloaded=construct(Controller); reloaded:Attach(newPlayer(TEAM_HUMANS,0))
    assert(reloaded:GetStatus(players[#players]).Samples==1)
`));

test("death is learned before round completion, disconnect saves pending learning and disabled AI clears inputs", () => run(setup + `
    local bot,target=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    bots:Command(bot,command())
    hooks.DoPlayerDeath.ZPAdaptiveBots(bot,target,damage(target,100))
    assert(bots:GetStatus(bot).Samples==1)
    bot.alive=false; hooks.ZPEndRound.ZPAdaptiveBots(ZOMBIES_WIN)
    local before=writes; bots:Save(); assert(writes==before)
    bot.alive=true; now=12; bots:Update()
    values.zp_bot_ai_enabled=false
    local cmd=command(); bots:Command(bot,cmd); assert(cmd.buttons==0 and cmd.forward==0)
    values.zp_bot_ai_enabled=true; bots:Update()
    bots:Remove(bot); assert(not bots:GetStatus(bot))
    bots:Save(); assert(sharedMemory(1,"human","HumanDefault"))
`));

test("decision work rotates over bots and resets after team changes or player removal", () => run(setup + `
    local managed={}
    for i=1,6 do managed[i]=newPlayer(TEAM_HUMANS,0); bots:Attach(managed[i],"aggressive") end
    local target=newPlayer(TEAM_ZOMBIES,400,false)
    now=11; bots:Update()
    local moving=0
    for _,bot in ipairs(managed) do local cmd=command(); bots:Command(bot,cmd); if cmd.forward~=0 or cmd.side~=0 then moving=moving+1 end end
    assert(moving==2)
    bots:Update(); bots:Update()
    for _,bot in ipairs(managed) do local cmd=command(); bots:Command(bot,cmd); assert(cmd.forward~=0 or cmd.side~=0) end
    managed[1].invalid=true; bots:Update(); assert(not bots:GetStatus(managed[1]))
    managed[2].team=TEAM_ZOMBIES
    local cmd=command(); bots:Command(managed[2],cmd); assert(cmd.buttons==0 and cmd.forward==0)
`));

test("shutdown flushes an unfinished combat episode before persisting it", () => run(setup + `
    local bot,target=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,400,false)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    bots:Command(bot,command())
    hooks.PostEntityTakeDamage.ZPAdaptiveBots(bot,damage(target,20),true)
    assert(bots:GetStatus(bot).Samples==0)
    hooks.ShutDown.ZPAdaptiveBots()
    local saved=sharedMemory(1,"human","HumanDefault")
    assert(bots:GetStatus(bot).Samples==1 and saved.Experience["v2:human:healthy:balanced:mid:quiet:attack"].Samples==1)
`));
