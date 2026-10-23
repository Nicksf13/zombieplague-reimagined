export {};
const { ready, targets } = include("sv_spectator_rules.lua") as typeof import("../../player/server/sv_spectator_rules");
const rounds = RoundManager as ZPServerRoundManager;
GM.PlayerCanHearPlayersVoice = function (listener, talker): boolean {
    if (!rounds.IsPlayingRound())
        return true;
    if (rounds.IsRealisticMod())
        return listener.Team() === talker.Team() && listener.Alive() === talker.Alive();
    if (!listener.Alive())
        return true;
    if (!cvars.Bool("zp_voice_all", true) && listener.Team() !== talker.Team())
        return false;
    return cvars.Bool("zp_can_hear_death", true) || listener.Alive() === talker.Alive();
};
GM.PlayerCanSeePlayersChat = function (_text, teamTalk, listener, talker): boolean {
    if (!rounds.IsPlayingRound())
        return true;
    if (rounds.IsRealisticMod())
        return listener.Team() === talker.Team() && listener.Alive() === talker.Alive();
    if (!listener.Alive())
        return !teamTalk || listener.Team() === talker.Team();
    if ((teamTalk || !cvars.Bool("zp_chat_all", true)) && listener.Team() !== talker.Team())
        return false;
    return cvars.Bool("zp_can_see_death", true) || listener.Alive() === talker.Alive();
};
GM.PlayerSpawn = function (ply): void {
    // Always synchronize off, even if the server already considers it off, without toggle audio.
    ply.SetNightvision(false, true);
    if (cvars.Bool("zp_bot_training", false) && !ply.IsBot()) {
        ply.ZPVoluntarySpectator = true;
        ply.SetTeam(TEAM_SPECTATOR);
        ply.KillSilent();
        ply.Spectate(OBS_MODE_ROAMING);
        ply.FirstSpawn = true;
        return;
    }
    if (ply.FirstSpawn) {
        if (ply.Team() !== TEAM_SPECTATOR) {
            ply.UnSpectate();
            hook.Call("PlayerSetModel", GAMEMODE, ply);
            hook.Call("PlayerLoadout", GAMEMODE, ply);
            if (rounds.FreezeTimeActive && ply.Alive())
                rounds.FreezePlayer(ply);
        }
    }
    else {
        ply.KillSilent();
        ply.Spectate(6);
        ply.FirstSpawn = true;
    }
};
GM.PlayerDeathThink = function (ply): boolean {
    if (PlayerCanSpawn(ply)) {
        ply.Spawn();
        return true;
    }
    if (ready(ply))
        CalculateSpectator(ply);
    return false;
};
_G.CalculateSpectator = (ply): void => {
    if (_G.ZPSpectatorOverview?.Input(ply)) return;
    const teamOnly = cvars.Bool("zp_spectate_team_only", true);
    const candidates = targets(ply);
    if (candidates.length > 0) {
        if (ShouldResetSpectate(ply, teamOnly))
            ply.MoveSpectateID(0, candidates);
        else if (ply.KeyPressed(IN_JUMP)) {
            if (ply.GetObserverMode() !== OBS_MODE_CHASE || !_G.ZPSpectatorOverview?.Open(ply))
                ply.Spectate(((ply.GetObserverMode() + 1) % 3) + 4);
        }
        else if (ply.KeyPressed(IN_ATTACK))
            ply.MoveSpectateID(1, candidates);
        else if (ply.KeyPressed(IN_ATTACK2))
            ply.MoveSpectateID(-1, candidates);
    }
    else if (ply.GetObserverMode() !== OBS_MODE_ROAMING)
        ply.Spectate(OBS_MODE_ROAMING);
};
_G.ShouldResetSpectate = (ply, teamOnly): boolean => {
    if (ply.GetObserverMode() === OBS_MODE_ROAMING)
        return false;
    const observed = ply.GetObserverTarget();
    if (!IsValid(observed) || !observed.IsPlayer() || !observed.Alive())
        return true;
    return ply.Team() !== TEAM_SPECTATOR && teamOnly && observed.Team() !== ply.Team();
};
_G.PlayerCanSpawn = (ply): boolean => {
    if (!rounds.GetPlayersToPlay().includes(ply))
        return false;
    if (rounds.IsPlayingRound() && rounds.IsRespawn()) {
        const current = rounds.GetCurrentRoundPlaying();
        return current?.RespawnFunction ? current.RespawnFunction(ply) : true;
    }
    return rounds.GetRoundState() === ROUND_STARTING_NEW_ROUND || rounds.GetRoundState() === ROUND_WAITING_PLAYERS;
};
GM.PlayerLoadout = function (ply): void {
    if (ply.IsZombie()) {
        ply.Infect(true);
        if (ply.IsNemesis())
            ply.MakeNemesis();
    }
    else {
        ply.MakeHuman();
        if (ply.IsSurvivor())
            ply.MakeSurvivor();
    }
};
GM.PlayerSetModel = function (ply): void {
    ply.SetModel(ply.IsZombie()
        ? (cvars.Bool("zp_admin_zombie_model", false) ? AdminZombiePlayerModel : ply.GetZombieClass().PModel)
        : (cvars.Bool("zp_admin_human_model", false) ? AdminHumanPlayerModel : ply.GetHumanClass().PModel));
    ply.SetupHands();
};
GM.PlayerCanPickupWeapon = function (ply, weapon): boolean {
    if (weapon.GetClass() === "zp_bot_boost_tool") return ply.IsAdmin() && !ply.IsBot();
    return ply.IsZombie() ? ply.ZombieCanUseWeapon(weapon.GetClass()) : WeaponManager.PlayerCanPickupWeapon(ply, weapon.GetClass());
};
hook.Add("PlayerDeath", "ZPPlayerDeath", (ply, _weapon, killer) => {
    ply.DeathTime = CurTime();
    ply.SetPrimaryWeaponGiven(false);
    ply.SetSecondaryWeaponGiven(false);
    ply.SetLight(undefined);
    if (ply.IsZombie()) {
        const sound = SafeTableRandom(ZombieDeathSounds);
        if (sound)
            ply.EmitSound(sound);
    }
    if (ply !== killer && killer.IsPlayer()) {
        // Keep the legacy ammo-pack reward; balancing changes are a separate task.
        killer.GiveAmmoPacks(cvars.Number("zp_ap_kill_zombie", 5));
        killer.AddPoints(cvars.Number(ply.IsZombie() ? "zp_point_points_per_zombie_kill" : "zp_point_points_per_human_kill", ply.IsZombie() ? 100 : 30));
        ply.Spectate(OBS_MODE_CHASE);
        ply.SpectateEntity(killer);
    }
    if (ply === killer)
        ply.RemovePoints(cvars.Number("zp_point_negative_points_per_suicide", 100));
    hook.Call("ZPResetAbilityEvent" + ply.SteamID64(), GAMEMODE);
});
hook.Add("PostPlayerDeath", "ZPDeathEvents", ply => {
    if (ply.IsZombie() && rounds.LastZombie())
        hook.Call("ZPLastZombieEvent");
    else if (ply.IsHuman() && rounds.LastHuman())
        hook.Call("ZPLastHumanEvent");
});
_G.ToggleNightvision = ply => { if (!ply.IsFrozen() && ply.GetBattery() > 0)
    ply.SetNightvision(!ply.NightvisionIsOn()); };
net.Receive("RequestNightvision", (_length, ply) => ToggleNightvision(ply));
