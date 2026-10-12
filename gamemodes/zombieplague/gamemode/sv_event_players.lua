-- Generated from src/gamemodes/zombieplague/gamemode/events/server/sv_event_players.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__ArrayIncludes(self, searchElement, fromIndex)
    if fromIndex == nil then
        fromIndex = 0
    end
    local len = #self
    local k = fromIndex
    if fromIndex < 0 then
        k = len + fromIndex
    end
    if k < 0 then
        k = 0
    end
    for i = k + 1, len do
        if self[i] == searchElement then
            return true
        end
    end
    return false
end
-- End of Lua Library inline imports
local ____exports = {}
local rounds = RoundManager
GM.PlayerCanHearPlayersVoice = function(self, listener, talker)
    if not rounds:IsPlayingRound() then
        return true
    end
    if rounds:IsRealisticMod() then
        return listener:Team() == talker:Team() and listener:Alive() == talker:Alive()
    end
    if not listener:Alive() then
        return true
    end
    if not cvars.Bool("zp_voice_all", true) and listener:Team() ~= talker:Team() then
        return false
    end
    return cvars.Bool("zp_can_hear_death", true) or listener:Alive() == talker:Alive()
end
GM.PlayerCanSeePlayersChat = function(self, _text, teamTalk, listener, talker)
    if not rounds:IsPlayingRound() then
        return true
    end
    if rounds:IsRealisticMod() then
        return listener:Team() == talker:Team() and listener:Alive() == talker:Alive()
    end
    if not listener:Alive() then
        return not teamTalk or listener:Team() == talker:Team()
    end
    if (teamTalk or not cvars.Bool("zp_chat_all", true)) and listener:Team() ~= talker:Team() then
        return false
    end
    return cvars.Bool("zp_can_see_death", true) or listener:Alive() == talker:Alive()
end
GM.PlayerSpawn = function(self, ply)
    if ply.FirstSpawn then
        if ply:Team() ~= TEAM_SPECTATOR then
            ply:UnSpectate()
            hook.Call("PlayerSetModel", GAMEMODE, ply)
            hook.Call("PlayerLoadout", GAMEMODE, ply)
        end
    else
        ply:KillSilent()
        ply:Spectate(6)
        ply.FirstSpawn = true
    end
end
GM.PlayerDeathThink = function(self, ply)
    if PlayerCanSpawn(ply) then
        ply:Spawn()
        return true
    end
    if CurTime() - (ply.DeathTime or CurTime()) > 3 then
        CalculateSpectator(ply)
    end
    return false
end
_G.CalculateSpectator = function(ply)
    local teamOnly = cvars.Bool("zp_spectate_team_only", true)
    local candidates = ply:Team() ~= TEAM_SPECTATOR and (rounds:IsRealisticMod() or teamOnly) and (ply:IsZombie() and rounds:GetAliveZombies() or rounds:GetAliveHumans()) or rounds:GetPlayersToPlay(true)
    if #candidates > 0 then
        if ShouldResetSpectate(ply, teamOnly) then
            ply:MoveSpectateID(0, candidates)
        elseif ply:KeyPressed(IN_JUMP) then
            ply:Spectate((ply:GetObserverMode() + 1) % 3 + 4)
        elseif ply:KeyPressed(IN_ATTACK) then
            ply:MoveSpectateID(1, candidates)
        elseif ply:KeyPressed(IN_ATTACK2) then
            ply:MoveSpectateID(-1, candidates)
        end
    elseif ply:GetObserverMode() ~= OBS_MODE_ROAMING then
        ply:Spectate(OBS_MODE_ROAMING)
    end
end
_G.ShouldResetSpectate = function(ply, teamOnly)
    if ply:GetObserverMode() == OBS_MODE_ROAMING then
        return false
    end
    local observed = ply:GetObserverTarget()
    if not IsValid(observed) or not observed:IsPlayer() or not observed:Alive() then
        return true
    end
    return ply:Team() ~= TEAM_SPECTATOR and teamOnly and observed:Team() ~= ply:Team()
