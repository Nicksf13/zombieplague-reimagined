-- Generated from src/gamemodes/zombieplague/gamemode/player/server/sv_player_state.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local PLAYER = FindMetaTable("Player")
PLAYER.SetFootstep = function(self, Footstep)
    self.Footstep = Footstep
    net.Start("SendFoostep")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteBool(Footstep)
    net.Broadcast()
end
PLAYER.GetFootstep = function(self)
    return self.Footstep
end
PLAYER.SetTalking = function(self, Talking)
    self.Talking = Talking
end
PLAYER.IsTalking = function(self)
    local ____self_Talking_0 = self.Talking
    if ____self_Talking_0 == nil then
        ____self_Talking_0 = false
    end
    return ____self_Talking_0
end
PLAYER.SetLastMove = function(self, LastMove)
    self.LastMove = LastMove
end
PLAYER.GetLastMove = function(self)
    return self.LastMove or CurTime() + 1
end
PLAYER.MoveSpectateID = function(self, Move, Players)
    if #Players == 0 then
        return
    end
    self.SpectateID = (self:GetSpectateID() + Move + #Players) % #Players
    local target = Players[self:GetSpectateID() + 1]
    if not target then
        return
    end
    self:SpectateEntity(target)
    self:SetupHands(target)
end
PLAYER.GetSpectateID = function(self)
    return self.SpectateID or 1
end
PLAYER.SetAuxGravity = function(self, AuxGravity)
    self.AuxGravity = AuxGravity
end
PLAYER.GetAuxGravity = function(self)
    return self.AuxGravity or 1
end
PLAYER.SetNemesis = function(self, Nemesis)
    self.Nemesis = Nemesis
    net.Start("SendNemesis")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteBool(Nemesis)
    net.Broadcast()
end
PLAYER.IsNemesis = function(self)
    return self.Nemesis
end
PLAYER.SetSurvivor = function(self, Survivor)
    self.Survivor = Survivor
    net.Start("SendSurvivor")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteBool(Survivor)
    net.Broadcast()
end
PLAYER.IsSurvivor = function(self)
    return self.Survivor
end
PLAYER.IsHuman = function(self)
    return self:Team() == TEAM_HUMANS
end
PLAYER.IsZombie = function(self)
    return self:Team() == TEAM_ZOMBIES
end
PLAYER.ZPEmitSound = function(self, SoundPath, DelayTime, Force)
    if SoundPath then
        if self:ZPCanEmitSound() or Force then
            self.ZPEmit = CurTime() + DelayTime
            self:EmitSound(SoundPath)
        end
    end
end
PLAYER.ZPCanEmitSound = function(self)
    return CurTime() > (self.ZPEmit or 0)
end
PLAYER.SetLight = function(self, Light)
    net.Start("SendLight")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteBool(not not Light)
    if Light then
        net.WriteColor(Light)
    end
    net.Broadcast()
    self.Light = Light
end
PLAYER.GetLight = function(self)
    return self.Light
end
PLAYER.SetScreenFilter = function(self, ScreenFilter)
    net.Start("SendScreenFilter")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteBool(not not ScreenFilter)
    if ScreenFilter then
        net.WriteColor(ScreenFilter)
    end
    net.Broadcast()
    self.ScreenFilter = ScreenFilter
end
PLAYER.AddPoints = function(self, PointsToAdd)
    self:SetPoints(self:GetPoints() + PointsToAdd)
end
PLAYER.RemovePoints = function(self, PointsToRemove)
    self:SetPoints(self:GetPoints() - PointsToRemove)
end
PLAYER.SetPoints = function(self, Points)
    net.Start("SendPoints")
    net.WriteString(PlayerManager:GetPlayerID(self))
    net.WriteInt(Points, 32)
    net.Broadcast()
    self.Points = Points
end
PLAYER.GetPoints = function(self)
    return self.Points or 0
end
return ____exports
