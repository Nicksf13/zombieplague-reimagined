// Player/Weapon substitutes shared by HUD regressions and SVG previews.
export const playerHUDSetup = `
local screenWidth,screenHeight=1280,720
function ScrW() return screenWidth end
function ScrH() return screenHeight end
OBS_MODE_ROAMING=6
local weapon={clip=30,clip2=-1,primary=0,secondary=1}
function weapon:Clip1() return self.clip end
function weapon:Clip2() return self.clip2 end
function weapon:GetPrimaryAmmoType() return self.primary end
function weapon:GetSecondaryAmmoType() return self.secondary end
local function hudPlayer(name)
    local ply={alive=true,name=name,health=100,armor=25,breath=80,battery=60,power=50,
        maxPower=100,mode=0,weapon=weapon,ammo={[0]=90,[1]=3},class="Soldado"}
    function ply:IsPlayer() return true end
    function ply:Alive() return self.alive end
    function ply:Name() return self.name end
    function ply:Health() return self.health end
    function ply:Armor() return self.armor end
    function ply:GetZPClass() return self.class end
    function ply:GetBreath() return self.breath end
    function ply:GetMaxBreath() return 100 end
    function ply:GetBattery() return self.battery end
    function ply:GetMaxBatteryCharge() return 100 end
    function ply:GetAbilityPower() return self.power end
    function ply:GetMaxAbilityPower() return self.maxPower end
    function ply:GetAmmoPacks() return 160 end
    function ply:GetObserverMode() return self.mode end
    function ply:GetObserverTarget() return self.target end
    function ply:GetActiveWeapon() return self.weapon end
    function ply:GetAmmoCount(id) return self.ammo[id] or 0 end
    function ply:GetScreenFilter() return self.filter end
    return ply
end
local viewer=hudPlayer("Local Player")
function LocalPlayer() return viewer end
function IsValid(value) return type(value)=="table" and not value.invalid and not value.removed end
local roundSeconds=125
RoundManager={GetTimer=function() return roundSeconds end}
string.FormattedTime=function(seconds,format)
    assert(format=="%02i:%02i")
    return string.format("%02d:%02d",math.floor(seconds/60),seconds%60)
end
surface={SetFont=function() end,GetTextSize=function(text) return #tostring(text)*7,16 end}
include("cl_hud.lua")
include("cl_theme_hud.lua")
include("cl_weapon_menu_hud.lua")
include("cl_player_hud.lua")
`;
