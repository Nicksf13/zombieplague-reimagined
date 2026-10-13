export {};
include("shared.lua");
include("cl_data.lua");
include("cl_map_environment.lua");
include("cl_roundmanager.lua");
include("cl_particlemanager.lua");
include("cl_message.lua");
include("cl_player.lua");
include("cl_nightvision.lua");
include("cl_hud.lua");
include("cl_theme_manager.lua");
include("cl_menu_controls.lua");
include("cl_weapon_menu.lua");
include("cl_class_menu.lua");
include("cl_class_menu_hud.lua");
include("cl_extra_menu.lua");
include("cl_extra_menu_hud.lua");
include("cl_main_menu.lua");
include("cl_main_menu_hud.lua");
include("cl_admin_menu.lua");
include("cl_admin_menu_hud.lua");
include("cl_settings.lua");
include("cl_settings_hud.lua");
include("cl_theme_hud.lua");
include("cl_weapon_menu_hud.lua");
include("cl_player_hud.lua");
include("cl_keymanager.lua");
include("cl_scoreboard.lua");
include("cl_scoreboard_hud.lua");
GM.PlayerFootstep = function (this: ZPGameMode, ply): boolean { return !ply.GetFootstep(); };
net.Receive("SendServerStatus", () => {
    const info = ZPClientData.Record(net.ReadTable());
    if (!info || typeof info.Timer !== "number" || typeof info.Round !== "number" || typeof info.RoundState !== "number")
        return;
    if (info.RoundState < 0 || info.RoundState > 6 || info.RoundState % 1 !== 0)
        return;
    const players = ZPClientData.Record(info.Players);
    if (!players)
        return;
    (RoundManager as ZPClientRoundManager).SetTimer(info.Timer);
    RoundManager.SetRoundState(info.RoundState as ZPRoundState);
    RoundManager.SetRound(info.Round);
    for (const [, value] of pairs(players)) {
        const state = ZPClientData.Record(value);
        if (!state || typeof state.ID !== "string" || typeof state.Battery !== "number" || typeof state.AmmoPacks !== "number" ||
            typeof state.ZombieClass !== "string" || typeof state.HumanClass !== "string" ||
            typeof state.AbilityPower !== "number" || typeof state.MaxAbilityPower !== "number")
            continue;
        const ply = PlayerManager.DiscoverPlayerByTextID(state.ID) as ZPClientPlayer | undefined;
        if (!ply || !IsValid(ply))
            continue;
        ply.SetMaxBatteryCharge(state.Battery);
        ply.SetAmmoPacks(state.AmmoPacks);
        ply.SetZombieClass(state.ZombieClass);
        ply.SetHumanClass(state.HumanClass);
        const light = ZPClientData.Record(state.Light);
        if (light && typeof light.r === "number" && typeof light.g === "number" && typeof light.b === "number" && typeof light.a === "number") {
            ply.SetLight(Color(light.r, light.g, light.b, light.a));
        }
        else
            ply.SetLight(undefined);
        ply.SetFootstep(typeof state.Footstep === "boolean" ? state.Footstep : undefined);
        ply.SetAbilityPower(state.AbilityPower);
        ply.SetMaxAbilityPower(state.MaxAbilityPower);
    }
});
hook.Add("InitPostEntity", "PlayerRdy", () => {
    if (!file.Exists("zombieplague", "DATA"))
        file.CreateDir("zombieplague");
    net.Start("RequestServerStatus");
    net.SendToServer();
});
concommand.Add("zp_ability", () => { net.Start("RequestAbility"); net.SendToServer(); });
