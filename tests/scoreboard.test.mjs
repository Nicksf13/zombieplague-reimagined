import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { clientSetup, panelsSetup } from "./helpers/weapon-menu.mjs";
import { scoreboardSetup } from "./helpers/scoreboard.mjs";

const setup = clientSetup + panelsSetup + `
surface={SetFont=function() end,GetTextSize=function(value) return #tostring(value)*7,16 end}
` + scoreboardSetup;

test("scoreboard collects detached data, sorts points and tracks team swaps with unchanged counts", () => run(setup + `
    local state=ZPScoreboard:GetState()
    assert(not state.Open and state.Teams[1].Players[1].Name=="Ally")
    assert(state.Teams[1].Players[2].Local and not state.Teams[1].Players[2].CanMute)
    assert(state.Teams[3].Players[1].Status=="spectating")
    assert(not state.Teams[1].Players[1].SetMuted and not state.Teams[1].Players[1].SteamID64)
    state.Teams[1].Players[1].Points=999
    assert(ZPScoreboard:GetState().Teams[1].Players[1].Points==80)
    ally.team,zombie.team=TEAM_ZOMBIES,TEAM_HUMANS
    zombie.alive=false; zombie.ping=150; zombie.deaths=8
    state=ZPScoreboard:GetState()
    assert(#state.Teams[1].Players==2 and #state.Teams[2].Players==1)
    assert(state.Teams[1].Players[1].ID==3 and state.Teams[2].Players[1].ID==2)
    assert(state.Teams[1].Players[1].Status=="dead" and state.Teams[1].Players[1].Deaths==8)
    zombie.points=-5
    assert(ZPScoreboard:GetState().Teams[1].Players[1].ID==1)
    ally.invalid=true
    assert(#ZPScoreboard:GetState().Teams[2].Players==0)
    zombie.points,me.points=40,40
    zombie.name="Aaron"
    assert(ZPScoreboard:GetState().Teams[1].Players[1].ID==3)
    zombie.name=me.name
    assert(ZPScoreboard:GetState().Teams[1].Players[1].ID==1)
`));

test("TAB lifecycle, theme switches and live updates clean panels without sending network requests", () => run(setup + `
    GM:ScoreboardShow(); paintAll()
    assert(ZPScoreboard:GetState().Open and timers.ScoreBoardUpdater and requests==0)
    local first=panels[1]
    assert(first.popup and first.keyboard==false)
    local count=#panels
    ally.ping=100; ally.muted=true; ally.name="Renamed"
    timers.ScoreBoardUpdater[2](); paintAll()
    assert(#panels==count)
    ally.points=-1; timers.ScoreBoardUpdater[2](); paintAll()
    assert(#panels>count and first==panels[1])
    for _,id in ipairs({"hl2","cs16","classic"}) do
        ZPThemes:UseTheme(id); paintAll()
        assert(ZPScoreboard:GetState().Open and ZPScoreboard:GetState().Theme==id and requests==0)
    end
    GM:ScoreboardHide()
    assert(not ZPScoreboard:GetState().Open and not timers.ScoreBoardUpdater)
    for _,panel in ipairs(panels) do assert(panel.removed) end
    ZPThemes:UseTheme("cs16"); assert(not ZPScoreboard:GetState().Open)
`));

test("voice actions revalidate connection IDs and cannot mute self or a disconnected player", () => run(setup + `
    GM:ScoreboardShow()
    local buttons={}
    for _,row in ipairs(panels[1].children[1].children) do
        for _,cell in ipairs(row.children) do
            if cell.kind=="DButton" and cell.w==36 then buttons[#buttons+1]=cell end
        end
    end
    assert(#buttons==3)
    buttons[1]:DoClick()
    assert(ally.muted and ally.muteCalls==1 and requests==0)
    ZPScoreboard:ToggleMute(2); assert(not ally.muted and ally.muteCalls==2)
    ZPScoreboard:ToggleMute(1); assert(me.muteCalls==0)
    ally.invalid=true; ZPScoreboard:ToggleMute(2); assert(ally.muteCalls==2)
    ZPScoreboard:ToggleMute(999)
    GM:ScoreboardHide(); ZPScoreboard:ToggleMute(3); assert(zombie.muteCalls==0)
`));

