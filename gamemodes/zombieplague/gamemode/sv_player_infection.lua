-- Generated from src/gamemodes/zombieplague/gamemode/player/server/sv_player_infection.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local PLAYER = FindMetaTable("Player")
PLAYER.Infect = function(self, SilentInfection)
    local nextClass = self:GetNextZombieClass()
    if nextClass then
        self:SetZombieClass(nextClass)
    end
    local HoldingWeapon = self:GetActiveWeapon()
    if IsValid(HoldingWeapon) then
        self:DropWeapon(HoldingWeapon)
    end
    self:SetTeam(TEAM_ZOMBIES)
    self:StripWeapons()
    local ZombieClass
    if self:IsBot() then
        ZombieClass = SafeTableRandom(ClassManager:GetZombieClasses())
        if not ZombieClass then
            error("No zombie classes registered", 0)
        end
        self:SetZombieClass(ZombieClass)
    else
        ZombieClass = self:GetZombieClass()
    end
    if ZombieClass.Scale ~= nil then
        self:SetModelScale(ZombieClass.Scale, 0)
    end
    self:SetMaxHealth(ZombieClass.MaxHealth)
    self:SetHealth(ZombieClass.MaxHealth)
    self:SetWalkSpeed(ZombieClass.Speed)
    self:SetRunSpeed(cvars.Bool("zp_zombie_should_run", true) and ZombieClass.RunSpeed or ZombieClass.Speed)
    self:SetCrouchedWalkSpeed(ZombieClass.CrouchSpeed)
    self:SetAuxGravity(ZombieClass.Gravity)
    self:SetMaxBreath(ZombieClass.Breath)
    self:SetBreath(ZombieClass.Breath)
    self:SetJumpPower(ZombieClass.JumpPower)
    self:SetDamageAmplifier(ZombieClass.DamageAmplifier)
    self:SetFootstep((RoundManager:IsRealisticMod() or cvars.Bool("zp_zombie_footstep", false)) and ZombieClass.Footstep)
    if self:FlashlightIsOn() then
        self:Flashlight(false)
    end
    self:AllowFlashlight(false)
    self:SetModel(ZombieClass.PModel)
    self:SetupHands()
    if ZombieClass.WeaponGive then
        ZombieClass:WeaponGive(self)
    end
    if not SilentInfection then
        local sound = SafeTableRandom(InfectionSounds)
        if sound ~= nil then
            self:EmitSound(sound)
        end
    end
    local Ability = ZombieClass.Ability
    if Ability then
        self:SetMaxAbilityPower(Ability.MaxAbilityPower)
        self:SetAbilityPower(Ability.MaxAbilityPower)
        SendPopupMessage(self, {Phrase = "zombieplague.noticehashability"})
    else
        self:SetMaxAbilityPower(-1)
        self:SetAbilityPower(-1)
    end
    self:ScreenFade(
        SCREENFADE.IN,
        Color(0, 255, 0, 128),
        0.3,
        0
    )
    if cvars.Bool("zp_zombie_screen_filter", true) then
        self:SetScreenFilter(Color(255, 0, 0, 2))
    end
