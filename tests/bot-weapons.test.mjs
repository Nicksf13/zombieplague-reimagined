import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local Controller=include("sv_bot_weapons.lua").BotWeaponController
local weapons=construct(Controller)
local bot,target=newPlayer(TEAM_HUMANS,0),newPlayer(TEAM_ZOMBIES,200,false)
local function arm(id,capacity,clip,ammo)
    local weapon=newWeapon(capacity,clip)
    function weapon:GetClass() return id end
    function weapon:GetPrimaryAmmoType() return ammo or 1 end
    return weapon
end
local primary,secondary,melee=arm("weapon_smg1",30,0,1),arm("weapon_pistol",12,12,2),arm("weapon_crowbar",-1,-1,-1)
bot.weapon=primary; bot.weapons={primary,secondary,melee}; bot.reserveByType={[1]=90,[2]=24}
local senses={Visible=true,Allies=0,Enemies=1,Target=target,EnemyPosition=target:GetPos(),AimPosition=target:WorldSpaceCenter()}
local function apply() local cmd=command(); return weapons:Apply(bot,cmd,senses),cmd end
`;

test("empty primary switches under pressure, waits for actual equipment and avoids repeated switching", () => run(setup + `
    local result,cmd=apply()
    assert(cmd.selected==secondary and result.Gate=="weapon_switch" and not result.Decision.Withdraw)
    assert(not result.Decision.Reload and bot:GetActiveWeapon()==primary, "selection never pretends the engine equipped it")
    now=10.1; result,cmd=apply(); assert(not cmd.selected and result.Gate=="weapon_switch")
    bot.weapon=secondary; result,cmd=apply(); assert(not result.Gate and result.Decision.Ready and not cmd.selected)
    now=10.8; result,cmd=apply(); assert(not cmd.selected, "a nearby threat keeps the loaded fallback")
    senses.Visible=false; senses.EnemyPosition=nil
    result,cmd=apply(); assert(cmd.selected==primary and result.Gate=="weapon_switch")
    bot.weapon=primary; result,cmd=apply(); assert(result.Gate=="reload_pressed" and result.Decision.Reload)
    now=10.9; result,cmd=apply(); assert(result.Gate=="reload", "reload is pulsed, never held every tick")
    primary.clip=30; result,cmd=apply(); assert(not result.Gate and not cmd.selected)
`));

test("safe reloads preserve the active gun and recent damage makes switching urgent even without sight", () => run(setup + `
    senses.EnemyPosition=Vector(600,0,0)
    local result,cmd=apply(); assert(result.Gate=="reload_pressed" and not cmd.selected and not result.Decision.Withdraw)
    senses.Visible=false; senses.RecentDamage=true
    result,cmd=apply(); assert(result.Gate=="weapon_switch" and cmd.selected==secondary)
    bot.weapon=secondary; apply()
    senses.RecentDamage=false; now=10.1
    result,cmd=apply(); assert(not cmd.selected, "brief equipment hold prevents a reversal after a transient threat")
    now=10.7; result,cmd=apply(); assert(cmd.selected==primary)
`));

test("reserve is checked per ammo type, depleted guns never reload and empty magazines can recover", () => run(setup + `
    secondary.clip=0; bot.reserveByType={[1]=0,[2]=24}
    local result,cmd=apply(); assert(cmd.selected==secondary and result.Decision.Reload and result.Decision.Withdraw)
    bot.weapon=secondary; result=apply(); assert(result.Gate=="reload_pressed")
    secondary.clip=12; result=apply(); assert(not result.Gate and not result.Decision.Withdraw)
    weapons:Reset(bot); bot.weapon=primary; bot.reserveByType={[1]=0,[2]=0}; secondary.clip=0
    result,cmd=apply(); assert(cmd.selected==melee and not result.Decision.Reload and result.Decision.Withdraw)
    bot.weapon=melee; result=apply(); assert(not result.Gate and not result.Decision.Ranged)
    bot.weapons={primary}; bot.weapon=primary
    result,cmd=apply(); assert(result.Gate=="no_usable_weapon" and not cmd.selected and not result.Decision.Reload)
    bot.reserveByType[1]=10; result=apply(); assert(result.Gate=="reload_pressed", "normal ammo pickups restore reload eligibility")
`));

test("failed or removed selections recover and state belongs to each player", () => run(setup + `
    local result,cmd=apply(); assert(cmd.selected==secondary)
    now=11.6; result,cmd=apply()
    assert(not cmd.selected and result.Gate=="reload_pressed" and result.Decision.Withdraw, "a refused selection falls back to reloading")
    now=14.7; result,cmd=apply(); assert(cmd.selected==secondary, "failed selection cooldown eventually expires")
    secondary.invalid=true; bot.weapons={primary,melee}; result,cmd=apply()
    assert(not cmd.selected and result.Decision.Weapon==primary, "removed equipment cannot hold a pending request")
    local other=newPlayer(TEAM_HUMANS,0); other.weapon=primary; other.weapons={primary,secondary,melee}; secondary.invalid=false
    local otherCmd=command(); weapons:Apply(other,otherCmd,senses); assert(otherCmd.selected==secondary)
    weapons:Reset(bot); bot.weapons={primary,secondary,melee}; result,cmd=apply(); assert(cmd.selected==secondary)
