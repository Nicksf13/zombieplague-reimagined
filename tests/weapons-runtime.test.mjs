import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
SERVER,CLIENT=true,false
local now=20
function CurTime() return now end
EXPLODE_ON_HIT_MODE,ARM_ON_HIT_MODE,TIME_MODE=0,1,2
ACT_VM_IDLE,ACT_VM_THROW,ACT_VM_DRAW,ACT_VM_SECONDARYATTACK,PLAYER_ATTACK1=1,2,3,4,5
SOLID_VPHYSICS,MOVETYPE_VPHYSICS=6,7
function Model(path) return path end
function Sound(path) return path end
local vecmeta={}
function Vector(x,y,z) return setmetatable({x=x,y=y,z=z,isvec=true},{__index=vecmeta}) end
function vecmeta:Add(v) self.x=self.x+v.x; self.y=self.y+v.y; self.z=self.z+v.z end
function vecmeta:Mul(v) if type(v)=="number" then self.x=self.x*v; self.y=self.y*v; self.z=self.z*v else self.x=self.x*v.x; self.y=self.y*v.y; self.z=self.z*v.z end end
function VectorRand() return Vector(0,0,0) end
function Angle(p,y,r) return {p=p,y=y,r=r,isang=true} end
function isvector(value) return type(value)=="table" and value.isvec==true end
function isangle(value) return type(value)=="table" and value.isang==true end
function istable(value) return type(value)=="table" end
IsValid=function(value) return type(value)=="table" and not value.removed end
timer.Remove=function(name) timers[name]=nil end
local vm={SequenceDuration=function() return 1 end,GetPlaybackRate=function() return 1 end,
    GetBoneCount=function() return 0 end,ManipulateBoneScale=function() end,ManipulateBoneAngles=function() end,
    ManipulateBonePosition=function() end,SetColor=function() end,SetMaterial=function() end}
local owner={GetViewModel=function() return vm end,SetAnimation=function() end,StripWeapon=function(self,id) self.stripped=id end,
    GetAmmoCount=function() return 10 end,GetAimVector=function() return Vector(1,0,0) end,EyePos=function() return Vector(100,0,0) end}
local weaponMeta={EntIndex=function() return 1 end,SetHoldType=function() end,SendWeaponAnim=function() end,CanPrimaryAttack=function() return true end,
    GetOwner=function(self) return self.Owner end,GetClass=function() return "grenade_thrower" end,Clip1=function() return 1 end,
    TakePrimaryAmmo=function(self,amount) self.consumed=(self.consumed or 0)+amount end,SetNextPrimaryFire=function() end,DefaultReload=function() end}
local function newWeapon() SWEP=setmetatable({Primary={},Secondary={},Owner=owner},{__index=weaponMeta}); SWEP.Weapon=SWEP end
local grenadeMeta={EntIndex=function(self) return self.index end,SetModel=function(self,path) self.model=path end,PhysicsInit=function() end,SetMoveType=function() end,
    SetSolid=function() end,SetOwner=function(self,ply) self.owner=ply end,GetOwner=function(self) return self.owner end,
    SetPos=function(self,pos) self.pos=pos end,GetPos=function(self) return self.pos end,Remove=function(self) self.removed=true end,
    GetPhysicsObject=function() return {ApplyForceCenter=function(self,force) self.force=force end} end}
ENT=setmetatable({},{__index=grenadeMeta}); include("zombieplague/entities/entities/zp_grenade_base.lua")
local base=ENT
local grenades={}
ents={Create=function(class)
    local grenade=setmetatable({PrintName=class,index=#grenades+1},{__index=base})
    grenade.Spawn=function(self) self:Initialize() end
    grenades[#grenades+1]=grenade
    return grenade
end}
`;

test("grenade launchers retain projectile speed, ammo use and delayed owner checks", () => run(setup + `
    for _,kind in ipairs({"infection","antidote"}) do
        newWeapon(); include("zombieplague/entities/weapons/zp_"..kind.."_grenade_thrower.lua")
        SWEP:Initialize(); SWEP.ProjectileMode=TIME_MODE; SWEP:PrimaryAttack()
        local projectile=grenades[#grenades]
        assert(projectile.owner==owner and projectile.pos.x==140 and projectile.Armed and SWEP.consumed==1)
        assert(projectile:GetExplosionDelay()==5 and timers[projectile.Timer][1]==5)
        owner.removed=true
        timers[SWEP:WeaponReloadIdentifier()][2]()
        assert(not owner.stripped)
        owner.removed=nil
    end
`));

test("client antidote construction clones vectors, keeps model offsets and has no server projectile side effects", () => run(setup + `
    SERVER,CLIENT=false,true
    file.Exists=function() return false end
    newWeapon(); include("zombieplague/entities/weapons/zp_antidote_grenade_thrower.lua")
    local original=SWEP.VElements["base+"].pos
    SWEP:Initialize()
    local cloned=SWEP.VElements["base+"].pos
    assert(cloned~=original and cloned.x==0.22 and cloned.y==0.063 and cloned.z==3.268)
    SWEP:ShootGrenade()
    assert(#grenades==0 and SWEP.consumed==nil)
    local vector=Vector(1,2,3); local angle=Angle(4,5,6)
    local copied=table.FullCopy({v=vector,a=angle,nested={value=false}})
    assert(copied.v~=vector and copied.a~=angle and copied.v.z==3 and copied.a.r==6 and copied.nested.value==false)
`));

test("grenades arm once using their configured delay and simultaneous timers stay independent", () => run(setup + `
    local a=ents.Create("zp_infection_grenade"); local b=ents.Create("zp_infection_grenade")
    for _,grenade in ipairs({a,b}) do
        grenade:Spawn(); grenade:SetMode(ARM_ON_HIT_MODE); grenade:SetExplosionDelay(9)
        grenade:PhysicsCollide({},{}); grenade:PhysicsCollide({},{})
        assert(timers[grenade.Timer][1]==9)
    end
    assert(a.Timer~=b.Timer)
    timers[a.Timer][2](); assert(a.removed and not b.removed)
    b.removed=true; timers[b.Timer][2]()
`));
