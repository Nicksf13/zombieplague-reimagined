-- Generated from src/gamemodes/zombieplague/gamemode/weapons/shared/sweps/zp_weapon_fists.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__ObjectAssign(target, ...)
    local sources = {...}
    for i = 1, #sources do
        local source = sources[i]
        if type(source) == "table" then
            for key in pairs(source) do
                target[key] = source[key]
            end
        end
    end
    return target
end
-- End of Lua Library inline imports
local ____exports = {}
AddCSLuaFile()
SWEP.PrintName = "Fists"
SWEP.Author = "Kilburn, robotboy655, MaxOfS2D & Tenrys"
SWEP.Purpose = "Well we sure as hell didn't use guns! We would just wrestle Hunters to the ground with our bare hands! I used to kill ten, twenty a day, just using my fists."
SWEP.Slot = 0
SWEP.SlotPos = 4
SWEP.Spawnable = true
SWEP.ViewModel = Model("models/weapons/c_arms.mdl")
SWEP.WorldModel = ""
SWEP.ViewModelFOV = 54
SWEP.UseHands = true
SWEP.Primary.ClipSize = -1
SWEP.Primary.DefaultClip = -1
SWEP.Primary.Automatic = true
SWEP.Primary.Ammo = "none"
SWEP.Secondary.ClipSize = -1
SWEP.Secondary.DefaultClip = -1
SWEP.Secondary.Automatic = true
SWEP.Secondary.Ammo = "none"
SWEP.DrawAmmo = false
SWEP.HitDistance = 40
local hitSound = Sound("Flesh.ImpactHard")
local function scaled(vector, scale)
    return Vector(vector.x * scale, vector.y * scale, vector.z * scale)
end
local function sum(a, b)
    return Vector(a.x + b.x, a.y + b.y, a.z + b.z)
end
SWEP.Initialize = function(self)
    self:SetHoldType("fist")
end
SWEP.SetupDataTables = function(self)
    self:NetworkVar("Float", 0, "NextMeleeAttack")
    self:NetworkVar("Float", 1, "NextIdle")
    self:NetworkVar("Int", 2, "Combo")
end
SWEP.UpdateNextIdle = function(self)
    local vm = self.Owner:GetViewModel()
    self:SetNextIdle(CurTime() + vm:SequenceDuration() / vm:GetPlaybackRate())
end
SWEP.PrimaryAttack = function(self, right)
    if not IsValid(self.Owner) then
        return
    end
    self.Owner:SetAnimation(PLAYER_ATTACK1)
    local anim = self:GetCombo() >= 2 and "fists_uppercut" or (right and "fists_right" or "fists_left")
    local vm = self.Owner:GetViewModel()
    vm:SendViewModelMatchingSequence(vm:LookupSequence(anim))
    local sound = SafeTableRandom(ZombieKnifeSound)
    if sound then
        self:EmitSound(sound)
    end
    self:UpdateNextIdle()
    self:SetNextMeleeAttack(CurTime() + 0.2)
    self:SetNextPrimaryFire(CurTime() + 0.4)
    self:SetNextSecondaryFire(CurTime() + 0.4)
end
SWEP.SecondaryAttack = function(self)
    self:PrimaryAttack(true)
end
SWEP.DealDamage = function(self)
    if not IsValid(self.Owner) then
        return
    end
    local owner = self.Owner
    local anim = self:GetSequenceName(owner:GetViewModel():GetSequence())
    if SERVER then
        owner:LagCompensation(true)
    end
    local options = {
        start = owner:GetShootPos(),
        endpos = sum(
            owner:GetShootPos(),
            scaled(
                owner:GetAimVector(),
                self.HitDistance
            )
        ),
        filter = owner,
        mask = MASK_SHOT_HULL
    }
    local trace = util.TraceLine(options)
    if not IsValid(trace.Entity) then
        trace = util.TraceHull(__TS__ObjectAssign(
            {},
            options,
            {
                mins = Vector(-10, -10, -8),
                maxs = Vector(10, 10, 8)
            }
        ))
    end
    if trace.Hit and not (game.SinglePlayer() and CLIENT) then
        self:EmitSound(hitSound)
    end
    local hit = false
    if SERVER and IsValid(trace.Entity) and (trace.Entity:IsNPC() or trace.Entity:IsPlayer() or trace.Entity:Health() > 0) then
        local damage = DamageInfo()
        damage:SetAttacker(IsValid(owner) and owner or self)
        damage:SetInflictor(self)
        damage:SetDamage(math.random(8, 12))
        if anim == "fists_left" then
            damage:SetDamageForce(sum(
                scaled(
                    owner:GetRight(),
                    4912
                ),
                scaled(
                    owner:GetForward(),
                    9998
                )
            ))
        elseif anim == "fists_right" then
            damage:SetDamageForce(sum(
                scaled(
                    owner:GetRight(),
                    -4912
                ),
                scaled(
                    owner:GetForward(),
                    9989
                )
            ))
        elseif anim == "fists_uppercut" then
            damage:SetDamageForce(sum(
                scaled(
                    owner:GetUp(),
                    5158
                ),
                scaled(
                    owner:GetForward(),
                    10012
                )
            ))
            damage:SetDamage(math.random(12, 24))
        end
        trace.Entity:TakeDamageInfo(damage)
        hit = true
    end
    if SERVER and IsValid(trace.Entity) then
        local physics = trace.Entity:GetPhysicsObject()
        if IsValid(physics) then
            physics:ApplyForceOffset(
                scaled(
                    owner:GetAimVector(),
                    80 * physics:GetMass()
                ),
                trace.HitPos
            )
        end
    end
    if SERVER then
        self:SetCombo(hit and anim ~= "fists_uppercut" and self:GetCombo() + 1 or 0)
        owner:LagCompensation(false)
    end
end
SWEP.OnDrop = function(self)
    self:Remove()
end
SWEP.Deploy = function(self)
    if not IsValid(self.Owner) then
        return false
    end
    local speed = GetConVarNumber("sv_defaultdeployspeed")
    local vm = self.Owner:GetViewModel()
    vm:SendViewModelMatchingSequence(vm:LookupSequence("fists_draw"))
    vm:SetPlaybackRate(speed)
    self:SetNextPrimaryFire(CurTime() + vm:SequenceDuration() / speed)
    self:SetNextSecondaryFire(CurTime() + vm:SequenceDuration() / speed)
    self:UpdateNextIdle()
    if SERVER then
        self:SetCombo(0)
    end
    return true
end
SWEP.Think = function(self)
    if not IsValid(self.Owner) then
        return
    end
    local vm = self.Owner:GetViewModel()
    local idle = self:GetNextIdle()
    local melee = self:GetNextMeleeAttack()
    if idle > 0 and CurTime() > idle then
        vm:SendViewModelMatchingSequence(vm:LookupSequence("fists_idle_0" .. tostring(math.random(1, 2))))
        self:UpdateNextIdle()
    end
    if melee > 0 and CurTime() > melee then
        self:DealDamage()
        self:SetNextMeleeAttack(0)
    end
    if SERVER and CurTime() > self:GetNextPrimaryFire() + 0.1 then
        self:SetCombo(0)
    end
end
return ____exports
