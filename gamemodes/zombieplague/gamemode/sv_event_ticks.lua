-- Generated from src/gamemodes/zombieplague/gamemode/events/server/sv_event_ticks.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
end
-- End of Lua Library inline imports
local ____exports = {}
local rounds = RoundManager
_G.FlashlightShouldDrain = function() return cvars.Bool("zp_battery_flashlight_should_drain", false) or rounds:IsRealisticMod() end
_G.NightvisionShouldDrain = function() return cvars.Bool("zp_battery_nightvision_should_drain", false) or rounds:IsRealisticMod() end
_G.VoiceShouldDrain = function() return cvars.Bool("zp_battery_voice_should_drain", false) or rounds:IsRealisticMod() end
_G.WaterShouldDrain = function() return rounds:IsRealisticMod() or cvars.Bool("zp_water_should_drain", false) end
_G.RunShouldDrain = function(ply) return ply:GetWalkSpeed() ~= ply:GetRunSpeed() and (rounds:IsRealisticMod() or cvars.Bool("zp_run_should_drain", false)) end
for ____, ____value in ipairs({{"TickManager", 0.1}, {"HalfSecondTickManager", 0.5}, {"SecondTickManager", 1}}) do
    local id = ____value[1]
    local delay = ____value[2]
    timer.Create(
        id,
        delay,
        0,
        function()
            hook.Call(id)
        end
    )
