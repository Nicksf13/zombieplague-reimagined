import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { radarServerSetup } from "./helpers/radar.mjs";

const setup = radarServerSetup + `
local function contact(viewer,target)
    for _,sample in ipairs(state(viewer).Contacts) do if sample.ID==target.id then return sample end end
end
`;

test("both teams see perceived allies by default without exposing silent enemies or themselves", () => run(setup + `
    assert(values.zp_radar_allies==1)
    local other=newPlayer(4,TEAM_ZOMBIES,9000); ready(other)
    tick(10.5)
    assert(contact(human,friend).Source=="ally" and contact(friend,human).Source=="ally")
    assert(contact(zombie,other).Source=="ally" and contact(other,zombie).Source=="ally")
    assert(not contact(human,zombie) and not contact(zombie,human))
    assert(not contact(human,human) and not contact(zombie,zombie))
    friend.position=Vector(250,0,256); tick(10.6)
    assert(contact(human,friend).Position.x==100,"Allied updates must be rate limited")
    tick(11)
    assert(contact(human,friend).Position.x==250 and contact(human,friend).Position.z==256)
    zombie.position=Vector(500,0,0); attack(zombie,false)
    local sample=contact(human,zombie)
    assert(sample.Source=="attack")
    zombie.position=Vector(600,0,300); tick(11.5)
    assert(contact(human,zombie).Position.x==500 and contact(human,zombie).Position.z==0)
    assert(contact(human,zombie).Created==sample.Created,"Allied updates must not refresh enemy samples")
`));

test("the allies cvar applies immediately without cancelling access, scans or enemy contacts", () => run(setup + `
    set("mode",1); ZPRadar:Purchase(human); tick(10.5)
    assert(state(human).Enabled and contact(human,friend).Source=="ally")
    local untilTime=state(human).ScanUntil
    local enemy=contact(human,zombie)
    set("allies",0)
    assert(not contact(human,friend) and contact(human,zombie)==enemy)
    assert(state(human).Enabled and state(human).ScanUntil==untilTime)
    friend.position=Vector(500,0,512); tick(11)
    assert(not contact(human,friend))
    set("allies",1)
    assert(contact(human,friend).Position.z==512 and contact(human,zombie).Source=="scan")
    assert(state(human).ScanUntil==untilTime and not state(friend).Enabled)
`));

test("allied contacts require radar access, a ready client and an active living participant", () => run(setup + `
    set("mode",1); tick(10.5)
    assert(#state(human).Contacts==0 and not state(human).Enabled)
    ZPRadar:Purchase(human); tick(11)
    assert(contact(human,friend) and not state(friend).Enabled,"The target does not need to own radar")
    readBool=false; receivers.ZPRadarReady(1,human)
    assert(not state(human).Enabled and #state(human).Contacts==0)
    tick(11.5); readBool=true; receivers.ZPRadarReady(1,human)
    ZPRadar:Purchase(human); tick(12)
    human.alive=false; hook.Run("PlayerDeath",human)
    assert(not state(human).Enabled and #state(human).Contacts==0)
    human.alive=true; hook.Run("PlayerSpawn",human); ZPRadar:Purchase(human)
    round=3; tick(12.5)
    assert(#state(human).Contacts==0 and state(human).ScanUntil==0)
    set("mode",0); tick(13)
    assert(not state(human).Enabled and #state(human).Contacts==0)
`));

test("death, team changes and disconnect remove allied samples before the next update", () => run(setup + `
    tick(10.5)
    assert(contact(human,friend))
    friend.alive=false; hook.Run("PlayerDeath",friend)
    assert(not contact(human,friend)); tick(11); assert(not contact(human,friend))
    friend.alive=true; hook.Run("PlayerSpawn",friend); tick(11.5)
    assert(contact(human,friend).Source=="ally")
    friend.team=TEAM_ZOMBIES; hook.Run("OnPlayerChangedTeam",friend,TEAM_HUMANS,TEAM_ZOMBIES)
    assert(not contact(human,friend)); tick(12)
    assert(not contact(human,friend) and contact(zombie,friend).Source=="ally")
    hook.Run("PlayerDisconnected",friend); table.remove(players,3)
    assert(not contact(zombie,friend)); tick(12.5); assert(not contact(zombie,friend))
`));