`));

test("clipless firearms, infinite registered weapons and ammo-less tools have separate contracts", () => run(setup + `
    local inspect=include("sv_bot_weapon_ammo.lua").inspect
    local clipless=arm("weapon_rpg",-1,-1,3)
    bot.reserveByType[3]=2
    assert(inspect(bot,clipless).Ready and not inspect(bot,clipless).Reloadable)
    bot.reserveByType[3]=0; assert(not inspect(bot,clipless).Ready)
    for _,id in ipairs({"gmod_tool","weapon_physcannon","zp_bot_safe_tool","zp_decoy_grenade_thrower","weapon_frag"}) do
        local utility=arm(id,1,1,-1); assert(inspect(bot,utility).Kind=="utility" and not inspect(bot,utility).Ready)
    end
    WEAPON_PRIMARY,WEAPON_SECONDARY,WEAPON_MELEE=1,2,3
    WeaponManager={FindWeaponByWeaponId=function(_,id,kind)
        if (id=="addon_blade" and kind==3) or (id=="addon_infinite" and kind==1) then return {} end
    end}
    assert(inspect(bot,arm("addon_blade",-1,-1,-1)).Kind=="melee")
    assert(inspect(bot,arm("addon_infinite",-1,-1,-1)).Ready)
    assert(inspect(bot,arm("unknown_tool",-1,-1,-1)).Kind=="utility")
`));

const motorSetup = setup + `
local motor=include("sv_bot_motor.lua")
local function drive(combat)
    local cmd=command(); local execution
    now=12; bot.angles=Angle(0,0,0)
    motor.apply(bot,cmd,{Senses=senses,Steering={Jump=false,Duck=false,Use=false,Stuck=false},Action="attack",Updated=now,ReadyAt=now},1,combat~=false,
        function(value) execution=value end)
    return cmd,execution
end
`;

test("motor suppresses attacks during switching and dry fire, then resumes only with the equipped weapon", () => run(motorSetup + `
    local cmd,execution=drive()
    assert(cmd.selected==secondary and cmd.buttons & (IN_ATTACK | IN_RELOAD)==0 and execution.AttackGate=="weapon_switch")
    bot.weapon=secondary; cmd,execution=drive(); assert(cmd.buttons & IN_ATTACK~=0 and execution.AttackGate=="issued")
    motor.resetWeapons(bot); bot.weapon=primary; bot.weapons={primary}; bot.reserveByType={}
    cmd,execution=drive(); assert(cmd.buttons & (IN_ATTACK | IN_RELOAD)==0 and execution.AttackGate=="no_usable_weapon")
    bot.reserveByType[1]=30; cmd,execution=drive()
    assert(cmd.buttons & IN_RELOAD~=0 and cmd.buttons & IN_ATTACK==0 and execution.AttackGate=="reload")
    assert(execution.Interventions[1].Controller=="weapons" and execution.Interventions[1].Tactical)
`));

test("humans retreat toward safer allies without chasing with melee and only swing within reach", () => run(motorSetup + `
    secondary.clip=0; bot.reserveByType={}
    local request=motor.request(bot,senses,"attack","aggressive")
    assert(request.Withdraw and request.Goal.x<0 and request.Interventions[1].Tactical)
    senses.AllyPosition=Vector(-300,100,0)
    request=motor.request(bot,senses,"attack","aggressive"); assert(request.Goal==senses.AllyPosition)
    senses.AllyPosition=Vector(180,0,0)
    request=motor.request(bot,senses,"group","cooperative"); assert(request.Goal.x<0, "do not group toward the threat")
    bot.weapon=melee; local cmd,execution=drive(); assert(cmd.buttons & IN_ATTACK==0 and execution.AttackGate=="outside_melee_envelope")
    target.position=Vector(65,0,0); senses.EnemyPosition=target:GetPos(); senses.AimPosition=target:WorldSpaceCenter()
    cmd=drive(); assert(cmd.buttons & IN_ATTACK~=0)
    primary.clip=5; request=motor.request(bot,senses,"attack","aggressive"); assert(not request.Withdraw)
`));

test("preparation and zombies keep their existing combat boundaries", () => run(motorSetup + `
    local cmd=drive(false); assert(not cmd.selected and cmd.buttons & (IN_ATTACK | IN_RELOAD)==0)
    bot.team=TEAM_ZOMBIES; target.team=TEAM_HUMANS; bot.weapon=melee
    local request=motor.request(bot,senses,"attack","aggressive"); assert(not request.Withdraw and request.Move=="approach")
    cmd=drive(); assert(not cmd.selected and cmd.buttons & IN_RELOAD==0)
    bot.weapon=primary; cmd=drive(); assert(cmd.buttons & IN_RELOAD~=0, "allowed zombie firearms retain their old reload handling")
`));

test("controller withdraws without ammo while preserving the selected tactic and withholding forced-action learning", () => run(setup + `
    local bots=include("sv_bots.lua").bots
    secondary.clip=0; bot.reserveByType={}; bot.weapons={primary}
    target.position=Vector(400,0,0)
    bots:Attach(bot,"aggressive"); now=11; bots:Update()
    local cmd=command(); bots:Command(bot,cmd)
    assert(cmd.forward<0 and cmd.buttons & IN_SPEED~=0, "ammo withdrawal integrates with normal navigation and sprinting")
    assert(cmd.buttons & (IN_ATTACK | IN_RELOAD)==0 and bots:GetStatus(bot).Action=="attack", "the forced retreat does not relabel the learned tactic")
    bots:Damage(bot,damage(target,20),true)
    now=11.5; bots:Reset(bot)
    assert(bots:GetStatus(bot).Samples==0, "a compulsory ammo retreat cannot train the original attack choice")
`));
