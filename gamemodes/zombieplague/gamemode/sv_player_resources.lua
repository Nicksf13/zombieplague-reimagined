-- Generated from src/gamemodes/zombieplague/gamemode/player/server/sv_player_resources.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local PLAYER = FindMetaTable("Player")
PLAYER.GiveAmmoPacks = function(self, Amount)
    self:SetAmmoPacks(self:GetAmmoPacks() + Amount)
end
PLAYER.TakeAmmoPacks = function(self, Amount)
    self:SetAmmoPacks(self:GetAmmoPacks() - Amount)
end
PLAYER.SetAmmoPacks = function(self, AmmoPacks, NotSave)
    self.AmmoPacks = AmmoPacks
    net.Start("SendAmmoPacks")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteInt(AmmoPacks, 32)
    net.Broadcast()
    if not NotSave and Bank.ShouldSaveAmmoPacks then
        Bank:SetPlayerAmmoPacks(self, AmmoPacks)
    end
end
PLAYER.GetAmmoPacks = function(self)
    return self.AmmoPacks or 0
end
PLAYER.ChargeBattery = function(self, Amount)
    Amount = self:GetBattery() + Amount
    if Amount > self:GetMaxBatteryCharge() then
        Amount = self:GetMaxBatteryCharge()
    end
    self:SetBattery(Amount)
    if Amount == self:GetMaxBatteryCharge() then
        hook.Call("PlayerBatteryCharge", GAMEMODE, self)
    end
end
PLAYER.DrainBattery = function(self, Amount)
    Amount = self:GetBattery() - Amount
    if Amount < 0 then
        Amount = 0
    end
    self:SetBattery(Amount)
    if Amount == 0 then
        hook.Call("PlayerBatteryOver", GAMEMODE, self)
    end
end
PLAYER.SetBattery = function(self, Battery)
    self.Battery = Battery
    net.Start("SendBatteryCharge")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteFloat(Battery)
    net.Broadcast()
end
PLAYER.GetBattery = function(self)
    return self.Battery or self:GetMaxBatteryCharge()
end
PLAYER.SetMaxBatteryCharge = function(self, MaxCharge)
    self.MaxCharge = MaxCharge
    net.Start("SendMaxBatteryCharge")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteFloat(MaxCharge)
    net.Broadcast()
end
PLAYER.GetMaxBatteryCharge = function(self)
    return self.MaxCharge or 100
end
PLAYER.AddBreath = function(self, Breath)
    self:SetBreath(self:GetBreath() + Breath)
end
PLAYER.TakeBreath = function(self, Breath)
    self:SetBreath(self:GetBreath() - Breath)
end
PLAYER.SetBreath = function(self, Breath)
    if Breath <= 0 then
        Breath = 0
        local DmgInfo = DamageInfo()
        DmgInfo:SetDamage(cvars.Number("zp_breath_damage", 5))
        DmgInfo:SetDamageType(DMG_DROWNRECOVER)
        self:TakeDamageInfo(DmgInfo)
    elseif Breath > self:GetMaxBreath() then
        Breath = self:GetMaxBreath()
    end
    self.Breath = Breath
    net.Start("SendBreath")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteFloat(Breath)
    net.Broadcast()
end
PLAYER.GetBreath = function(self)
    return self.Breath or 100
end
PLAYER.SetMaxBreath = function(self, MaxBreath)
    self.MaxBreath = MaxBreath
    net.Start("SendMaxBreath")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteFloat(MaxBreath)
    net.Broadcast()
end
PLAYER.GetMaxBreath = function(self)
    return self.MaxBreath or 100
end
PLAYER.SetNightvision = function(self, Nightvision)
    self.Nightvision = Nightvision
    if self:Alive() and self:IsHuman() then
        if RoundManager:IsRealisticMod() then
            if Nightvision then
                self:EmitSound(NIGHTVISION_ON_SOUND, 75, 100, 0.25)
            elseif not self:NightvisionIsOn() then
                self:EmitSound(NIGHTVISION_OFF_SOUND, 75, 100, 0.25)
            end
        else
            if Nightvision then
                SendSound(self, NIGHTVISION_ON_SOUND)
            elseif not self:NightvisionIsOn() then
                SendSound(self, NIGHTVISION_OFF_SOUND)
            end
        end
    end
    net.Start("SendNightvision")
    net.WriteBool(Nightvision)
    net.Send(self)
end
PLAYER.NightvisionIsOn = function(self)
    return self.Nightvision
end
return ____exports
