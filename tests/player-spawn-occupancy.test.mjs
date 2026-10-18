import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { spawnSetup } from "./helpers/player-spawns.mjs";

test("two training-map spawns remain distinct when earlier players still report the old round's position", () => run(spawnSetup + `
    local a=addPoint("info_player_start",1792,-556,128)
    local b=addPoint("info_player_start",256,-556,128)
    local first,second=newPlayer(),newPlayer()
    first.alive=true; second.alive=true; first.position=a:GetPos(); second.position=a:GetPos()
    local selectedFirst=select(first)
    assert(selectedFirst==b)
    -- Deliberately do not publish the first engine teleport before selecting the second.
    local selectedSecond=select(second)
    assert(selectedSecond==a, "a rejected pending point cannot make the queue reuse the reserved point")
    publish(first,selectedFirst); publish(second,selectedSecond)
    assert(first.position.x~=second.position.x)
`));

test("repeated spawn-selection requests for one player consume only one point in a tick", () => run(spawnSetup + `
    local a=addPoint("info_player_start"); local b=addPoint("info_player_start")
    local first,second=newPlayer(),newPlayer()
    local selected=select(first)
    for index=1,8 do assert(select(first)==selected) end
    assert(select(second)~=selected, "repeated callbacks must not drain the second player's slot")
`));

test("same-position spawn entities and nearby overlapping hulls cannot bypass reservations", () => run(spawnSetup + `
    local a=addPoint("info_player_start",0,0,0)
    addPoint("info_player_counterterrorist",0,0,0)
    addPoint("info_player_start",20,0,0)
    local distant=addPoint("info_player_start",256,0,0)
    local first,second=newPlayer(),newPlayer()
    assert(select(first)==a)
    assert(select(second)==distant, "different entities do not create separate physical space")
`));

test("cross-team queues share physical reservations before engine positions become visible", () => run(spawnSetup + `
    GM.TeamBased=true
    local a=addPoint("info_player_start"); local b=addPoint("info_player_start")
    configured[TEAM_HUMANS]={a,b}; configured[TEAM_ZOMBIES]={a,b}
    local first=select(newPlayer(TEAM_HUMANS))
    assert(select(newPlayer(TEAM_ZOMBIES))~=first)
`));

test("live player hulls block locations even if an addon suitability hook always returns true", () => run(spawnSetup + `
    local a=addPoint("info_player_start",0,0,0)
    addPoint("info_player_start",36,0,0)
    local distant=addPoint("info_player_start",256,0,0)
    local first,second=newPlayer(),newPlayer()
    first.mins=Vector(-32,-32,0); first.maxs=Vector(32,32,90)
    publish(first,a); now=now+0.1
    GM.IsSpawnpointSuitable=function() return true end
    assert(select(second)==distant, "actual hull width must prevent a partly overlapping spawn")
`));

test("native geometry still allocates two locations if suitability rejects the entire pool", () => run(spawnSetup + `
    addPoint("info_player_start"); addPoint("info_player_start")
    GM.IsSpawnpointSuitable=function() return false end
    local first=select(newPlayer())
    assert(select(newPlayer())~=first, "fallbacks must retain reservations and unused locations")
`));

test("a published player's larger new hull is respected before the next tick", () => run(spawnSetup + `
    local a=addPoint("info_player_start",0,0,0)
    addPoint("info_player_start",40,0,0)
    local distant=addPoint("info_player_start",256,0,0)
    local first,second=newPlayer(),newPlayer()
    assert(select(first)==a); publish(first,a)
    first.mins=Vector(-32,-32,0); first.maxs=Vector(32,32,90)
    GM.IsSpawnpointSuitable=function() return true end
    assert(select(second)==distant, "reservations must not hide the already-published body")
`));

test("reservations expire next tick while published players keep occupying their actual positions", () => run(spawnSetup + `
    local a=addPoint("info_player_start"); local b=addPoint("info_player_start")
    local first,second=newPlayer(),newPlayer()
    local one=select(first); publish(first,one); now=now+0.1
    local two=select(second); assert(two~=one); publish(second,two)
    first.position=Vector(1000,0,0); now=now+0.1
    assert(select(newPlayer())==one, "a vacated slot can be reused after the real occupancy changes")
`));

test("cleanup clears pending reservations and rebuilding points does not preserve an old owner assignment", () => run(spawnSetup + `
    local a=addPoint("info_player_start"); addPoint("info_player_start")
    local first=newPlayer(); assert(select(first)==a)
    for _,point in ipairs(points) do point.invalid=true end
    points={}; local replacement=addPoint("info_player_start",500,0,0)
    cleanup(); assert(select(first)==replacement)
`));
