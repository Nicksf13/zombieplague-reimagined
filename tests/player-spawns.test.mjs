import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { spawnSetup as setup } from "./helpers/player-spawns.mjs";

test("spawn queue uses every map point once before reuse, across humans and zombies", () => run(setup + `
    addPoint("info_player_counterterrorist"); addPoint("info_player_terrorist")
    addPoint("info_player_start"); addPoint("info_player_deathmatch"); addPoint("addon_spawn")
    local seen={}
    for index=1,#points do
        local point=select(newPlayer(index%2==0 and TEAM_ZOMBIES or TEAM_HUMANS))
        assert(point and not seen[point], "a spawn repeated before the queue ran out")
        seen[point]=true
    end
    assert(seen[select()], "excess players may reuse a point only after exhaustion")
`));

test("a full spawn wave only overlaps after usable capacity is exhausted", () => run(setup + `
    for index=1,8 do addPoint("info_player_start") end
    for index=1,#points do
        local point=select()
        assert(not point.blocked, "players with enough spawn points must not overlap")
        point.blocked=true
    end
    assert(select().blocked, "a full map still permits spawning when all points are occupied")
`));

test("occupied points are deferred, including across a queue refill", () => run(setup + `
    local occupied=addPoint("info_player_start"); occupied.blocked=true
    local free=addPoint("info_player_start")
    assert(select()==free)
    now=now+0.1
    assert(select()==free, "reuse a free point before spawning into an occupied one")
    free.blocked=true; occupied.blocked=false
    assert(select()==occupied, "deferred points become eligible once free")
`));

test("invalid and out-of-world points are discarded without resetting unused points", () => run(setup + `
    local first,removed,outside,last=addPoint("info_player_start"),addPoint("info_player_start"),addPoint("info_player_start"),addPoint("info_player_start")
    assert(select()==first)
    removed.invalid=true; outside.outside=true
    assert(select()==last)
    removed.invalid=false; outside.outside=false
    cleanup()
    local seen={}
    for index=1,4 do local point=select(); assert(not seen[point]); seen[point]=true end
`));

test("map cleanup resets even a partially consumed queue with surviving entities", () => run(setup + `
    local first=addPoint("info_player_start"); addPoint("info_player_start"); addPoint("info_player_start")
    assert(select()==first)
    cleanup()
    assert(select()==first, "the next round must start a fresh queue")
    for _,point in ipairs(points) do point.invalid=true end
    points={}
    local replacement=addPoint("info_player_start")
    cleanup()
    assert(select()==replacement, "cleanup must discard stale entity references")
`));

test("explicit spectators and map transitions do not consume points while first-time players are allocated normally", () => run(setup + `
    local first=addPoint("info_player_start"); local second=addPoint("info_player_start")
    local joining=newPlayer(); joining.FirstSpawn=nil
    assert(select(joining)==first)
    assert(select(newPlayer(TEAM_SPECTATOR))==first)
    assert(select()==second, "FirstSpawn must not bypass allocation for another player")
    local before=searches
    assert(select(newPlayer(),true)==nil and searches==before)
    local spectator=newPlayer(); spectator.ZPVoluntarySpectator=true
    assert(select(spectator)==first)
`));

test("team-based addons retain configured spawn pools and generic map fallback", () => run(setup + `
    GM.TeamBased=true
    local human=addPoint("addon_team_spawn"); local zombie=addPoint("addon_team_spawn")
    configured[TEAM_HUMANS]={human,human}; configured[TEAM_ZOMBIES]={zombie}
    assert(select(newPlayer(TEAM_HUMANS))==human)
    assert(select(newPlayer(TEAM_ZOMBIES))==zombie)
    human.invalid=true
    local fallback=addPoint("info_player_start")
    assert(select(newPlayer(TEAM_HUMANS))==fallback)
`));

test("maps without usable spawn points return nil without an invalid random range", () => run(setup + `
    assert(select()==nil)
    local removed=addPoint("info_player_start"); removed.invalid=true
    local outside=addPoint("info_player_start"); outside.outside=true
    addPoint("info_survivor_position")
    assert(select()==nil)
    local valid=addPoint("info_player_teamspawn")
    assert(select()==valid, "new points are discovered when the queue refills")
`));