end
_G.PlayerCanSpawn = function(ply)
    if not __TS__ArrayIncludes(
        rounds:GetPlayersToPlay(),
        ply
    ) then
        return false
    end
    if rounds:IsPlayingRound() and rounds:IsRespawn() then
        local current = rounds:GetCurrentRoundPlaying()
        local ____current_RespawnFunction_2
        if current and current.RespawnFunction then
            ____current_RespawnFunction_2 = current.RespawnFunction(ply)
        else
            ____current_RespawnFunction_2 = true
        end
        return ____current_RespawnFunction_2
    end
    return rounds:GetRoundState() == ROUND_STARTING_NEW_ROUND or rounds:GetRoundState() == ROUND_WAITING_PLAYERS
end
GM.PlayerLoadout = function(self, ply)
    if ply:IsZombie() then
        ply:Infect(true)
        if ply:IsNemesis() then
            ply:MakeNemesis()
        end
    else
        ply:MakeHuman()
        if ply:IsSurvivor() then
            ply:MakeSurvivor()
        end
    end
end
GM.PlayerSetModel = function(self, ply)
    ply:SetModel(ply:IsZombie() and (cvars.Bool("zp_admin_zombie_model", false) and AdminZombiePlayerModel or ply:GetZombieClass().PModel) or (cvars.Bool("zp_admin_human_model", false) and AdminHumanPlayerModel or ply:GetHumanClass().PModel))
    ply:SetupHands()
end
GM.PlayerCanPickupWeapon = function(self, ply, weapon)
    local ____ply_IsZombie_result_3
    if ply:IsZombie() then
        ____ply_IsZombie_result_3 = ply:ZombieCanUseWeapon(weapon:GetClass())
    else
        ____ply_IsZombie_result_3 = WeaponManager:PlayerCanPickupWeapon(
            ply,
            weapon:GetClass()
        )
    end
    return ____ply_IsZombie_result_3
end
hook.Add(
    "PlayerDeath",
    "ZPPlayerDeath",
    function(ply, _weapon, killer)
        ply.DeathTime = CurTime()
        ply:SetPrimaryWeaponGiven(false)
        ply:SetSecondaryWeaponGiven(false)
        ply:SetLight(nil)
        if ply:IsZombie() then
            local sound = SafeTableRandom(ZombieDeathSounds)
            if sound then
                ply:EmitSound(sound)
            end
        end
        if ply ~= killer and killer:IsPlayer() then
            killer:GiveAmmoPacks(cvars.Number("zp_ap_kill_zombie", 5))
            killer:AddPoints(cvars.Number(
                ply:IsZombie() and "zp_point_points_per_zombie_kill" or "zp_point_points_per_human_kill",
                ply:IsZombie() and 100 or 30
            ))
            ply:Spectate(OBS_MODE_CHASE)
            ply:SpectateEntity(killer)
        end
        if ply == killer then
            ply:RemovePoints(cvars.Number("zp_point_negative_points_per_suicide", 100))
        end
        hook.Call(
            "ZPResetAbilityEvent" .. ply:SteamID64(),
            GAMEMODE
        )
    end
)
hook.Add(
    "PostPlayerDeath",
    "ZPDeathEvents",
    function(ply)
        if ply:IsZombie() and rounds:LastZombie() then
            hook.Call("ZPLastZombieEvent")
        elseif ply:IsHuman() and rounds:LastHuman() then
            hook.Call("ZPLastHumanEvent")
        end
    end
)
_G.ToggleNightvision = function(ply)
    if ply:GetBattery() > 0 then
        ply:SetNightvision(not ply:NightvisionIsOn())
    end
end
net.Receive(
    "RequestNightvision",
    function(_length, ply) return ToggleNightvision(ply) end
)
return ____exports
