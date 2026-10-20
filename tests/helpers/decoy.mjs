import { radarServerSetup } from "./radar.mjs";

export const decoySetup = radarServerSetup + `
set("allies",0)
SERVER,CLIENT=true,false
SOLID_VPHYSICS,MOVETYPE_VPHYSICS,MASK_SHOT_HULL=1,2,3
ACT_VM_THROW,PLAYER_ATTACK1=4,5
IsValid=function(value) return type(value)=="table" and not value.removed end
IsFirstTimePredicted=function() return true end
local deferred,effects,projectiles,sprites={},{},{},{}
math.Rand=function(min,max) return (min+max)/2 end
ParticleEffectManager={EmitParticleEffect=function(_,packet) sprites[#sprites+1]=packet end}
timer.Simple=function(_,callback) deferred[#deferred+1]=callback end
timer.Remove=function(name) timers[name]=nil end
local blocked,badPhysics,createFailure=false,false,false
util.TraceHull=function(options) return {HitPos=options.endpos,StartSolid=blocked} end
function Angle(p,y,r) return {p=p,y=y,r=r} end
function EffectData()
    return {SetOrigin=function(self,p) self.position=p end,SetAngles=function(self,a) self.angle=a end,
        SetScale=function(self,s) self.scale=s end,SetMagnitude=function(self,m) self.magnitude=m end}
end
util.Effect=function(name,data) effects[#effects+1]={name,data} end
local weaponEngine={}
function weaponEngine:EntIndex() return self.id end
function weaponEngine:GetClass() return self.class end
function weaponEngine:GetOwner() return self.Owner end
function weaponEngine:GetTable() return self.fields or {} end
function weaponEngine:GetPrimaryAmmoType() return self.ammo or 1 end
function weaponEngine:Clip1() return self.clip or 1 end
function weaponEngine:CanPrimaryAttack() return self:Clip1()>0 end
function weaponEngine:TakePrimaryAmmo(count) self.clip=self:Clip1()-count; self.consumed=(self.consumed or 0)+count end
function weaponEngine:SetNextPrimaryFire(value) self.nextShot=value end
function weaponEngine:SendWeaponAnim(value) self.animation=value end
function weaponEngine:SetHoldType(value) self.hold=value end
function weaponEngine:EmitSound(value) self.sounds=self.sounds or {}; self.sounds[#self.sounds+1]=value end
function weaponEngine:Remove()
    self.removed=true
    if self.Owner and self.Owner.held==self then self.Owner.held=nil end
end
local function gun(class,fields,ammo)
    return setmetatable({class=class,fields=fields or {},ammo=ammo},{__index=weaponEngine})
end
local function newWeapon(ply)
    SWEP=setmetatable({Primary={},Secondary={},Owner=ply,class="zp_decoy_grenade_thrower",clip=1,id=1000+ply.id},{__index=weaponEngine})
    include("zombieplague/entities/weapons/zp_decoy_grenade_thrower.lua")
    SWEP:Initialize(); return SWEP
end
local function prepare(ply)
    ply.gun=gun("weapon_ar2"); ply.active=ply.gun
    function ply:GetActiveWeapon() return self.active end
    function ply:GetWeapons() return self.held and {self.gun,self.held} or {self.gun} end
    function ply:GetWeapon(class) return self.held end
    function ply:Give(class) self.held=newWeapon(self); return self.held end
    function ply:SelectWeapon(class)
        hook.Run("PlayerSwitchWeapon",self,self.active,self.held); self.active=self.held
    end
    function ply:GetAimVector() return Vector(1,0,0) end
    function ply:EyePos() return Vector(self.position.x,self.position.y,self.position.z+64) end
    function ply:GetVelocity() return Vector(10,0,0) end
    function ply:IsFrozen() return self.frozen or false end
    function ply:SetAnimation(value) self.animation=value end
    return ply
end
prepare(human); prepare(zombie); prepare(friend)
local entityEngine={}
function entityEngine:EntIndex() assert(not self.removed,"Removed entity APIs must not be accessed"); return self.id end
function entityEngine:SetOwner(owner) self.owner=owner end
function entityEngine:GetOwner() return self.owner end
function entityEngine:SetPos(pos) self.position=pos end
function entityEngine:GetPos() return self.position end
function entityEngine:SetModel(model) self.model=model end
function entityEngine:PhysicsInit() end
function entityEngine:SetMoveType() end
function entityEngine:SetSolid() end
function entityEngine:PhysWake() end
function entityEngine:EmitSound(sound) self.sounds[#self.sounds+1]=sound end
function entityEngine:GetPhysicsObject()
    if badPhysics then return nil end
    return {SetVelocity=function(_,velocity) self.velocity=velocity end}
end
function entityEngine:Spawn() self:Initialize() end
function entityEngine:Remove()
    if self.removed then return end
    if self.OnRemove then self:OnRemove() end
    self.removed=true
end
ENT=setmetatable({},{__index=entityEngine})
include("zombieplague/entities/entities/zp_grenade_base.lua")
local base=ENT
local armingMode=ARM_ON_HIT_MODE
ARM_ON_HIT_MODE=nil
ENT=setmetatable({BaseClass=base},{__index=base})
include("zombieplague/entities/entities/zp_decoy_grenade.lua")
ARM_ON_HIT_MODE=armingMode
local projectile=ENT
ents={Create=function(class)
    if createFailure then return nil end
    local entity=setmetatable({id=200+#projectiles,sounds={}},{__index=projectile})
    projectiles[#projectiles+1]=entity; return entity
end}
include("sv_decoy.lua")
local function advance(time) now=time; timers.ZPDecoys[2](); tick(time) end
local function arm(entity)
    entity:PhysicsCollide({},{}); local callback=timers[entity.Timer][2]
    advance(now+0.75); callback(); advance(now)
end
local function launch(ply)
    ZPDecoy:Give(ply); local weapon=ply.held; weapon:PrimaryAttack()
    return projectiles[#projectiles],weapon
end
local function contact(viewer,id)
    for _,entry in ipairs(state(viewer).Contacts) do if entry.ID==id then return entry end end
end
`;
