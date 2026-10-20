import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
include("sh_radar_rules.lua")
HUMANS_COLOR=Color(71,141,255); ZOMBIES_COLOR=Color(255,56,56)
CurTime=function() return 10 end
ScrW=function() return 1000 end; ScrH=function() return 1000 end
local shapes,ink={},nil
draw={NoTexture=function() end,DrawText=function() end,RoundedBox=function(radius,x,y,width,height,color)
    if width==8 and height==8 then shapes[#shapes+1]={Kind="dot",Color=color} end
end}
surface={SetMaterial=function() end,DrawTexturedRect=function() end,
    SetDrawColor=function(r,g,b,a) ink={r=r,g=g,b=b,a=a} end,
    DrawPoly=function(points) shapes[#shapes+1]={Kind="triangle",Points=points,Color=ink} end}
language={GetPhrase=function(key) return key end}
local paint=include("cl_radar_hud.lua").paintRadar
local palette={Accent=Color(10,80,160),Text=Color(240,230,220,200),Surface=Color(0,0,0),Muted=Color(100,100,100)}
local overview={Material="map.png",X=-1000,Y=1000,Scale=2,Size=1024,
    Layers={{Material="floor.png",MinZ=-100,MaxZ=100}}}
local state={Version=1,Team=TEAM_HUMANS,Enabled=true,ScanUntil=0,Contacts={}}
for _,source in ipairs({"ally","attack","scan"}) do
    for _,z in ipairs({0,-256,256}) do
        local id=#state.Contacts+1
        state.Contacts[id]={ID=id,Position={x=id*20,y=0,z=z},Source=source,Created=9,Expires=12}
    end
end
state.Contacts[10]={ID=10,Position={x=0,y=0,z=0},Source="ally",Created=8,Expires=9}
state.Contacts[11]={ID=11,Position={x=10000,y=0,z=0},Source="attack",Created=9,Expires=12}
local function render(theme,layer)
    shapes={}
    -- Keep the local player's arrow outside the overview so only contact shapes are recorded.
    paint(overview,{},state,{x=-5000,y=0,z=0},0,palette,theme,layer)
    return shapes
end
`;

test("allied and detected hostile markers use dots, downward triangles and upward triangles in every theme", () => run(setup + `
    for _,theme in ipairs({"classic","hl2","cs16","addon"}) do
        local rendered=render(theme,0)
        assert(#rendered==9,"Expired and off-map contacts must not draw markers")
        for index,shape in ipairs(rendered) do
            local height=(index-1)%3
            assert(shape.Kind==(height==0 and "dot" or "triangle"))
            if height~=0 then
                local points=shape.Points
                assert(#points==3 and points[2].y==points[3].y)
                assert((points[1].y>points[2].y)==(height==1),"Triangle direction must match the contact's floor")
                local a,b,c=points[1],points[2],points[3]
                assert((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0,"Both triangles must use the engine's clockwise vertex order")
            end
            local expected=index<=3 and HUMANS_COLOR or ZOMBIES_COLOR
            assert(shape.Color.r==expected.r and shape.Color.g==expected.g and shape.Color.b==expected.b)
            assert(shape.Color.a==(index<=3 and 255 or 170),"Allies stay solid while enemy snapshots fade")
        end
    end
`));

test("radar contacts use the perceived team's color for zombie viewers too", () => run(setup + `
    state.Team=TEAM_ZOMBIES
    local rendered=render("classic",0)
    for index,shape in ipairs(rendered) do
        local expected=index<=3 and ZOMBIES_COLOR or HUMANS_COLOR
        assert(shape.Color.r==expected.r and shape.Color.g==expected.g and shape.Color.b==expected.b)
    end
`));

test("the local position arrow uses the viewer's own team color", () => run(setup + `
    state.Contacts={}
    for _,teamID in ipairs({TEAM_HUMANS,TEAM_ZOMBIES}) do
        state.Team=teamID; shapes={}
        paint(overview,{},state,{x=0,y=0,z=0},0,palette,"classic",0)
        local expected=teamID==TEAM_HUMANS and HUMANS_COLOR or ZOMBIES_COLOR
        assert(#shapes==1 and shapes[1].Color.r==expected.r and shapes[1].Color.b==expected.b)
    end
`));

test("single-image overviews still show contact elevation relative to the player", () => run(setup + `
    overview.Layers=nil
    local rendered=render("classic")
    for index,shape in ipairs(rendered) do
        assert(shape.Kind==((index-1)%3==0 and "dot" or "triangle"))
    end
    assert(ZPRadarRules.Elevation(nil,64,0)==0 and ZPRadarRules.Elevation(nil,-64,0)==0)
    assert(ZPRadarRules.Elevation(nil,65,0)==1 and ZPRadarRules.Elevation(nil,-65,0)==-1)
    assert(ZPRadarRules.Elevation(nil,1024,1024)==0)
`));
