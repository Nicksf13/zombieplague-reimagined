-- Generated from src/gamemodes/zombieplague/gamemode/weapons/shared/weapon_grenade.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local weapon = SWEP
local infection = weapon.PrintName == "Infection Grenade"
weapon.Initialize = function(self)
    self.ID = (((infection and "InfectionGrenade" or "CureGrenade") .. tostring(self:EntIndex())) .. ":") .. tostring(CurTime())
    self:SetHoldType(infection and "grenade" or self.HoldType)
    self.ProjectileMode = EXPLODE_ON_HIT_MODE
    self.ProjectileDelay = 5
    if infection then
        timer.Create(
            "SetIdle" .. self.ID,
            0.1,
            1,
            function()
                if IsValid(self) then
                    self:SendWeaponAnim(ACT_VM_IDLE)
                end
            end
        )
    end
    if not infection and CLIENT then
        self:InitializeConstruction()
    end
end
weapon.PrimaryAttack = function(self)
    if not self:CanPrimaryAttack() or not IsValid(self.Owner) then
        return
    end
    if infection then
        self:SendWeaponAnim(ACT_VM_THROW)
        self.Owner:SetAnimation(PLAYER_ATTACK1)
        self:ShootGrenade()
    else
        self:ShootGrenade()
        self:SendWeaponAnim(ACT_VM_THROW)
        self.Owner:SetAnimation(PLAYER_ATTACK1)
    end
    if SERVER then
        timer.Create(
            self:WeaponReloadIdentifier(),
            0.3,
            1,
            function()
                if IsValid(self) and IsValid(self.Owner) then
                    self.Owner:StripWeapon(self:GetClass())
                end
            end
        )
    end
end
weapon.SecondaryAttack = function(self)
    if self.Reloading then
        return
    end
    self.ProjectileMode = (self.ProjectileMode + 1) % 3
    if infection then
        self:SendWeaponAnim(ACT_VM_SECONDARYATTACK)
    end
    if CLIENT then
        local ____infection_0
        if infection then
            ____infection_0 = SafeTableRandom(self.AlternateSounds)
        else
            ____infection_0 = self.AlternateSound
        end
        local sound = ____infection_0
        if sound then
            self:EmitSound(sound)
        end
        local phrase = self.ProjectileMode == EXPLODE_ON_HIT_MODE and "ZPGrenadeExplodeOnHit" or (self.ProjectileMode == ARM_ON_HIT_MODE and "ZPGrenadeArmOnHit" or "ZPGrenadeTimeMode")
        notification.AddLegacy(
            string.format(
                language.GetPhrase("zombieplague." .. string.lower(phrase)),
                self.ProjectileDelay
            ),
            NOTIFY_GENERIC,
            5
        )
    end
end
weapon.WeaponReloadIdentifier = function(self)
    return self.ID .. "Reload"
end
weapon.Reload = function(self)
    if not IsValid(self:GetOwner()) or self:Clip1() == self.Primary.ClipSize or self:GetOwner():GetAmmoCount(self.Primary.Ammo) <= 0 then
        return
    end
    local duration = infection and 2 or 1.5
    self.Reloading = true
    self:SetNextPrimaryFire(CurTime() + duration)
    self:DefaultReload(ACT_VM_DRAW)
    timer.Create(
        self:WeaponReloadIdentifier(),
        duration,
        1,
        function()
            if IsValid(self) then
                self.Reloading = false
            end
        end
    )
end
weapon.ShootGrenade = function(self)
    local owner = self:GetOwner()
    if not IsValid(owner) or CLIENT then
        return
    end
    local entity = ents.Create(infection and "zp_infection_grenade" or "zp_antidote_grenade")
    if not IsValid(entity) then
        return
    end
    entity:SetOwner(owner)
    entity:SetMode(self.ProjectileMode)
    local direction = owner:GetAimVector()
    local pos = Vector(direction.x * 40, direction.y * 40, direction.z * 40)
    pos:Add(owner:EyePos())
    entity:SetPos(pos)
    entity:Spawn()
    entity:SetExplosionDelay(self.ProjectileDelay)
    if self.ProjectileMode == TIME_MODE then
        entity:Arm()
    end
    local physics = entity:GetPhysicsObject()
    if not IsValid(physics) then
        entity:Remove()
        return
    end
    direction:Mul(infection and 1000 or 1500)
    direction:Add(VectorRand(-10, 10))
    physics:ApplyForceCenter(direction)
    self:TakePrimaryAmmo(1)
end
weapon.Deploy = function(self)
    if self:Clip1() == 0 and not self.Reloading then
        self:Reload()
    end
    if infection then
        timer.Create(
            "SetIdle" .. self.ID,
            0.1,
            1,
            function()
                if IsValid(self) then
                    self:SendWeaponAnim(ACT_VM_IDLE)
                end
            end
        )
    end
    return true
end
weapon.Holster = function(self)
    if not infection and CLIENT and IsValid(self.Owner) then
        local vm = self.Owner:GetViewModel()
        if IsValid(vm) then
            self:ResetBonePositions(vm)
        end
    end
    self.Reloading = false
    timer.Remove(self:WeaponReloadIdentifier())
    return true
end
if not infection then
    weapon.OnRemove = function(self)
        self:Holster()
        if CLIENT then
            self:RemoveConstructionModels()
        end
    end
end
return ____exports
