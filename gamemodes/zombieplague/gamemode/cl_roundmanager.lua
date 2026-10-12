-- Generated from src/gamemodes/zombieplague/gamemode/rounds/client/cl_roundmanager.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local manager = RoundManager
manager.SetTimer = function(self, seconds)
    self.Timer = CurTime() + seconds
end
manager.GetTimer = function(self)
    local remaining = (self.Timer or 0) - CurTime()
    return remaining < 0 and 0 or remaining
end
net.Receive(
    "SyncTimer",
    function() return manager:SetTimer(net.ReadInt(16)) end
)
net.Receive(
    "SendRoundEnd",
    function()
        hook.Call(
            "ZombiePlagueEndRound",
            GAMEMODE,
            net.ReadInt(4)
        )
    end
)
return ____exports
