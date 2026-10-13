export const serverSetup = `
local now=10
function CurTime() return now end
local meta={}
function FindMetaTable() return meta end
include("sh_weapon_menu_protocol.lua")
include("sv_utils.lua")
include("sv_weaponmanager.lua")
WeaponManager:SearchWeapons()
include("sv_player_weapons.lua")
include("sv_weapon_menu.lua")
net.ReadUInt=function() return table.remove(uints,1) end
local function newPlayer(id)
    local ply=setmetatable({alive=true,human=true,inventory={},ammo=0,gives=0}, {__index=meta})
    function ply:SteamID64() return id or "76561198000000001" end
    function ply:Alive() return self.alive end
    function ply:IsHuman() return self.human end
    function ply:IsBot() return self.bot or false end
    function ply:IsSurvivor() return self.survivor or false end
    function ply:GetWeapon(weapon) return self.inventory[weapon] end
    function ply:Give(weapon)
        self.gives=self.gives+1
        local entity={GetMaxClip1=function() return 30 end,GetPrimaryAmmoType=function() return 1 end,
            GetSecondaryAmmoType=function() return 2 end}
        self.inventory[weapon]=entity
        return entity
    end
    function ply:GiveAmmo(amount) self.ammo=self.ammo+amount end
    return ply
end
local ply=newPlayer()
local function catalog(id)
    uints={1,id}; receivers.ZPWeaponMenuCatalog(39,ply)
    return sent[2]
end
local function selectWeapon(id,kind,weapon)
    now=now+0.3
    readTable={Version=1,RequestID=id,Kind=kind,ID=weapon}
    receivers.ZPWeaponMenuSelect(512,ply)
    return sent[2]
end
`;

export const clientSetup = `
local now=10
function CurTime() return now end
KEY_ESCAPE=70
input={IsKeyDown=function() return false end}
local consoleCommands={}
concommand={Add=function(name,callback) consoleCommands[name]=callback end}
local clientPreferences={}
function CreateClientConVar(name,default,archive,userinfo,help)
    if clientPreferences[name] then return clientPreferences[name] end
    local preference={value=default=="1",archive=archive,userinfo=userinfo}
    function preference:GetBool() return self.value end
    function preference:SetBool(value) self.value=value end
    clientPreferences[name]=preference
    return preference
end
IN_SPEED=131072
local requests=0
net.SendToServer=function() requests=requests+1 end
net.WriteUInt=function(value) sent[#sent+1]=value end
file.Read=function() return nil end
file.Exists=function() return true end
file.Write=function() end
file.CreateDir=function() end
util.JSONToTable=function() return nil end
util.TableToJSON=function() return "{}" end
include("cl_data.lua")
include("sh_weapon_menu_protocol.lua")
local createdFonts={}
surface={CreateFont=function(name,data) createdFonts[name]=data end}
include("cl_theme_manager.lua")
include("cl_menu_controls.lua")
include("cl_weapon_menu.lua")
include("cl_main_menu.lua")
include("cl_main_menu_hud.lua")
include("cl_settings.lua")
include("cl_settings_hud.lua")
local viewer={alive=true,human=true}
function viewer:Alive() return self.alive end
function viewer:IsHuman() return self.human end
function viewer:Team() return self.team or TEAM_HUMANS end
function LocalPlayer() return viewer end
local snapshot={Entries={{ID="weapon_ar2",Name="AR2",Kind="primary",Order=100},
    {ID="weapon_pistol",Name="Pistol",Kind="secondary",Order=100}},
    Selected={primary="",secondary="",melee=""},
    CanReceive={primary=true,secondary=true,melee=true},Truncated=false}
local function reply(id,code,data)
    readTable={Version=1,RequestID=id,Code=code or "catalog",Snapshot=data or snapshot}
    receivers.ZPWeaponMenuReply(4096)
end
`;

// Panels model parenting/deletion and execute Paint/DoClick; no claim about engine rendering.
export const panelsSetup = `
local panels={}
surface.SetFont=function() end
surface.GetTextSize=function(text) return #text*8,16 end
function ScrW() return 1280 end
function ScrH() return 720 end
function IsValid(value) return type(value)=="table" and not value.removed end
TEXT_ALIGN_LEFT=0
language={GetPhrase=function(key) return key end}
draw={RoundedBox=function() end,DrawText=function(text) assert(type(text)=="string") end}
local panelMeta={}
function panelMeta:SetSize(w,h) self.w,self.h=w,h end
function panelMeta:SetPos(x,y) self.x,self.y=x,y end
function panelMeta:GetSize() return self.w,self.h end
function panelMeta:Remove()
    self.removed=true
    for _,child in ipairs(self.children) do child:Remove() end
end
function panelMeta:IsHovered() return false end
function panelMeta:IsEnabled() return self.enabled~=false end
function panelMeta:SetEnabled(value) self.enabled=value end
function panelMeta:SetVisible(value) self.visible=value end
function panelMeta:SetTooltip(value) self.tooltip=value end
function panelMeta:SetText(value) self.text=value end
function panelMeta:GetValue() return self.text or "" end
function panelMeta:GetText() return self.text or "" end
function panelMeta:SetFont(value) self.font=value end
function panelMeta:SetTextInset(x,y) self.inset={x,y} end
function panelMeta:HasFocus() return self.focused==true end
function panelMeta:GetPlaceholderText() return self.placeholder end
function panelMeta:DrawTextEntryText(text,highlight,cursor) self.entryColors={text,highlight,cursor} end
function panelMeta:IsMenuOpen() return self.menuOpen==true end
function panelMeta:SetPlaceholderText(value) self.placeholder=value end
function panelMeta:SetTextColor(value) self.textColor=value end
function panelMeta:SetWrap(value) self.wrap=value end
function panelMeta:SetChecked(value) self.checked=value end
function panelMeta:SetSortItems(value) self.sorted=value end
function panelMeta:SetValue(value) self.value=value end
function panelMeta:Clear() self.choices={} end
function panelMeta:AddChoice(text,data)
    self.choices=self.choices or {}; self.choices[#self.choices+1]={text,data}; return #self.choices
end
function panelMeta:SetKeyboardInputEnabled(enabled)
    self.keyboard=enabled
    for _,child in ipairs(self.children) do child:SetKeyboardInputEnabled(enabled) end
end
function panelMeta:MakePopup() self.popup=true; self.keyboard=true end
function panelMeta:Add(kind) return vgui.Create(kind,self) end
for _,method in ipairs({"SetColor","SetTitle","ShowCloseButton","SetDraggable","SetDeleteOnClose","Center"}) do
    panelMeta[method]=function() end
end
vgui={Create=function(kind,parent)
    local panel=setmetatable({kind=kind,children={}}, {__index=panelMeta})
    panels[#panels+1]=panel
    if parent then parent.children[#parent.children+1]=panel end
    if kind=="DComboBox" then
        panel.DropButton=vgui.Create("DPanel",panel)
        panel.DropButton:SetSize(15,15)
    end
    return panel
end}
local function paintAll()
    for _,panel in ipairs(panels) do
        if not panel.removed and panel.visible~=false and panel.Paint then panel:Paint(panel.w,panel.h) end
    end
end
`;
