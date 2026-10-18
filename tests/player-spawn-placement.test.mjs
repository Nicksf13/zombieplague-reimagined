import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { spawnSetup } from "./helpers/player-spawns.mjs";

const setup = spawnSetup + `
local function spawned(ply,transition) hooks.PlayerSpawn.ZPCheckPlayerSpawnPosition(ply,transition) end
local function assertSeparated()
    for i,first in ipairs(players) do for j,second in ipairs(players) do if i<j then
        local amin,amax=first:GetHull(); local bmin,bmax=second:GetHull()
        assert(not intersects(first:GetPos(),amin,amax,second:GetPos(),bmin,bmax), "final spawn hulls overlap")
    end end end
end
`;

test("zig-zag's six spawns repair final positions when the engine does not apply selected destinations", () => run(setup + `
    local coordinates={{256,-556,128},{256,-464,128},{256,-656,128},
        {1791.2,-555.996,128},{1790.32,-456,128},{1792,-647.993,128}}
    for _,p in ipairs(coordinates) do addPoint("info_player_start",table.unpack(p)) end
    local selected={}
    for i=1,6 do
        local ply=newPlayer(i%2==0 and TEAM_ZOMBIES or TEAM_HUMANS)
        local point=select(ply); assert(not selected[point]); selected[point]=true
        publish(ply,points[1]); spawned(ply)
    end
    finishSpawns(); assertSeparated()
    local repairs=0; for _,ply in ipairs(players) do repairs=repairs+(ply.teleports or 0) end
    assert(repairs==5 and #spawnChecks==0, "repair is a single deferred spawn check")
`));

test("a live occupant keeps its position and the spawning player moves to a free location", () => run(setup + `
    local a=addPoint("info_player_start"); local b=addPoint("info_player_start")
    local occupant,joining=newPlayer(),newPlayer()
    publish(occupant,a); assert(select(joining)==b)
    publish(joining,a); spawned(joining); finishSpawns()
    assert(not occupant.teleports and joining.teleports==1 and joining.position.x==b.position.x)
    assertSeparated()
`));

test("safe final positions are preserved, and future combat movement is never audited", () => run(setup + `
    local a=addPoint("info_player_start"); local b=addPoint("info_player_start")
    local first,second=newPlayer(),newPlayer()
    publish(first,select(first)); spawned(first)
    publish(second,select(second)); spawned(second)
    finishSpawns(); assertSeparated()
    assert(not first.teleports and not second.teleports)
    second.position=first.position; finishSpawns()
    assert(not first.teleports and not second.teleports, "normal movement is outside spawn repair")
`));

test("cleanup and later spawn callbacks invalidate outdated final-position checks", () => run(setup + `
    local a=addPoint("info_player_start"); addPoint("info_player_start")
    local first,second=newPlayer(),newPlayer(); publish(first,a); publish(second,a)
    spawned(second); cleanup(); finishSpawns(); assert(not second.teleports)
    spawned(second); spawned(second); finishSpawns(); assert(second.teleports==1)
`));

test("final-position checks skip transitions, removed players, deaths and spectators", () => run(setup + `
    local a=addPoint("info_player_start"); addPoint("info_player_start")
    local occupant,joining=newPlayer(),newPlayer(); publish(occupant,a); publish(joining,a)
    spawned(joining,true); finishSpawns(); assert(not joining.teleports)
    spawned(joining); joining.invalid=true; finishSpawns(); joining.invalid=false
    spawned(joining); joining.alive=false; finishSpawns(); joining.alive=true
    spawned(joining); joining.team=TEAM_SPECTATOR; finishSpawns(); joining.team=TEAM_HUMANS
    spawned(joining); joining.ZPVoluntarySpectator=true; finishSpawns()
    assert(not joining.teleports)
`));

test("an exhausted map does not trigger repeated or futile relocation", () => run(setup + `
    local a=addPoint("info_player_start")
    local first,second=newPlayer(),newPlayer(); publish(first,a); publish(second,a)
    spawned(first); spawned(second); finishSpawns()
    assert(not first.teleports and not second.teleports and #spawnChecks==0)
`));

test("same physical spawn stays reserved across team queues even before hull initialization", () => run(setup + `
    GM.TeamBased=true
    local a=addPoint("info_player_start"); local b=addPoint("info_player_start")
    configured[TEAM_HUMANS]={a,b}; configured[TEAM_ZOMBIES]={a,b}
    local first,second=newPlayer(TEAM_HUMANS),newPlayer(TEAM_ZOMBIES)
    for _,ply in ipairs({first,second}) do ply.mins=Vector(0,0,0); ply.maxs=Vector(0,0,0) end
    local one=select(first); local two=select(second)
    assert(one~=two, "point ownership must not depend on a nonzero collision hull")
`));
