import { serverSetup, clientSetup, panelsSetup } from "./weapon-menu.mjs";

export const extraServerSetup = serverSetup + `
GM={}; GAMEMODE=GM; WMODE_NONE=0
local playing,special,lastZombie,lastHuman=true,false,false,false
RoundManager={IsPlayingRound=function() return playing end,IsSpecialRound=function() return special end,
    LastZombie=function() return lastZombie end,LastHuman=function() return lastHuman end,
    GetRoundState=function() return playing and 2 or 1 end}
InfectionManager={Infect=function(_,target) target.human=false end,Cure=function(_,target) target.human=true end}
local notices,sounds={},{}
SendPopupMessage=function(_,message) notices[#notices+1]=message end
SendSound=function(_,sound) sounds[#sounds+1]=sound end
function meta:Team() return self.spectator and TEAM_SPECTATOR or self.human and TEAM_HUMANS or TEAM_ZOMBIES end
function meta:GetAmmoPacks() return self.balance or 0 end
function meta:TakeAmmoPacks(amount) self.balance=self:GetAmmoPacks()-amount; self.charges=(self.charges or 0)+1 end
function meta:Armor() return self.armor or 0 end
function meta:SetArmor(value) self.armor=value end
function meta:ZombieMadness(duration) self.madness=duration end
include("sh_extra_menu_protocol.lua")
include("sv_extraitems.lua"); ExtraItemsManager:Search()
include("sv_extra_menu.lua")
ply.balance=200
local function extraCatalog(id)
    now=now+0.3; uints={1,id}; receivers.ZPExtraMenuCatalog(39,ply); return sent[2]
end
local function buyExtra(id,kind,item)
    now=now+0.3; readTable={Version=1,RequestID=id,Kind=kind,ID=item,Price=0}
    receivers.ZPExtraMenuBuy(512,ply); return sent[2]
end
local function extraEntry(snapshot,id)
    for _,entry in ipairs(snapshot.Entries) do if entry.ID==id then return entry end end
end
`;

export const extraClientSetup = clientSetup + panelsSetup + `
include("sh_extra_menu_protocol.lua")
include("cl_extra_menu.lua"); include("cl_extra_menu_hud.lua")
include("cl_theme_hud.lua"); include("cl_weapon_menu_hud.lua")
local extraSnapshot={Entries={
    {ID="ZPArmor",Kind="human",Name="ExtraItemArmorName",Price=12,Order=1,Availability="available"},
    {ID="ZPTVirus",Kind="human",Name="ExtraItemTVirusName",Price=15,Order=2,Availability="restricted"},
    {ID="ZPZombieMadness",Kind="zombie",Name="ExtraItemZombieMadnessName",Price=10,Order=1,Availability="wrong_team"}},
    Balance=20,Team="human",Alive=true,Truncated=false}
local function extraReply(id,code,data)
    readTable={Version=1,RequestID=id,Code=code or "catalog",Snapshot=data or extraSnapshot}
    receivers.ZPExtraMenuReply(8192)
end
local function extraFrame()
    for _,panel in ipairs(panels) do if panel.kind=="DFrame" and not panel.removed then return panel end end
end
local function extraCards()
    local result={}
    for _,panel in ipairs(extraFrame().children) do
        if panel.kind=="DScrollPanel" then
            for _,child in ipairs(panel.children) do if not child.removed then result[#result+1]=child end end
        end
    end
    return result
end
`;
