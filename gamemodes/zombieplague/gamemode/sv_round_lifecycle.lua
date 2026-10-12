-- Generated from src/gamemodes/zombieplague/gamemode/rounds/server/sv_round_lifecycle.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
local manager = RoundManager
manager.SetTimer = function(self, seconds, callback)
    timer.Destroy("ZombiePlagueTimer")
    timer.Create("ZombiePlagueTimer", seconds, 1, callback)
    net.Start("SyncTimer")
    net.WriteInt(seconds, 16)
    net.Broadcast()
end
manager.GetTime = function(self)
    return timer.TimeLeft("ZombiePlagueTimer") or 0
end
manager.CheckRoundEnd = function(self)
    local current = self:GetCurrentRoundPlaying()
    if not current then
        return
    end
    if current.Respawn and current.RoundEndFunction then
        current:RoundEndFunction()
    else
        local humans = self:CountHumansAlive()
        local zombies = self:CountZombiesAlive()
        if humans == 0 and zombies == 0 then
            self:EndRound(ROUND_DRAW)
        elseif humans == 0 then
            self:EndRound(ZOMBIES_WIN)
        elseif zombies == 0 then
            self:EndRound(HUMANS_WIN)
        end
    end
end
manager.WaitPlayers = function(self)
    timer.Destroy("ZombiePlagueTimer")
    self:SetRoundState(ROUND_WAITING_PLAYERS)
end
manager.Prepare = function(self)
    if self:CountPlayersToPlay() < cvars.Number("zp_min_players", 2) then
        return false
    end
    hook.Call("ZPPrePreparingRound")
    game.CleanUpMap()
    self:SetRoundState(ROUND_STARTING_NEW_ROUND)
    for ____, ply in ipairs(self:GetPlayersToPlay()) do
        ply:SetNemesis(false)
        ply:SetSurvivor(false)
        ply:SetLight(nil)
        ply:ResetZombieAllowedWeapons()
        ply:SetTeam(TEAM_HUMANS)
        ply:Spawn()
    end
    hook.Call("ZPPostPreparingRound")
    return true
end
manager.FreezePlayer = function(self, ply)
    ply:SetWalkSpeed(1)
    ply:SetRunSpeed(1)
    ply:SetCrouchedWalkSpeed(1)
    ply:SetJumpPower(1)
end
manager.UnfreezePlayer = function(self, ply)
    local definition = ply:IsHuman() and ply:GetHumanClass() or ply:GetZombieClass()
    ply:SetWalkSpeed(definition.Speed)
    ply:SetRunSpeed(definition.RunSpeed)
    ply:SetCrouchedWalkSpeed(definition.CrouchSpeed)
    ply:SetJumpPower(definition.JumpPower)