end
PLAYER.MakeHuman = function(self)
    local nextClass = self:GetNextHumanClass()
    if nextClass then
        self:SetHumanClass(nextClass)
    end
    self:SetTeam(TEAM_HUMANS)
    self:StripWeapons()
    local HumanClass
    if self:IsBot() then
        HumanClass = SafeTableRandom(ClassManager:GetHumanClasses())
        if not HumanClass then
            error("No human classes registered", 0)
        end
        self:SetHumanClass(HumanClass)
    else
        HumanClass = self:GetHumanClass()
    end
    self:SetMaxHealth(HumanClass.MaxHealth)
    if HumanClass.Armor ~= nil then
        self:SetArmor(HumanClass.Armor)
    end
    if HumanClass.Scale ~= nil then
        self:SetModelScale(HumanClass.Scale, 0)
    end
    self:SetHealth(HumanClass.MaxHealth)
    self:SetWalkSpeed(HumanClass.Speed)
    self:SetRunSpeed(HumanClass.RunSpeed)
    self:SetCrouchedWalkSpeed(HumanClass.CrouchSpeed)
    self:SetAuxGravity(HumanClass.Gravity)
    self:SetJumpPower(HumanClass.JumpPower)
    self:SetModel(HumanClass.PModel)
    self:SetMaxBreath(HumanClass.Breath)
    self:SetBreath(HumanClass.Breath)
    self:SetMaxBatteryCharge(HumanClass.Battery or 100)
    self:SetDamageAmplifier(HumanClass.DamageAmplifier)
    self:SetFootstep(HumanClass.Footstep)
    self:AllowFlashlight(true)
    self:SetupHands()
    self:SetPrimaryWeaponGiven(false)
    self:SetSecondaryWeaponGiven(false)
    self:SetMeleeWeaponGiven(false)
    if not self:IsBot() then
        local primary = self:GetPrimaryWeapon()
        local secondary = self:GetSecondaryWeapon()
        local melee = self:GetMeleeWeapon()
        if primary then
            self:GiveWeapon(primary)
            self:SetPrimaryWeaponGiven(true)
        end
        if secondary then
            self:GiveWeapon(secondary)
            self:SetSecondaryWeaponGiven(true)
        end
        if melee then
            self:GiveWeapon(melee)
            self:SetMeleeWeaponGiven(true)
        end
    else
        local weapon = SafeTableRandom(WeaponManager:GetWeaponsTableByWeaponType(WEAPON_PRIMARY))
        if weapon then
            self:GiveWeapon(weapon)
        end
    end
    local Ability = HumanClass.Ability
    if Ability then
        self:SetMaxAbilityPower(Ability.MaxAbilityPower)
        self:SetAbilityPower(Ability.MaxAbilityPower)
        SendPopupMessage(self, {Phrase = "zombieplague.noticehashability"})
    else
        self:SetMaxAbilityPower(-1)
        self:SetAbilityPower(-1)
    end
    if cvars.Bool("zp_zombie_screen_filter", true) then
        self:SetScreenFilter(nil)
    end
end
PLAYER.Cure = function(self)
    self:MakeHuman()
    local sound = SafeTableRandom(CureSounds)
    if sound ~= nil then
        self:EmitSound(sound)
    end
end
PLAYER.MakeNemesis = function(self)
    self:Infect()
    local HealthMode = cvars.Number("zp_nemesis_health_mode", 0)
    if HealthMode == 1 then
        local Health = self:Health() + RoundManager:CountHumansAlive() * cvars.Number("zp_nemesis_health_player", 500)
        self:SetHealth(Health)
        self:SetMaxHealth(Health)
    elseif HealthMode == 2 then
        self:SetHealth(cvars.Number("zp_nemesis_health", 3000))
        self:SetMaxHealth(cvars.Number("zp_nemesis_health", 3000))
    else
        self:SetHealth(NemesisClass.Health)
        self:SetMaxHealth(NemesisClass.Health)
    end
    if not cvars.Bool("zp_nemesis_earn", false) then
        self:SetWalkSpeed(NemesisClass.Speed)
        self:SetRunSpeed(NemesisClass.RunSpeed)
        self:SetCrouchedWalkSpeed(NemesisClass.CrouchedSpeed)
        self:SetAuxGravity(NemesisClass.Gravity)
    end
    if not cvars.Bool("zp_nemesis_override_player_mode", false) then
        self:SetModel(NemesisClass.PlayerModel)
    end
    self:SetFootstep(true)
    self:SetDamageAmplifier(cvars.Number("zp_nemesis_damage", 10))
    self:SetLight(NEMESIS_COLOR)
    self:SetNemesis(true)
end
PLAYER.MakeSurvivor = function(self)
    local HealthMode = cvars.Number("zp_survivor_health_mode", 1)
    if HealthMode == 1 then
        self:SetHealth(self:Health() + RoundManager:CountZombiesAlive() * cvars.Number("zp_survivor_health_player", 30))
    elseif HealthMode == 2 then
        self:SetHealth(cvars.Number("zp_survivor_health", 3000))
    else
        self:SetHealth(SurvivorClass.Health)
    end
    if not cvars.Bool("zp_survivor_earn", false) then
        self:SetWalkSpeed(SurvivorClass.Speed)
        self:SetRunSpeed(SurvivorClass.RunSpeed)
        self:SetCrouchedWalkSpeed(SurvivorClass.CrouchedSpeed)
        self:SetAuxGravity(SurvivorClass.Gravity)
    end
    if not cvars.Bool("zp_survivor_override_player_mode", false) then
        self:SetModel(SurvivorClass.PlayerModel)
    end
    self:SetFootstep(false)
    self:SetDamageAmplifier(cvars.Number("zp_survivor_damage", 2))
    self:SetLight(SURVIVOR_COLOR)
    self:SetSurvivor(true)
end
return ____exports
