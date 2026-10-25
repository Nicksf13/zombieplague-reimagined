import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
WMODE_NONE=0; values.zp_clip_mode=0
include("sh_extra_menu_protocol.lua")
include("sv_weaponmanager.lua")
include("sv_extraitems.lua")
local item=include("extraitems/zp_extra_ammo.lua").default
ExtraItemsManager:AddExtraItem(item,ITEM_HUMAN)
WeaponManager:AddWeapon({WeaponID="weapon_smg1",WeaponType=WEAPON_PRIMARY,DamageMultiplier=1},WEAPON_PRIMARY)
WeaponManager:AddWeapon({WeaponID="weapon_pistol",WeaponType=WEAPON_SECONDARY,DamageMultiplier=1},WEAPON_SECONDARY)
function playerMeta:GetAmmoPacks() return self.balance or 0 end
function playerMeta:TakeAmmoPacks(amount) self.balance=self:GetAmmoPacks()-amount; self.charges=(self.charges or 0)+1 end
function playerMeta:GiveAmmo(amount,ammo)
    self.ammoGives=(self.ammoGives or 0)+1
    self.reserveByType[ammo]=(self.reserveByType[ammo] or 0)+amount
end
local bot=newPlayer(TEAM_HUMANS,0)
local primary,secondary=newWeapon(30,0),newWeapon(12,0)
function primary:GetClass() return "weapon_smg1" end
function secondary:GetClass() return "weapon_pistol" end
function secondary:GetPrimaryAmmoType() return 2 end
bot.weapon=primary; bot.weapons={primary,secondary}; bot.reserveByType={}; bot.balance=3
local senses={Visible=false,Allies=0,Enemies=0}
local buyer=construct(include("sv_bot_ammo_purchase.lua").BotAmmoBuyer)
`;

test("an exhausted bot buys the real extra-ammo item at its server price and still needs a normal reload", () => run(setup + `
    assert(buyer:Decide(bot,senses).Reason=="buy" and not bot.charges, "considering a purchase has no side effects")
    assert(buyer:Consider(bot,senses)=="bought")
    assert(bot.balance==0 and bot.charges==1 and bot.ammoGives==2)
    assert(bot:GetAmmoCount(1)==450 and bot:GetAmmoCount(2)==180)
    assert(primary:Clip1()==0 and secondary:Clip1()==0, "the shop refills reserve, never completes reloads")
    assert(messages[#messages].Phrase=="zombieplague.extraitembought", "normal shop callbacks and notifications run")
    now=11; assert(buyer:Consider(bot,senses)=="cooldown" and bot.charges==1)
`));

test("a useful alternative delays spending under pressure and preserves the last purchase worth of packs", () => run(setup + `
    secondary.clip=12; bot.balance=6
    senses.Visible=true; senses.EnemyPosition=Vector(200,0,0)
    assert(buyer:Consider(bot,senses)=="keep_fighting" and not bot.charges)
    now=11.1; senses.EnemyPosition=Vector(600,0,0); senses.RecentDamage=true
    assert(buyer:Consider(bot,senses)=="keep_fighting")
    now=12.2; senses.RecentDamage=false; bot.balance=5
    assert(buyer:Consider(bot,senses)=="save_packs" and not bot.charges)
    now=13.3; bot.balance=6
    assert(buyer:Consider(bot,senses)=="bought" and bot.balance==3 and bot.charges==1)
`));

test("magazines and reserve are considered across the inventory before spending", () => run(setup + `
    primary.clip=30; secondary.clip=12
    assert(buyer:Decide(bot,senses).Reason=="not_needed")
    primary.clip=0; secondary.clip=0; bot.reserveByType={[1]=40,[2]=10}
    assert(buyer:Decide(bot,senses).Reason=="not_needed", "an empty magazine with reserve only needs reloading")
    bot.reserveByType[1]=0
    assert(buyer:Decide(bot,senses).Reason=="save_packs", "the other firearm's reserve remains a usable alternative")
    bot.reserveByType[2]=0
    assert(buyer:Consider(bot,senses)=="bought", "exhaustion makes spending the final affordable price worthwhile")
`));

test("current shop prices, affordability, availability and clip mode remain authoritative", () => run(setup + `
    for _,balance in ipairs({0,2,-1,1.5,math.huge,0/0}) do
        bot.balance=balance; assert(buyer:Decide(bot,senses).Reason=="insufficient")
    end
    bot.balance=10
    for _,price in ipairs({-1,1.5,math.huge,0/0}) do
        item.Price=price; assert(buyer:Decide(bot,senses).Reason=="unavailable")
    end
    item.Price=7; bot.balance=6; assert(buyer:Decide(bot,senses).Reason=="insufficient")
    bot.balance=7; values.zp_clip_mode=1; assert(buyer:Decide(bot,senses).Reason=="unavailable")
    values.zp_clip_mode=0; item.ShouldBeEnabled=function() return false end
    assert(buyer:Decide(bot,senses).Reason=="unavailable")
    item.ShouldBeEnabled=function() return true end
    assert(buyer:Consider(bot,senses)=="bought" and bot.balance==0 and bot.charges==1)
    ExtraItemsManager.HumansExtraItems={}; now=21
    assert(buyer:Decide(bot,senses).Reason=="unavailable")
`));

test("only a living unfrozen human bot in active play may make an automatic purchase", () => run(setup + `
    bot.alive=false; assert(buyer:Consider(bot,senses)=="inactive")
    bot.alive=true; bot.frozen=true; assert(buyer:Consider(bot,senses)=="inactive")
    bot.frozen=false; bot.bot=false; assert(buyer:Consider(bot,senses)=="inactive")
    bot.bot=true; bot.team=TEAM_ZOMBIES; assert(buyer:Consider(bot,senses)=="inactive")
    bot.team=TEAM_SPECTATOR; assert(buyer:Consider(bot,senses)=="inactive")
    bot.team=TEAM_HUMANS
    for _,phase in ipairs({ROUND_STARTING_NEW_ROUND,ROUND_WAITING_PLAYERS,ROUND_ENDING,ROUND_RESTARTING,ROUND_VOTEMAP}) do
        RoundManager.state=phase; assert(buyer:Consider(bot,senses)=="inactive")
    end
    assert(not bot.charges and not bot.ammoGives and bot.balance==3)
`));

test("the bot does not pay for ammo the existing item cannot deliver to its depleted weapons", () => run(setup + `
    local extra=newWeapon(10,0)
    function extra:GetClass() return "unregistered_extra" end
    bot.weapon=extra; bot.weapons={extra}
    assert(buyer:Decide(bot,senses).Reason=="cannot_refill")
    local clipless=newWeapon(-1,-1)
    function clipless:GetClass() return "weapon_rpg" end
    bot.weapon=clipless; bot.weapons={clipless}
    assert(buyer:Decide(bot,senses).Reason=="cannot_refill")
    local tool=newWeapon(-1,-1)
    function tool:GetClass() return "gmod_tool" end
    bot.weapon=tool; bot.weapons={tool}; assert(buyer:Decide(bot,senses).Reason=="not_needed")
    assert(not bot.charges and bot.balance==3)
`));

test("failed or ineffective purchases cannot repeatedly drain packs on the same inventory", () => run(setup + `
    local checks=0
    item.CanBuy=function() checks=checks+1; return checks==1 end
    assert(buyer:Consider(bot,senses)=="rejected" and not bot.charges and bot.balance==3)
    now=11; assert(buyer:Consider(bot,senses)=="cooldown" and checks==2)
    now=21; item.CanBuy=function() return true end; item.OnBuy=function() end; bot.balance=30
    assert(buyer:Consider(bot,senses)=="ineffective" and bot.charges==1 and bot.balance==27)
    now=32; assert(buyer:Consider(bot,senses)=="ineffective" and bot.charges==1)
    now=43; assert(buyer:Consider(bot,senses)=="ineffective" and bot.charges==1)
    buyer:Reset(bot); assert(buyer:Decide(bot,senses).Reason=="buy", "a new bot life clears the failed purchase state")
`));

test("purchase delays and balances are independent even when bots share SteamID64", () => run(setup + `
    local other=newPlayer(TEAM_HUMANS,0); other.weapon=primary; other.weapons={primary,secondary}; other.reserveByType={}; other.balance=3
    assert(bot:SteamID64()==other:SteamID64())
    assert(buyer:Consider(bot,senses)=="bought" and buyer:Consider(other,senses)=="bought")
    assert(bot.charges==1 and other.charges==1 and bot.balance==0 and other.balance==0)
    bot.reserveByType={}; bot.balance=3; now=11
    assert(buyer:Consider(bot,senses)=="cooldown")
    now=21; assert(buyer:Consider(bot,senses)=="bought" and bot.charges==2)
`));

test("motor purchases through the shop before re-evaluating reloads and marks the resource intervention", () => run(setup + `
    local motor=include("sv_bot_motor.lua")
    local target=newPlayer(TEAM_ZOMBIES,200,false)
    senses={Visible=true,Allies=0,Enemies=1,Target=target,EnemyPosition=target:GetPos(),AimPosition=target:WorldSpaceCenter()}
    local plan={Senses=senses,Steering={Jump=false,Duck=false,Use=false,Stuck=false},Action="attack",Updated=now,ReadyAt=now}
    local cmd=command(); local execution
    motor.apply(bot,cmd,plan,1,false); assert(not bot.charges and cmd.buttons & IN_RELOAD==0, "preparation cannot purchase")
    motor.apply(bot,cmd,plan,1,true,function(value) execution=value end)
    assert(bot.charges==1 and cmd.buttons & IN_RELOAD~=0 and cmd.buttons & IN_ATTACK==0)
    assert(execution.Interventions[1].Reason=="ammo_purchase" and execution.Interventions[1].Tactical)
    assert(execution.AttackGate=="reload" and primary.clip==0 and bot.balance==0)
`));
