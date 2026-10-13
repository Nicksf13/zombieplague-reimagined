import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
FCVAR_ARCHIVE=128
local options, entities, consoleCalls, lightStyles, broadcasts={}, {}, {}, {}, 0
local changes={}
local clock={hour=0,min=0,sec=0}
os.date=function(format) assert(format=="*t"); return clock end
cvars.AddChangeCallback=function(name,callback,id)
    assert(id=="ZPMapEnvironment"); changes[name]=callback
end
function CreateConVar(name,default,flags,help)
    assert(flags==FCVAR_ARCHIVE and help=="")
    if options[name]==nil then options[name]=default end
    return {GetBool=function() return options[name]=="1" end,
        GetString=function() return options[name] end}
end
function entity(class)
    return {GetClass=function() return class end, inputs={}, keys={}, direction={x=0,y=1,z=0},
        GetTopColor=function() return Vector(0.2,0.5,1) end,
        GetBottomColor=function() return Vector(0.8,1,1) end,
        GetSunNormal=function() return Vector(0.4,0,0.01) end,
        GetSunColor=function() return Vector(0.2,0.1,0) end,
        GetDuskIntensity=function() return 1 end, GetStarFade=function() return 1.5 end,
        GetInternalVariable=function(self,name) assert(name=="m_vDirection"); return self.direction end,
        SetSaveValue=function(self,name,value) assert(name=="m_vDirection"); self.direction=value; return true end,
        Spawn=function() end, Activate=function() end,
        Remove=function(self)
            for i,entry in ipairs(entities[class] or {}) do
                if entry==self then table.remove(entities[class],i); break end
            end
        end,
        SetKeyValue=function(self,key,value) self.keys[key]=value end,
        Fire=function(self,input,value,delay)
            assert(value=="" and delay==0)
            self.inputs[#self.inputs+1]=input
        end}
end
ents={FindByClass=function(class) return entities[class] or {} end,
    Create=function(class)
        local created=entity(class)
        entities[class]=entities[class] or {}; table.insert(entities[class],created)
        return created
    end}
function Vector(x,y,z) return {x=x,y=y,z=z} end
function IsValid(value) return value~=nil and value~=false and not value.removed end
engine={LightStyle=function(style,pattern)
    assert(style==0); lightStyles[#lightStyles+1]=pattern
end}
function RunConsoleCommand(name,value) consoleCalls[#consoleCalls+1]={name,value} end
net.Broadcast=function() broadcasts=broadcasts+1 end
net.WriteFloat=function(value) sent[#sent+1]=value end
local function start() include("sv_map_environment.lua") end
`;

test("procedural sky follows sun through day, twilight and night and restores map colors for a fixed sky", () => run(setup + `
    options.zp_map_day_cycle="1"
    local sky=entity("env_skypaint"); entities.env_skypaint={sky}
    start(); hooks.InitPostEntity.ZPMapEnvironment()
    local midnight=sky.keys.topcolor
    assert(tonumber(sky.keys.starfade)==1.5 and tonumber(sky.keys.duskintensity)==0)
    clock.hour=12; timers.ZPMapSunOrbit[2]()
    assert(sky.keys.topcolor~=midnight and tonumber(sky.keys.starfade)==0)
    assert(sky.keys.sunnormal and consoleCalls[#consoleCalls][2]=="painted")
    clock.hour=18; timers.ZPMapSunOrbit[2]()
    assert(tonumber(sky.keys.duskintensity)>0.99)
    options.zp_map_skybox="sky_fixed"
    changes.zp_map_skybox("zp_map_skybox","","sky_fixed"); timers.ZPMapNightExposure[2]()
    assert(sky.keys.topcolor=="0.2 0.5 1" and tonumber(sky.keys.starfade)==1.5)
    assert(consoleCalls[#consoleCalls][2]=="sky_fixed" and #entities.env_skypaint==1)
`));

test("map ambience is silenced before spawn and cannot be reactivated by map inputs", () => run(setup + `
    start()
    local key, input=hooks.EntityKeyValue.ZPMapEnvironment, hooks.AcceptInput.ZPMapEnvironment
    local ambient=entity("ambient_generic")
    assert(key(ambient,"message","music/hl2_song1.mp3")=="common/null.wav")
    assert(key(ambient,"Message","ambient/wind.wav")=="common/null.wav")
    assert(key(ambient,"targetname","alarm")==nil)
    for _,command in ipairs({"PlaySound","ToggleSound","Volume","FadeIn"}) do
        assert(input(ambient,command)==true)
    end
    assert(input(ambient,"StopSound")==nil and input(ambient,"Kill")==nil)
    for _,class in ipairs({"env_soundscape","env_soundscape_proxy","env_soundscape_triggerable"}) do
        local soundscape=entity(class)
        assert(key(soundscape,"StartDisabled","0")=="1")
        assert(key(soundscape,"soundscape","street.wind")==nil and soundscape.keys.StartDisabled=="1")
        assert(input(soundscape,"Enable")==true and input(soundscape,"ToggleEnabled")==true)
        assert(input(soundscape,"Disable")==nil)
    end
    assert(key(entity("trigger_soundscape"),"soundscape","street_audio")=="")
    assert(key(entity("trigger_soundscape"),"OnStartTouch","door,Open,,0,-1")==nil)
    assert(key(entity("prop_physics"),"message","sound.wav")==nil)
    assert(input(entity("func_door"),"Open")==nil)
    assert(input(entity("player"),"PlaySound")==nil)
`));

test("optional 24-hour cycle follows server wall clock, with midnight minimum and noon maximum", () => run(setup + `
    options.zp_map_day_cycle="1"; options.zp_map_night="0"
    options.zp_map_night_brightness="b"; options.zp_map_night_exposure="0"
    start()
    assert(timers.ZPMapDayCycle[1]==30)
    hooks.EntityKeyValue.ZPMapEnvironment(entity("worldspawn"),"skyname","sky_day")
    hooks.InitPostEntity.ZPMapEnvironment()
    assert(lightStyles[1]=="b" and sent[2]=="m" and sent[3]==0 and sent[4]==true)
    local function tick(hour,min,sec)
        clock={hour=hour,min=min or 0,sec=sec or 0}
        timers.ZPMapDayCycle[2]()
    end
    tick(6); assert(math.abs(sent[3]-0.25)<0.000001 and sent[4]==true)
    tick(12); assert(sent[3]==1 and sent[4]==true)
    tick(18); assert(math.abs(sent[3]-0.25)<0.000001)
    tick(0); assert(sent[3]==0)
    assert(#lightStyles==5, "Static props must refresh when the engine brightness band changes")
    tick(0,0,30)
    assert(#lightStyles==5 and sent[4]==false, "Continuous changes within a band skip rebuilding")
    tick(9,30,15)
    local expected=(1-math.cos((9*3600+30*60+15)/86400*math.pi*2))/2
    assert(math.abs(sent[3]-expected*expected)<0.000001)
    local before=broadcasts; tick(9,30,15); assert(broadcasts==before)
    tick(19,23)
    assert(sent[3]>0.09 and sent[3]<0.11, "Early evening must be dim, without reaching midnight darkness")
    tick(23,59,59); local previous=sent[3]; tick(0,0,0)
    assert(math.abs(previous-sent[3])<0.000001, "Midnight wrap must not jump")
`));

test("cycle uses fixed night controls as minimum, honors noon and restores fixed mode when disabled", () => run(setup + `
    options.zp_map_day_cycle="1"; options.zp_map_night_brightness="b"
    options.zp_map_night_exposure="20"
    start(); hooks.InitPostEntity.ZPMapEnvironment()
    assert(math.abs(sent[3]-0.05)<0.000001)
    clock.hour=6; timers.ZPMapDayCycle[2]()
    assert(math.abs(sent[3]-0.2875)<0.000001)
    clock.hour=12; timers.ZPMapDayCycle[2](); assert(sent[3]==1)
    options.zp_map_day_cycle="0"
    changes.zp_map_day_cycle("zp_map_day_cycle","1","0")
    timers.ZPApplyMapLighting[2]()
    assert(sent[2]=="b" and sent[3]==0.2 and sent[4]==true)
    local before=broadcasts; timers.ZPMapDayCycle[2](); assert(broadcasts==before)
    options.zp_map_night="0"
    changes.zp_map_night("zp_map_night","1","0"); timers.ZPApplyMapLighting[2]()
    assert(sent[2]=="m" and sent[3]==1)
    options.zp_map_day_cycle="1"; clock.hour=0
    changes.zp_map_day_cycle("zp_map_day_cycle","0","1"); timers.ZPApplyMapLighting[2]()
    assert(sent[2]=="m" and math.abs(sent[3]-0.05)<0.000001)
`));

test("cycle uses procedural daytime sky and sun, keeps custom skies and survives cleanup and late joins", () => run(setup + `
    options.zp_map_day_cycle="1"; options.zp_map_night_exposure="0"
    start()
    local sun=entity("env_sun"); entities.env_sun={sun}
    local key=hooks.EntityKeyValue.ZPMapEnvironment
    assert(key(entity("worldspawn"),"skyname","sky_day")=="painted")
    hooks.InitPostEntity.ZPMapEnvironment()
    assert(consoleCalls[#consoleCalls][2]=="painted" and sun.inputs[#sun.inputs]=="TurnOff")
    clock.hour=6; timers.ZPMapDayCycle[2]()
    assert(consoleCalls[#consoleCalls][2]=="painted" and sun.inputs[#sun.inputs]=="TurnOn")
    assert(hooks.AcceptInput.ZPMapEnvironment(sun,"TurnOn")==nil)
    options.zp_map_skybox="sky_custom"
    changes.zp_map_skybox("zp_map_skybox","","sky_custom"); timers.ZPMapNightExposure[2]()
    clock.hour=18; timers.ZPMapDayCycle[2]()
    assert(consoleCalls[#consoleCalls][2]=="sky_custom" and sun.inputs[#sun.inputs]=="TurnOff")
    assert(hooks.AcceptInput.ZPMapEnvironment(sun,"TurnOn")==true)
    hooks.PostCleanupMap.ZPMapEnvironment()
    assert(sun.inputs[#sun.inputs]=="TurnOff" and sent[4]==true)
    -- A sleeping/empty server can jump hours before its next periodic callback.
    clock.hour=12
    local latePlayer={}
    hooks.ZPPlayerEnvironmentReady.ZPMapEnvironment(latePlayer)
    assert(sent[2]=="m" and sent[3]==1 and sent[4]==true and sent.recipient==latePlayer)
    assert(sun.inputs[#sun.inputs]=="TurnOn")
    clock.hour=0; hooks.ZPPlayerEnvironmentReady.ZPMapEnvironment(latePlayer)
    assert(sent[3]==0 and sent.recipient==latePlayer)
`));

test("night sky, lighting and ambience survive cleanup and synchronize late joiners", () => run(setup + `
    start()
    local sun=entity("env_sun")
    entities.env_sun={sun}
    entities.ambient_generic={entity("ambient_generic")}
    entities.env_soundscape={entity("env_soundscape")}
    entities.env_soundscape_proxy={entity("env_soundscape_proxy")}
    entities.env_soundscape_triggerable={entity("env_soundscape_triggerable")}
    assert(hooks.EntityKeyValue.ZPMapEnvironment(entity("worldspawn"),"skyname","painted")=="sky_borealis01")
    hooks.InitPostEntity.ZPMapEnvironment()
    assert(lightStyles[1]=="c" and sun.inputs[1]=="TurnOff" and broadcasts==1)
    assert(consoleCalls[1][1]=="sv_skyname" and consoleCalls[1][2]=="sky_borealis01")
    assert(entities.ambient_generic[1].inputs[1]=="StopSound")
    for _,class in ipairs({"env_soundscape","env_soundscape_proxy","env_soundscape_triggerable"}) do
        assert(entities[class][1].inputs[1]=="Disable")
    end
    assert(hooks.AcceptInput.ZPMapEnvironment(sun,"TurnOn")==true)
    assert(hooks.AcceptInput.ZPMapEnvironment(sun,"TurnOff")==nil)
    hooks.PostCleanupMap.ZPMapEnvironment()
    assert(#lightStyles==2 and broadcasts==2 and #sun.inputs==2)
    local latePlayer={}
    hooks.ZPPlayerEnvironmentReady.ZPMapEnvironment(latePlayer)
    assert(sent[1]=="ZPRefreshMapLighting" and sent[2]=="c" and sent.recipient==latePlayer and broadcasts==2)
    assert(registered.ZPRefreshMapLighting)
`));

test("sun moves from sunrise through noon to sunset during a match and restores its original direction", () => run(setup + `
    options.zp_map_day_cycle="1"; options.zp_map_night="0"
    start()
    local sun=entity("env_sun"); entities.env_sun={sun}
    local original=sun.direction
    hooks.EntityKeyValue.ZPMapEnvironment(entity("worldspawn"),"skyname","sky_original")
    hooks.InitPostEntity.ZPMapEnvironment()
    assert(timers.ZPMapSunOrbit[1]==1 and sun.direction.z==-1)
    clock.hour=6; timers.ZPMapSunOrbit[2]()
    assert(math.abs(sun.direction.x-1)<0.000001 and math.abs(sun.direction.z)<0.000001)
    clock.hour=9; timers.ZPMapSunOrbit[2]()
    assert(sun.direction.x>0 and sun.direction.z>0)
    clock.hour=12; timers.ZPMapSunOrbit[2]()
    assert(math.abs(sun.direction.x)<0.000001 and math.abs(sun.direction.z-1)<0.000001)
    clock.sec=1; timers.ZPMapSunOrbit[2]()
    assert(sun.direction.x<0, "Solar position must move between lighting broadcasts")
    clock.hour=18; clock.sec=0; timers.ZPMapSunOrbit[2]()
    assert(math.abs(sun.direction.x+1)<0.000001 and math.abs(sun.direction.z)<0.000001)
    assert(sun.inputs[#sun.inputs]=="TurnOff")
    assert(#lightStyles==1, "Moving the sun must not rebuild world lightmaps")
    options.zp_map_day_cycle="0"; changes.zp_map_day_cycle("zp_map_day_cycle","1","0")
    timers.ZPApplyMapLighting[2]()
    assert(sun.direction.x==original.x and sun.direction.y==original.y and sun.direction.z==original.z)
    assert(consoleCalls[#consoleCalls][2]=="sky_original")
    assert(#entities.env_skypaint==0, "Remove only the procedural sky created by the cycle")
`));

test("solar cycle creates missing sun and sky once, recreates them after cleanup and preserves map sky entities", () => run(setup + `
    options.zp_map_day_cycle="1"; clock.hour=12
    start()
    assert(entities.env_sun==nil, "Do not create entities before InitPostEntity")
    hooks.InitPostEntity.ZPMapEnvironment()
    local first=entities.env_sun[1]
    assert(#entities.env_sun==1 and #entities.env_skypaint==1 and first.direction.z==1)
    timers.ZPMapSunOrbit[2](); timers.ZPMapSunOrbit[2]()
    assert(#entities.env_sun==1 and #entities.env_skypaint==1)
    first.removed=true; entities.env_sun={}; entities.env_skypaint={}
    hooks.PostCleanupMap.ZPMapEnvironment()
    assert(#entities.env_sun==1 and entities.env_sun[1]~=first and #entities.env_skypaint==1)
    hooks.ShutDown.ZPSunOrbit()
    assert(#entities.env_sun==0 and #entities.env_skypaint==0)
    local mapSky=entity("env_skypaint"); entities.env_skypaint={mapSky}
    hooks.PostCleanupMap.ZPMapEnvironment()
    options.zp_map_day_cycle="0"; changes.zp_map_day_cycle("zp_map_day_cycle","1","0")
    timers.ZPApplyMapLighting[2]()
    assert(#entities.env_skypaint==1 and entities.env_skypaint[1]==mapSky)
`));

test("disabled options preserve the original map and custom sky works independently of night", () => run(setup + `
    options.zp_map_mute_ambient="0"; options.zp_map_night="0"
    start()
    local key=hooks.EntityKeyValue.ZPMapEnvironment
    assert(key(entity("ambient_generic"),"message","ambient/wind.wav")==nil)
    assert(key(entity("env_soundscape"),"StartDisabled","0")==nil)
    assert(key(entity("trigger_soundscape"),"soundscape","street_audio")==nil)
    assert(key(entity("worldspawn"),"skyname","original")==nil)
    assert(hooks.AcceptInput.ZPMapEnvironment(entity("ambient_generic"),"PlaySound")==nil)
    assert(hooks.AcceptInput.ZPMapEnvironment(entity("env_soundscape"),"ToggleEnabled")==nil)
    assert(hooks.AcceptInput.ZPMapEnvironment(entity("env_sun"),"TurnOn")==nil)
    hooks.InitPostEntity.ZPMapEnvironment()
    hooks.ZPPlayerEnvironmentReady.ZPMapEnvironment({})
    assert(#lightStyles==0 and #consoleCalls==0 and broadcasts==0)
    assert(sent[1]=="ZPRefreshMapLighting" and sent[2]=="m")
    options.zp_map_skybox="sky_custom"
    hooks.PostCleanupMap.ZPMapEnvironment()
    assert(consoleCalls[1][2]=="sky_custom" and #lightStyles==0)
    assert(key(entity("worldspawn"),"skyname","original")=="sky_custom")
`));

test("night brightness rejects patterns that flicker or disable dynamic lights", () => run(setup + `
    start()
    for _,value in ipairs({"a","z","abc","","C","1"}) do
        options.zp_map_night_brightness=value
        hooks.InitPostEntity.ZPMapEnvironment()
        assert(lightStyles[#lightStyles]=="c")
    end
    for _,value in ipairs({"b","f","m"}) do
        options.zp_map_night_brightness=value
        hooks.InitPostEntity.ZPMapEnvironment()
        assert(lightStyles[#lightStyles]==value)
    end
`));

test("night changes reset scene brightness and lightmaps for connected and late players", () => run(setup + `
    start(); hooks.InitPostEntity.ZPMapEnvironment()
    assert(sent[2]=="c" and broadcasts==1)
    options.zp_map_night="0"
    changes.zp_map_night("zp_map_night","1","0")
    -- A brightness edit while switching off must not cancel the pending reset.
    options.zp_map_night_brightness="b"
    changes.zp_map_night_brightness("zp_map_night_brightness","c","b")
    timers.ZPApplyMapLighting[2]()
    assert(lightStyles[2]=="m" and sent[2]=="m" and broadcasts==2)
    local latePlayer={}
    hooks.ZPPlayerEnvironmentReady.ZPMapEnvironment(latePlayer)
    assert(sent[2]=="m" and sent.recipient==latePlayer and broadcasts==2)
    options.zp_map_night_brightness="c"
    options.zp_map_night="1"
    changes.zp_map_night("zp_map_night","0","1")
    timers.ZPApplyMapLighting[2]()
    assert(lightStyles[3]=="c" and sent[2]=="c" and broadcasts==3)
`));

test("console brightness changes refresh clients without reloading and respect night mode", () => run(setup + `
    start()
    options.zp_map_night_brightness="b"
    changes.zp_map_night_brightness("zp_map_night_brightness","c","b")
    options.zp_map_night_brightness="d"
    changes.zp_map_night_brightness("zp_map_night_brightness","b","d")
    assert(#lightStyles==0 and broadcasts==0)
    assert(timers.ZPApplyMapLighting[1]==0.2)
    timers.ZPApplyMapLighting[2]()
    assert(#lightStyles==1 and lightStyles[1]=="d" and broadcasts==1)
    options.zp_map_night_brightness="a"
    changes.zp_map_night_brightness("zp_map_night_brightness","d","a")
    timers.ZPApplyMapLighting[2]()
    assert(lightStyles[2]=="c" and broadcasts==2)
    options.zp_map_night="0"
    timers.ZPApplyMapLighting=nil
    changes.zp_map_night_brightness("zp_map_night_brightness","a","b")
    assert(timers.ZPApplyMapLighting==nil)
    assert(#lightStyles==2 and broadcasts==2)
`));

test("server exposure supports black, clamps input and synchronizes late players and night resets", () => run(setup + `
    start(); hooks.InitPostEntity.ZPMapEnvironment()
    assert(sent[3]==1 and sent[4]==true, "Default must preserve the existing scene")
    local latePlayer={}
    for _,entry in ipairs({{"0",0},{"10",0.1},{"50",0.5},{"100",1},
        {"-20",0},{"120",1},{"invalid",1},{"",1},{"nan",1}}) do
        options.zp_map_night_exposure=entry[1]
        hooks.ZPPlayerEnvironmentReady.ZPMapEnvironment(latePlayer)
        assert(sent[3]==entry[2] and sent.recipient==latePlayer)
    end
    options.zp_map_night_exposure="0"
    changes.zp_map_night_exposure("zp_map_night_exposure","100","0")
    options.zp_map_night_exposure="10"
    changes.zp_map_night_exposure("zp_map_night_exposure","0","10")
    assert(broadcasts==1 and timers.ZPMapNightExposure[1]==0.2)
    timers.ZPMapNightExposure[2]()
    assert(sent[3]==0.1 and sent[4]==false and broadcasts==2 and #lightStyles==1)
    options.zp_map_night_exposure="0"; options.zp_map_night="0"
    changes.zp_map_night("zp_map_night","1","0")
    timers.ZPApplyMapLighting[2]()
    assert(sent[2]=="m" and sent[3]==1 and sent[4]==true)
    hooks.ZPPlayerEnvironmentReady.ZPMapEnvironment(latePlayer)
    assert(sent[3]==1 and sent.recipient==latePlayer)
`));

