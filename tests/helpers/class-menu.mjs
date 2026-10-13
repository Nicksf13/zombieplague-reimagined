import { serverSetup, clientSetup, panelsSetup } from "./weapon-menu.mjs";

export const classServerSetup = serverSetup + `
GM={}; GAMEMODE=GM
hook.Call=function(name,_,...) return hook.Run(name,...) end
net.Broadcast=function() end
PlayerManager={GetPlayerID=function() return "1" end}
RoundManager={IsRealisticMod=function() return false end}
include("sh_class_menu_protocol.lua")
include("sv_classmanager.lua"); ClassManager:SearchClasses()
include("sv_player_classes.lua")
include("sv_class_menu_apply.lua"); include("sv_class_menu.lua")
local deferred={}
timer.Simple=function(_,callback) deferred[#deferred+1]=callback end
local function flush()
    local callbacks=deferred; deferred={}
    for _,callback in ipairs(callbacks) do callback() end
end
function meta:IsZombie() return not self.human and not self.spectator end
function meta:IsNemesis() return self.nemesis or false end
function meta:Health() return self.health or 100 end
function meta:GetMaxHealth() return self.maxHealth or 100 end
function meta:Armor() return self.armor or 25 end
function meta:GetBreath() return self.breath or 100 end
function meta:StripWeapons() self.inventory={}; self.stripped=(self.stripped or 0)+1 end
function meta:SetupHands() end
for _,field in ipairs({"MaxHealth", "Health", "Armor", "Model", "WalkSpeed", "RunSpeed", "CrouchedWalkSpeed",
    "AuxGravity", "JumpPower", "MaxBreath", "Breath", "DamageAmplifier", "Footstep", "MaxBatteryCharge", "MaxAbilityPower", "AbilityPower"}) do
    meta["Set"..field]=function(self,value)
        self.applied=self.applied or {}; self.applied[field]=value
        if field=="Health" then self.health=value end
        if field=="MaxHealth" then self.maxHealth=value end
        if field=="Armor" then self.armor=value end
    end
end
function meta:SetModelScale(scale,delay) self.scale=scale end
local function classCatalog(id)
    now=now+0.3; uints={1,id}; receivers.ZPClassMenuCatalog(39,ply); return sent[2]
end
local function chooseClass(id,kind,class)
    now=now+0.3; readTable={Version=1,RequestID=id,Kind=kind,ID=class}
    receivers.ZPClassMenuSelect(512,ply); return sent[2]
end
`;

export const classClientSetup = clientSetup + panelsSetup + `
include("sh_class_menu_protocol.lua")
include("cl_class_menu.lua"); include("cl_class_menu_hud.lua")
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local classSnapshot={Entries={
    {ID="DefaultHuman",Kind="human",Name="HumanDefaultClassName",Description="HumanDefaultClassDescription",Order=1,
        Health=100,Armor=25,Speed=100,RunSpeed=230,Gravity=1,Jump=200,Damage=1,Ability=0,
        CrouchSpeed=0.4,Battery=100,Breath=100,Scale=1,Footstep=true,FallDamage=true,AbilityCost=0,AbilityOnActivation=false},
    {ID="DefaultZombie",Kind="zombie",Name="ZombieDefaultClassName",Description="ZombieDefaultClassDescription",Order=1,
        Health=2000,Armor=0,Speed=100,RunSpeed=290,Gravity=0.8,Jump=200,Damage=1,Ability=0,
        CrouchSpeed=0.4,Battery=0,Breath=100,Scale=1,Footstep=false,FallDamage=false,AbilityCost=0,AbilityOnActivation=false},
    {ID="HeavyZombie",Kind="zombie",Name="ZombieHeavyClassName",Description="ZombieHeavyClassDescription",Order=2,
        Health=4000,Armor=0,Speed=100,RunSpeed=240,Gravity=0.8,Jump=200,Damage=1,Ability=0,
        CrouchSpeed=0.6,Battery=0,Breath=200,Scale=1.1,Footstep=false,FallDamage=true,AbilityCost=0,AbilityOnActivation=false}},
    Selected={human="",zombie=""},First={human=true,zombie=true}}
local function classReply(id,code,data)
    readTable={Version=1,RequestID=id,Code=code or "catalog",Snapshot=data or classSnapshot}
    receivers.ZPClassMenuReply(8192)
end
local function classFrame()
    for _,panel in ipairs(panels) do
        if panel.kind=="DFrame" and not panel.removed then return panel end
    end
end
`;
