-- Generated from src/gamemodes/zombieplague/gamemode/events/server/sv_event_combat.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
hook.Add(
    "ZPDamageAttackerIsPlayer",
    "HandlePlayerDamage",
    function(attacker, target, damage)
        local multiplier = WeaponManager:GetWeaponMultiplier(damage:GetInflictor():GetClass())
        if multiplier == nil and attacker:Alive() and IsValid(attacker:GetActiveWeapon()) then
            multiplier = WeaponManager:GetWeaponMultiplier(attacker:GetActiveWeapon():GetClass())
        end
        damage:ScaleDamage(multiplier or 1)
        damage:ScaleDamage(attacker:GetDamageAmplifier())
        if target:IsPlayer() then
            hook.Call(
                attacker:IsZombie() and "ZPZombieInflictedDamageOnPlayer" or "ZPHumanInflictedDamageOnPlayer",
                GAMEMODE,
                attacker,
                target,
                damage
            )
        else
            damage:ScaleDamage(cvars.Number("zp_map_prop_damage_multiplier", 1))
        end
    end
)
hook.Add(
    "ZPZombieTakeDamage",
    "HandleZombieDamage",
    function(target, damage)
        local sounds = damage:IsDamageType(DMG_FALL) and FallDamageSounds or (damage:IsDamageType(DMG_BURN) and BurnDamageSounds or (target:IsNemesis() and NemesisDamageSounds or GenericDamageSounds))
        if not damage:IsDamageType(DMG_FALL) or damage:GetDamage() > 0 then
            target:ZPEmitSound(
                SafeTableRandom(sounds),
                1
            )
        end
    end
)
hook.Add(
    "ZPZombieInflictedDamageOnPlayer",
    "HandleZombieCausingDamage",
    function(attacker, target, damage)
        if RoundManager:IsRealisticMod() or RoundManager:GetRoundState() == ROUND_PLAYING then
            local amount = target:TakeArmorDamage(damage:GetDamage())
            damage:SetDamage(amount > 0 and (target:IsHuman() or cvars.Bool("zp_friendly_fire", false) and target:IsZombie()) and amount or 0)
            if not RoundManager:IsSpecialRound() and not RoundManager:LastHuman() and not target:IsZombie() and amount > 0 then
                InfectionManager:Infect(target, attacker)
                damage:SetDamage(0)
            end
        else
            damage:SetDamage(0)
        end
    end
)
hook.Add(
    "ZPHumanInflictedDamageOnPlayer",
    "HandleHumanCausingDamage",
    function(attacker, target, damage)
        if target:IsZombie() then
            attacker:AddTotalDamage(damage:GetDamage())
            hook.Call(
                "ZPHumanDamage",
                GAMEMODE,
                target,
                attacker,
                damage
            )
        end
    end
)
GM.EntityTakeDamage = function(self, target, damage)
    local attacker = damage:GetAttacker()
    if attacker:IsPlayer() then
        if not RoundManager:IsRealisticMod() and target:IsPlayer() and RoundManager:GetRoundState() ~= ROUND_PLAYING then
            return true
        end
        hook.Call(
            "ZPDamageAttackerIsPlayer",
            GAMEMODE,
            attacker,
            target,
            damage
        )
    end
    if target:IsPlayer() then
        if target:IsZombie() and damage:GetDamage() > 0 then
            hook.Call("ZPZombieTakeDamage", GAMEMODE, target, damage)
        end
        target:TakeLastDamage()
    end
    return nil
end
GM.GetFallDamage = function(self, ply, speed)
    return ply:ShouldTakeFallDamage() and math.max(
        0,
        math.ceil(0.2418 * speed - 141.75)
    ) or 0
end
GM.PlayerShouldTakeDamage = function(self, ply, attacker)
    if cvars.Bool("zp_realistic_mode", false) then
        return true
    end
    if RoundManager:GetRoundState() ~= ROUND_PLAYING then
        return false
    end
    return not attacker:IsPlayer() or cvars.Bool("zp_friendly_fire", false) or attacker:Team() ~= ply:Team()
end
GM.AllowPlayerPickup = function(self)
    return false
end
GM.PlayerDeathSound = function(self)
    return true
end
GM.CanPlayerSuicide = function(self)
    return false
end
GM.PlayerShouldTaunt = function(self)
    return false
end
return ____exports