end
hook.Add(
    "TickManager",
    "ZPReloadManager",
    function()
        local mode = cvars.Number("zp_clip_mode", 0)
        if mode ~= WMODE_INFINITE_CLIP and mode ~= WMODE_INFINITE then
            return
        end
        for ____, ply in ipairs(player.GetAll()) do
            do
                local __continue12
                repeat
                    if not ply:Alive() or not ply:IsHuman() then
                        __continue12 = true
                        break
                    end
                    local weapon = ply:GetActiveWeapon()
                    if not IsValid(weapon) or not WeaponManager:IsChosenWeapon(weapon:GetClass()) then
                        __continue12 = true
                        break
                    end
                    if mode == WMODE_INFINITE_CLIP then
                        if ply:GetAmmoCount(weapon:GetPrimaryAmmoType()) ~= weapon:GetMaxClip1() * 2 then
                            ply:SetAmmo(
                                weapon:GetMaxClip1() * 2,
                                weapon:GetPrimaryAmmoType()
                            )
                        end
                    else
                        weapon:SetClip1(weapon:GetMaxClip1())
                    end
                    __continue12 = true
                until true
                if not __continue12 then
                    break
                end
            end
        end
    end
)
hook.Add(
    "SecondTickManager",
    "ZPHealthRegenerator",
    function()
        if not cvars.Bool("zp_health_should_regen", true) then
            return
        end
        for ____, ply in ipairs(rounds:GetAliveZombies()) do
            if CurTime() - ply:GetLastDamage() > cvars.Number("zp_health_regen_time_delay", 20) and ply:Health() < ply:GetMaxHealth() then
                ply:SetHealth(math.min(
                    ply:Health() + cvars.Number("zp_health_regen", 10),
                    ply:GetMaxHealth()
                ))
            end
        end
    end
)
hook.Add(
    "SecondTickManager",
    "ZPAFKManager",
    function()
        for ____, ply in ipairs(rounds:GetAliveZombies()) do
            if CurTime() - ply:GetLastMove() > math.random(15, 30) then
                ply:ZPEmitSound(
                    SafeTableRandom(ZombieIdle),
                    2,
                    true
                )
                ply:SetLastMove(CurTime())
            end
        end
    end
)
hook.Add(
    "HalfSecondTickManager",
    "ZPBreathManager",
    function()
        for ____, ply in ipairs(rounds:GetPlayersToPlay()) do
            do
                local __continue29
                repeat
                    if not ply:Alive() then
                        __continue29 = true
                        break
                    end
                    local drain = WaterShouldDrain() and ply:WaterLevel() > 2 and cvars.Number("zp_water_drain", 1) or 0
                    if ply:IsHuman() and RunShouldDrain(ply) and ply:KeyDown(IN_SPEED) and __TS__ArraySome(
                        {IN_FORWARD, IN_BACK, IN_MOVELEFT, IN_MOVERIGHT},
                        function(____, key) return ply:KeyDown(key) end
                    ) then
                        drain = drain + cvars.Number("zp_run_drain", 1)
                    end
                    if drain > 0 then
                        if ply:GetBreath() > 0 then
                            ply:TakeBreath(drain)
                        else
                            hook.Call("ZPSuffocate", GAMEMODE, ply)
                        end
                    elseif ply:GetBreath() < ply:GetMaxBreath() then
                        ply:AddBreath(cvars.Number("zp_breath_recover", 1))
                    end
                    __continue29 = true
                until true
                if not __continue29 then
                    break
                end
            end
        end
    end
)
hook.Add(
    "ZPSuffocate",
    "ZPBreathDamage",
    function(ply)
        local damage = DamageInfo()
        damage:SetDamage(cvars.Number("zp_breath_damage", 5))
        damage:SetDamageType(DMG_DROWNRECOVER)
        ply:TakeDamageInfo(damage)
        ply:ScreenFade(
            SCREENFADE.IN,
            Color(255, 255, 255, 20),
            0.3,
            0
        )
        local sounds = ply:WaterLevel() > 2 and (ply:IsHuman() and HumanDrownSounds or ZombieDrownSounds) or (ply:IsHuman() and HumanSuffocateSound or ZombieSuffocateSound)
        ply:ZPEmitSound(
            SafeTableRandom(sounds),
            1
        )
    end
)
hook.Add(
    "TickManager",
    "GravityManager",
    function()
        for ____, ply in ipairs(rounds:GetPlayersToPlay()) do
            if ply:GetGravity() ~= ply:GetAuxGravity() then
                ply:SetGravity(ply:GetAuxGravity())
            end
        end
    end
)
hook.Add(
    "ZPCureEvent",
    "GetCuredEffect",
    function(ply) return ply:ScreenFade(
        SCREENFADE.IN,
        Color(0, 0, 255, 128),
        0.3,
        0
    ) end
)
hook.Add(
    "TickManager",
    "DrainManager",
    function()
        for ____, ply in ipairs(rounds:GetAliveHumans()) do
            local drain = 0
            if FlashlightShouldDrain() and ply:FlashlightIsOn() then
                drain = drain + cvars.Number("zp_battery_flashlight_drain", 1)
            end
            if NightvisionShouldDrain() and ply:NightvisionIsOn() then
                drain = drain + cvars.Number("zp_battery_nightvision_drain", 2)
            end
            if VoiceShouldDrain() and ply:IsTalking() then
                drain = drain + cvars.Number("zp_battery_voice_drain", 0.5)
            end
            if drain > 0 then
                if ply:GetBattery() > 0 then
                    ply:DrainBattery(drain)
                end
            elseif ply:GetBattery() < ply:GetMaxBatteryCharge() then
                ply:ChargeBattery(cvars.Number("zp_battery_charge", 0.5))
            end
        end
    end
)
local moveKeys = {
    IN_ATTACK,
    IN_ATTACK2,
    IN_BACK,
    IN_DUCK,
    IN_FORWARD,
    IN_JUMP,
    IN_MOVELEFT,
    IN_MOVERIGHT,
    IN_RELOAD,
    IN_SPEED,
    IN_USE,
    IN_WALK,
    IN_ZOOM,
    IN_WEAPON1,
    IN_WEAPON2
}
hook.Add(
    "SetupMove",
    "IdleManager",
    function(ply, move)
        if ply:Alive() and __TS__ArraySome(
            moveKeys,
            function(____, key) return move:KeyDown(key) end
        ) then
            ply:SetLastMove(CurTime())
        end
    end
)
hook.Add(
    "PlayerBatteryOver",
    "ZPBatteryOver",
    function(ply)
        if ply:FlashlightIsOn() then
            ply:Flashlight(false)
        end
        if ply:NightvisionIsOn() then
            ply:SetNightvision(false)
        end
    end
)
for ____, ____value in ipairs({{"ZPLastHumanEvent", "LastHumanHealth", "human"}, {"ZPLastZombieEvent", "LastZombieHealth", "zombie"}}) do
    local event = ____value[1]
    local id = ____value[2]
    local teamName = ____value[3]
    hook.Add(
        event,
        id,
        function()
            local mode = cvars.Number(("zp_last_" .. teamName) .. "_reward_mode", 0)
            local selected = SafeTableRandom(teamName == "human" and rounds:GetAliveHumans() or rounds:GetAliveZombies())
            if not selected or mode ~= 1 and mode ~= 2 then
                return
            end
            local enemies = teamName == "human" and rounds:CountZombiesAlive() or rounds:CountHumansAlive()
            selected:SetHealth(selected:Health() + (mode == 1 and enemies or 1) * cvars.Number(("zp_last_" .. teamName) .. "_reward_health", teamName == "human" and 10 or (mode == 1 and 250 or 25)))
        end
    )
end
return ____exports