end
manager.FreezeTime = function(self)
    for ____, ply in ipairs(self:GetAlivePlayers()) do
        self:FreezePlayer(ply)
    end
    self:SetTimer(
        cvars.Number("zp_freeze_time_delay", 10),
        function()
            for ____, ply in ipairs(player.GetAll()) do
                self:UnfreezePlayer(ply)
            end
            local delay = cvars.Number("zp_infection_delay", 10)
            if delay > 0 then
                local count = math.min(delay, #CountDownSound)
                timer.Create(
                    "NoSoundInfectionDelayTimer",
                    math.max(delay - #CountDownSound, 0),
                    1,
                    function()
                        local unfreeze = SafeTableRandom(UnfreezeSounds)
                        local first = CountDownSound[count]
                        if unfreeze then
                            BroadcastSound(unfreeze)
                        end
                        if first then
                            BroadcastSound(first)
                        end
                        if count > 0 then
                            timer.Create(
                                "TimerSound",
                                1,
                                count,
                                function()
                                    local left = timer.RepsLeft("TimerSound")
                                    local ____temp_0
                                    if left ~= nil and left > 0 then
                                        ____temp_0 = CountDownSound[left]
                                    else
                                        ____temp_0 = nil
                                    end
                                    local sound = ____temp_0
                                    if sound then
                                        BroadcastSound(sound)
                                    end
                                end
                            )
                        end
                    end
                )
            end
            self:SetTimer(
                delay,
                function() return self:NewRound() end
            )
        end
    )
end
manager.TryNewRound = function(self)
    if self:Prepare() then
        self:FreezeTime()
    else
        self:WaitPlayers()
    end
    for ____, ply in ipairs(player.GetAll()) do
        hook.Call(
            "ZPResetAbilityEvent" .. ply:SteamID64(),
            GAMEMODE
        )
    end
end
manager.NewRound = function(self)
    local candidates = {}
    local players = self:CountPlayersToPlayAlive()
    local total = 0
    for ____, round in pairs(self:GetRounds()) do
        if players >= round.MinPlayers and round.Chance > 0 then
            total = total + round.Chance
            candidates[#candidates + 1] = round
        end
    end
    if total <= 0 then
        self:TryNewRound()
        return
    end
    local dice = math.random(1, total)
    local floor = 1
    for ____, round in ipairs(candidates) do
        floor = floor + round.Chance
        if dice < floor then
            self:StartRound(round)
            return
        end
    end
end
manager.RestartRound = function(self)
    self:SetTimer(
        cvars.Number("zp_newround_delay", 10),
        function() return self:TryNewRound() end
    )
    self:SetRoundState(ROUND_RESTARTING)
    hook.Call("ZPRestartRound")
end
manager.EndRound = function(self, reason)
    net.Start("SendRoundEnd")
    net.WriteInt(reason, 4)
    net.Broadcast()
    local phrase = reason == ZOMBIES_WIN and "ZombiesWin" or (reason == HUMANS_WIN and "HumansWin" or "RoundDraw")
    for ____, ply in ipairs(player.GetAll()) do
        SendNotifyMessage(
            ply,
            {Phrase = "zombieplague." .. string.lower(phrase)},
            5,
            Color(0, 255, 0)
        )
    end
    local sound = SafeTableRandom(reason == ZOMBIES_WIN and ZombieWinSounds or (reason == HUMANS_WIN and HumanWinSounds or DrawSounds))
    if sound then
        BroadcastSound(sound)
    end
    if self:RoundsLeft() > 0 then
        self:SetRoundState(ROUND_ENDING)
        self:SetTimer(
            cvars.Number("zp_newround_delay", 10),
            function() return self:TryNewRound() end
        )
    else
        ZPVoteMap:StartVotemap(ALLOWED_PREFIX)
    end
    hook.Call("ZPEndRound", GAMEMODE, reason)
end
manager.StartRound = function(self, round, selected)
    hook.Call("ZPPreNewRound", GAMEMODE, round)
    round.StartFunction(selected)
    local ____self_SetSpecialRound_2 = self.SetSpecialRound
    local ____round_SpecialRound_1 = round.SpecialRound
    if ____round_SpecialRound_1 == nil then
        ____round_SpecialRound_1 = false
    end
    ____self_SetSpecialRound_2(self, ____round_SpecialRound_1)
    local ____self_SetRespawn_4 = self.SetRespawn
    local ____round_Respawn_3 = round.Respawn
    if ____round_Respawn_3 == nil then
        ____round_Respawn_3 = false
    end
    ____self_SetRespawn_4(self, ____round_Respawn_3)
    local sound = round.StartSound and SafeTableRandom(round.StartSound)
    if sound then
        BroadcastSound(sound)
    end
    self:SetTimer(
        cvars.Number("zp_round_time", 300),
        function() return self:EndRound(ROUND_DRAW) end
    )
    self:SetRound(self:GetRound() + 1)
    self:SetRoundState(ROUND_PLAYING)
    self.RoundPlaying = round
    hook.Call(
        "ZPNewRound",
        GAMEMODE,
        round,
        self:GetRound()
    )
end
return ____exports
