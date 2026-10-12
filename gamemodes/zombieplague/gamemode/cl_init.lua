-- Generated from src/gamemodes/zombieplague/gamemode/cl_init.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
include("shared.lua")
include("cl_data.lua")
include("cl_roundmanager.lua")
include("cl_particlemanager.lua")
include("cl_message.lua")
include("cl_player.lua")
include("cl_hud.lua")
include("cl_theme_manager.lua")
include("cl_weapon_menu.lua")
include("cl_main_menu.lua")
include("cl_main_menu_hud.lua")
include("cl_theme_hud.lua")
include("cl_weapon_menu_hud.lua")
include("cl_player_hud.lua")
include("cl_keymanager.lua")
include("cl_scoreboard.lua")
include("cl_scoreboard_hud.lua")
GM.PlayerFootstep = function(self, ply)
    return not ply:GetFootstep()
end
net.Receive(
    "SendServerStatus",
    function()
        local info = ZPClientData.Record(net.ReadTable())
        if not info or type(info.Timer) ~= "number" or type(info.Round) ~= "number" or type(info.RoundState) ~= "number" then
            return
        end
        if info.RoundState < 0 or info.RoundState > 6 or info.RoundState % 1 ~= 0 then
            return
        end
        local players = ZPClientData.Record(info.Players)
        if not players then
            return
        end
        RoundManager:SetTimer(info.Timer)
        RoundManager:SetRoundState(info.RoundState)
        RoundManager:SetRound(info.Round)
        for ____, value in pairs(players) do
            do
                local __continue7
                repeat
                    local state = ZPClientData.Record(value)
                    if not state or type(state.ID) ~= "string" or type(state.Battery) ~= "number" or type(state.AmmoPacks) ~= "number" or type(state.ZombieClass) ~= "string" or type(state.HumanClass) ~= "string" or type(state.AbilityPower) ~= "number" or type(state.MaxAbilityPower) ~= "number" then
                        __continue7 = true
                        break
                    end
                    local ply = PlayerManager:DiscoverPlayerByTextID(state.ID)
                    if not ply or not IsValid(ply) then
                        __continue7 = true
                        break
                    end
                    ply:SetMaxBatteryCharge(state.Battery)
                    ply:SetAmmoPacks(state.AmmoPacks)
                    ply:SetZombieClass(state.ZombieClass)
                    ply:SetHumanClass(state.HumanClass)
                    local light = ZPClientData.Record(state.Light)
                    if light and type(light.r) == "number" and type(light.g) == "number" and type(light.b) == "number" and type(light.a) == "number" then
                        ply:SetLight(Color(light.r, light.g, light.b, light.a))
                    else
                        ply:SetLight(nil)
                    end
                    local ____ply_SetFootstep_1 = ply.SetFootstep
                    local ____temp_0
                    if type(state.Footstep) == "boolean" then
                        ____temp_0 = state.Footstep
                    else
                        ____temp_0 = nil
                    end
                    ____ply_SetFootstep_1(ply, ____temp_0)
                    ply:SetAbilityPower(state.AbilityPower)
                    ply:SetMaxAbilityPower(state.MaxAbilityPower)
                    __continue7 = true
                until true
                if not __continue7 then
                    break
                end
            end
        end
    end
)
hook.Add(
    "InitPostEntity",
    "PlayerRdy",
    function()
        if not file.Exists("zombieplague", "DATA") then
            file.CreateDir("zombieplague")
        end
        net.Start("RequestServerStatus")
        net.SendToServer()
    end
)
concommand.Add(
    "zp_ability",
    function()
        net.Start("RequestAbility")
        net.SendToServer()
    end
)
return ____exports
