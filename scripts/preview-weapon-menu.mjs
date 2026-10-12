// Development-only SVG capture of the generated Lua Paint callbacks.
// Uses the same engine substitutes as the runtime tests, not a second HTML UI.
import { mkdir, writeFile } from "node:fs/promises";
import { run } from "../tests/helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "../tests/helpers/weapon-menu.mjs";
import { playerHUDSetup } from "../tests/helpers/player-hud.mjs";
import { nativeLanguage } from "../tests/helpers/native-localization.mjs";
import { scoreboardSetup } from "../tests/helpers/scoreboard.mjs";

const render = `
selectedLocale="pt-BR"
panelMeta.Center=function(self) self.x=(ScrW()-self.w)/2; self.y=(ScrH()-self.h)/2 end
snapshot.Entries={
    {ID="weapon_ar2",Name="AR2",Kind="primary",Order=100},
    {ID="weapon_smg1",Name="SMG1",Kind="primary",Order=100},
    {ID="weapon_shotgun",Name="Shotgun",Kind="primary",Order=100},
    {ID="weapon_crossbow",Name="Crossbow",Kind="primary",Order=100},
    {ID="weapon_pistol",Name="Pistol",Kind="secondary",Order=100},
    {ID="weapon_357",Name=".357 Magnum",Kind="secondary",Order=100},
    {ID="weapon_crowbar",Name="Crowbar",Kind="melee",Order=100},
    {ID="weapon_stunstick",Name="Stunstick",Kind="melee",Order=100}
}
snapshot.Selected.primary="weapon_ar2"
snapshot.CanReceive.primary=false
ZPWeaponMenu:Open(); reply(1)
ZPWeaponMenu:UsePresentation(PREVIEW_STYLE)
if PREVIEW_MENU=="main-menu" then ZPMainMenu:Open() end
if PREVIEW_MENU=="settings" then ZPSettings:Open() end
if PREVIEW_MENU=="scoreboard" then
    ZPWeaponMenu:Close()
    for key,value in pairs(viewer) do if me[key]==nil then me[key]=value end end
    me.name,ally.name,zombie.name,spectator.name="Você","Hunter","Infectado","Observador"
    scorePlayer(5,"Soldado",TEAM_HUMANS,65)
    scorePlayer(6,"Predador",TEAM_ZOMBIES,90).muted=true
    zombie.alive=false
    GM:ScoreboardShow()
end
local parts={[[<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
<title>Zombie Plague: tema de HUD e menu</title>
<rect width="1280" height="720" fill="#26343d"/>]]}
local x,y=0,0
local function escape(text) return text:gsub("&","&amp;"):gsub("<","&lt;"):gsub(">","&gt;"):gsub('"',"&quot;") end
local function color(value) return string.format("rgb(%d,%d,%d)",value.r,value.g,value.b) end
draw.RoundedBox=function(radius,px,py,w,h,tint)
    parts[#parts+1]=string.format('<rect x="%g" y="%g" width="%g" height="%g" rx="%g" fill="%s" fill-opacity="%g"/>',
        x+px,y+py,w,h,radius,color(tint),tint.a/255)
end
draw.DrawText=function(text,font,px,py,tint)
    local size=(font=="DermaLarge" or font=="Trebuchet24" or font=="ZPMenuOptionTitle") and 24 or font=="Trebuchet18" and 18 or 13
    parts[#parts+1]=string.format('<text x="%g" y="%g" font-family="Trebuchet MS,Segoe UI,sans-serif" font-size="%d" fill="%s">%s</text>',
        x+px,y+py+size,size,color(tint),escape(text))
end
local clips=0
local function paint(panel,parentX,parentY)
    if panel.removed then return end
    x,y=parentX+(panel.x or 0),parentY+(panel.y or 0)
    local originX,originY=x,y
    clips=clips+1
    parts[#parts+1]=string.format('<defs><clipPath id="clip%d"><rect x="%g" y="%g" width="%g" height="%g"/></clipPath></defs><g clip-path="url(#clip%d)">',
        clips,x,y,panel.w or 0,panel.h or 0,clips)
    if panel.Paint then panel:Paint(panel.w,panel.h) end
    for _,child in ipairs(panel.children) do paint(child,originX,originY) end
    parts[#parts+1]="</g>"
end
local success,failure=xpcall(function()
    hooks.HUDPaint.HUDZombiePlague()
    if PREVIEW_MENU then
        for _,panel in ipairs(panels) do
            if panel.kind=="DFrame" and not panel.removed then paint(panel,0,0) end
        end
    end
end,debug.traceback)
assert(success,failure)
parts[#parts+1]='<text x="160" y="718" font-family="Segoe UI,sans-serif" font-size="11" fill="#a5b6bf">Prévia simulada do Lua compilado. Não é uma captura do Garry’s Mod.</text></svg>'
previewSVG=table.concat(parts,string.char(10))
`;

const directory = new URL("../docs/previews/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const style of ["classic", "hl2", "cs16"]) {
    for (const menu of [false, "weapon-menu", "main-menu", "settings", "scoreboard"]) {
        const svg = run(clientSetup + panelsSetup + nativeLanguage + playerHUDSetup + (menu === "scoreboard" ? scoreboardSetup : "") +
            `PREVIEW_STYLE="${style}"\nPREVIEW_MENU=${menu ? JSON.stringify(menu) : "false"}\n` + render, "previewSVG");
        const name = `${menu || "hud"}-${style}.svg`;
        await writeFile(new URL(name, directory), svg, "utf8");
        console.log(`Generated docs/previews/${name}`);
    }
}
