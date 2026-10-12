-- Generated from src/gamemodes/zombieplague/gamemode/player/server/sv_player_abilities.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local PLAYER = FindMetaTable("Player")
PLAYER.SetAbilityPower = function(self, AbilityPower)
    self.AbilityPower = AbilityPower
    net.Start("SendAbilityPower")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteInt(AbilityPower, 16)
    net.Broadcast()
end
PLAYER.GetAbilityPower = function(self)
    return self.AbilityPower or -1
end
PLAYER.DrainAbilityPower = function(self, Power)
    local AbilityPower = self:GetAbilityPower() - Power
    if AbilityPower <= 0 then
        AbilityPower = 0
        hook.Call(
            "PlayerAbilityPowerOver" .. self:SteamID64(),
            GAMEMODE
        )
    end
    self:SetAbilityPower(AbilityPower)
    self:AddRechargeOnAbilityPower(1)
end
PLAYER.AddRechargeOnAbilityPower = function(self, Amount)
    local RechargeAbilityPower = "RechargeAbilityPower" .. self:SteamID64()
    hook.Add(
        "SecondTickManager",
        RechargeAbilityPower,
        function()
            self:AddAbilityPower(Amount)
        end
    )
    local EventName = "ZPResetAbilityEvent" .. self:SteamID64()
    hook.Add(
        EventName,
        RechargeAbilityPower,
        function()
            hook.Remove("SecondTickManager", RechargeAbilityPower)
            hook.Remove(EventName, RechargeAbilityPower)
        end
    )
end
PLAYER.AddAbilityPower = function(self, Power)
    local AbilityPower = self:GetAbilityPower() + Power
    if AbilityPower >= self:GetMaxAbilityPower() then
        AbilityPower = self:GetMaxAbilityPower()
        hook.Remove(
            "SecondTickManager",
            "RechargeAbilityPower" .. self:SteamID64()
        )
    end
    self:SetAbilityPower(AbilityPower)
end
PLAYER.SetMaxAbilityPower = function(self, MaxAbilityPower)
    self.MaxAbilityPower = MaxAbilityPower
    net.Start("SendMaxAbilityPower")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteInt(MaxAbilityPower, 16)
    net.Broadcast()
end
PLAYER.GetMaxAbilityPower = function(self)
    return self.MaxAbilityPower or -1
end
PLAYER.SetAbilityTimer = function(self, TimerName, Seconds, TimerAction)
    local TimerNameWithSteamID64 = TimerName .. self:SteamID64()
    timer.Create(TimerNameWithSteamID64, Seconds, 1, TimerAction)
    local EventName = "ZPResetAbilityEvent" .. self:SteamID64()
    hook.Add(
        EventName,
        TimerNameWithSteamID64,
        function()
            timer.Destroy(TimerNameWithSteamID64)
            hook.Remove(EventName, TimerNameWithSteamID64)
        end
    )
end
return ____exports
