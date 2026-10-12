// Client Players include distinct connection IDs even when bots share SteamID64.
export const scoreboardSetup = `
GM={}
local players={}
player={GetAll=function() return players end}
timer.Destroy=function(name) timers[name]=nil end
local function scorePlayer(id,name,teamID,points)
    local ply={id=id,name=name,team=teamID,points=points,deaths=2,ping=42,alive=true,muted=false,muteCalls=0}
    function ply:UserID() return self.id end
    function ply:IsBot() return self.bot or false end
    function ply:ShowProfile() self.profileCalls=(self.profileCalls or 0)+1 end
    function ply:Name() return self.name end
    function ply:Team() return self.team end
    function ply:GetPoints() return self.points end
    function ply:Deaths() return self.deaths end
    function ply:Ping() return self.ping end
    function ply:Alive() return self.alive end
    function ply:IsMuted() return self.muted end
    function ply:SetMuted(value) self.muted=value; self.muteCalls=self.muteCalls+1 end
    function ply:SteamID64() return "0" end
    players[#players+1]=ply
    return ply
end
local me=scorePlayer(1,"Local Player",TEAM_HUMANS,40)
local ally=scorePlayer(2,"Ally",TEAM_HUMANS,80)
local zombie=scorePlayer(3,"Zombie",TEAM_ZOMBIES,60)
local spectator=scorePlayer(4,"Spectator",TEAM_SPECTATOR,10)
local dropdowns={}
function DermaMenu()
    local menu=vgui.Create("DMenu")
    function menu:AddOption(label,action)
        local option=self:Add("DMenuOption")
        option.label=label; option.DoClick=action
        function option:SetEnabled(value) self.enabled=value end
        return option
    end
    function menu:Open() self.opened=true end
    dropdowns[#dropdowns+1]=menu
    return menu
end
function LocalPlayer() return me end
function IsValid(value) return type(value)=="table" and not value.invalid and not value.removed end
include("cl_theme_hud.lua")
include("cl_weapon_menu_hud.lua")
include("cl_scoreboard.lua")
include("cl_scoreboard_hud.lua")
`;