test("bot mute state stays per connection even when engine mute is shared, and sound labels are centered", () => run(setup + `
    ally.bot=true; zombie.bot=true
    local sharedMuted=false
    for _,ply in ipairs({ally,zombie}) do
        ply.IsMuted=function() return sharedMuted end
        ply.SetMuted=function(self,value) sharedMuted=value; self.muteCalls=self.muteCalls+1 end
    end
    GM:ScoreboardShow()
    local buttons={}
    for _,row in ipairs(panels[1].children[1].children) do
        for _,cell in ipairs(row.children) do
            if cell.kind=="DButton" and cell.w==36 then buttons[#buttons+1]=cell end
        end
    end
    buttons[1]:DoClick()
    local state=ZPScoreboard:GetState()
    assert(state.Teams[1].Players[1].Muted and not state.Teams[2].Players[1].Muted)
    assert(ally.muteCalls==0 and zombie.muteCalls==0 and not sharedMuted)
    buttons[2]:DoClick(); buttons[1]:DoClick()
    state=ZPScoreboard:GetState()
    assert(not state.Teams[1].Players[1].Muted and state.Teams[2].Players[1].Muted)
    for _,button in ipairs(buttons) do
        draw.DrawText=function(label,font,x,y)
            local textWidth,textHeight=surface.GetTextSize(label)
            assert(x==(button.w-textWidth)/2 and y==(button.h-textHeight)/2)
        end
        button:Paint(button.w,button.h)
    end
`));

test("player name dropdown opens only the selected human profile and closes with the scoreboard", () => run(setup + `
    zombie.bot=true
    GM:ScoreboardShow()
    local names={}
    for _,row in ipairs(panels[1].children[1].children) do
        for _,cell in ipairs(row.children) do
            if cell.kind=="DButton" and cell.w~=36 then names[#names+1]=cell end
        end
    end
    assert(#names==4)
    names[1]:DoClick()
    local first=dropdowns[1]
    assert(first.opened and first.children[1].enabled)
    first.children[1]:DoClick()
    assert(ally.profileCalls==1 and not me.profileCalls and not zombie.profileCalls and requests==0)
    names[3]:DoClick()
    assert(first.removed and not dropdowns[2].children[1].enabled)
    dropdowns[2].children[1]:DoClick(); assert(not zombie.profileCalls)
    names[1]:DoClick(); ally.invalid=true
    dropdowns[3].children[1]:DoClick(); assert(ally.profileCalls==1)
    GM:ScoreboardHide(); assert(dropdowns[3].removed)
    ZPScoreboard:ViewProfile(4); assert(not spectator.profileCalls)
`));

test("scoreboard layout supports long names, many players and resolution changes in all themes", () => run(setup + `
    local screenWidth,screenHeight=1280,720
    function ScrW() return screenWidth end
    function ScrH() return screenHeight end
    for id=5,60 do scorePlayer(id,"Long player name "..string.rep("abc",30),TEAM_HUMANS,id) end
    for _,resolution in ipairs({{640,480},{900,600},{1280,720},{1920,1080},{2560,1080}}) do
        screenWidth,screenHeight=resolution[1],resolution[2]
        for _,id in ipairs({"classic","hl2","cs16"}) do
            ZPThemes:UseTheme(id); GM:ScoreboardShow(); ZPScoreboard:Refresh(); paintAll()
            local frame
            for _,panel in ipairs(panels) do
                if panel.kind=="DFrame" and not panel.removed then frame=panel end
            end
            assert(frame.w<=screenWidth-32 and frame.h<=screenHeight-180 and frame.keyboard==false)
            local scroll=frame.children[1]
            assert(scroll.kind=="DScrollPanel" and scroll.h>0 and scroll.y+scroll.h<frame.h)
            for _,row in ipairs(scroll.children) do
                assert(row.w<=scroll.w and row.h>0)
                for _,cell in ipairs(row.children) do
                    assert(cell.x>=0 and cell.x+cell.w<=row.w and cell.h<=row.h)
                end
            end
        end
    end
    GM:ScoreboardHide()
`));

test("addon themes can replace the scoreboard or inherit the palette-based default", () => run(setup + `
    local base=ZPThemes:GetTheme()
    local opened,updated,destroyed=0,0,0
    ZPThemes:RegisterTheme("custom",{Name="Custom",Palette=base.Palette,CreateWeaponMenu=base.CreateWeaponMenu,
        PaintPlayerHUD=base.PaintPlayerHUD,CreateScoreboard=function() return {
            Open=function(self,state,actions) opened=opened+1; assert(actions==ZPScoreboard) end,
            Update=function(self,state) updated=updated+1 end,
            Destroy=function(self) destroyed=destroyed+1 end} end})
    ZPThemes:UseTheme("custom"); GM:ScoreboardShow(); ZPScoreboard:Refresh()
    assert(opened==1 and updated==1)
    ZPThemes:RegisterTheme("fallback",{Name="Fallback",Palette=base.Palette,
        CreateWeaponMenu=base.CreateWeaponMenu,PaintPlayerHUD=base.PaintPlayerHUD})
    ZPThemes:UseTheme("fallback"); paintAll()
    assert(destroyed==1 and ZPScoreboard:GetState().Open and panels[1].popup)
    GM:ScoreboardHide()
`));
