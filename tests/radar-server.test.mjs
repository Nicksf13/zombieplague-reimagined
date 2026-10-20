import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { radarServerSetup } from "./helpers/radar.mjs";

const setup = radarServerSetup + `set("allies",0)\n`;

test("radar modes, native client readiness and dynamic items work for both teams", () => run(setup + `
    assert(#downloaded==1 and state(human).Enabled and state(zombie).Enabled)
    set("mode",0); extras()
    local hi=ExtraItemsManager:GetItemById(TEAM_HUMANS,"ZPRadar")
    local zi=ExtraItemsManager:GetItemById(TEAM_ZOMBIES,"ZPRadar")
    assert(hi and zi and not hi:ShouldBeEnabled() and not ZPRadar:CanBuy(human))
    assert(not state(human).Enabled and not state(zombie).Enabled)
    set("mode",1)
    assert(hi:ShouldBeEnabled() and zi:ShouldBeEnabled() and not state(human).Enabled)
    assert(ExtraItemsManager:BuyItem(human,hi)=="bought" and human.balance==90)
    assert(state(human).Enabled and not state(zombie).Enabled and not state(friend).Enabled)
    assert(ExtraItemsManager:BuyItem(human,hi)=="restricted" and human.balance==90 and human.charges==1)
    assert(ExtraItemsManager:BuyItem(zombie,zi)=="bought" and state(zombie).Enabled)
    set("price",27); assert(hi.Price==27 and zi.Price==27)
    set("mode",0)
    assert(not state(human).Enabled and state(human).ScanUntil==0 and #state(human).Contacts==0)
    set("mode",1); assert(not state(human).Enabled and not state(zombie).Enabled)
    set("mode",2); assert(state(human).Enabled and state(zombie).Enabled)
`));

test("attack marks are private, distance-scaled snapshots and refresh only on an actual attack", () => run(setup + `
    zombie.position=Vector(2500,0,0)
    attack(zombie,false)
    local distant=state(human).Contacts[1]
    assert(distant.ID==2 and math.abs(distant.Expires-now-0.4)<0.001)
    assert(#state(zombie).Contacts==0 and state(friend).Contacts[1].Expires>distant.Expires)
    zombie.position=Vector(25,0,0); tick(10.1)
    assert(state(human).Contacts[1].Position.x==2500,"A silent moving enemy must not be tracked")
    attack(zombie,false)
    local nearby=state(human).Contacts[1]
    assert(nearby.Position.x==25 and nearby.Expires-now>2.9)
    local created=nearby.Created; attack(zombie,false)
    assert(state(human).Contacts[1].Created==created,"Pellet callbacks must be deduplicated")
    tick(13.2); assert(#state(human).Contacts==0)
    zombie.position=Vector(2600,0,0); attack(zombie,false)
    assert(#state(human).Contacts==0)
    attack(human,false)
    for _,contact in ipairs(state(friend).Contacts) do assert(contact.ID~=human.id,"Allied gunfire must not reveal allies") end
`));

test("only nearby zombie swings reveal melee contacts, including misses", () => run(setup + `
    attack(zombie,true); assert(#state(human).Contacts==0)
    zombie.position=Vector(340,0,0); tick(10.2); attack(zombie,true)
    assert(state(human).Contacts[1].ID==2 and state(human).Contacts[1].Expires-now<0.5)
    assert(state(friend).Contacts[1].Expires>state(human).Contacts[1].Expires)
    attack(human,true); assert(#state(zombie).Contacts==0)
    hook.Run("PostEntityFireBullets",human,{})
    tick(now)
    assert(state(zombie).Contacts[1].ID==1,"The server's actual bullet hook must reveal gunfire")
`));

test("native projectile shots wait for ownership and addon shot adapters use the same rules", () => run(setup + `
    local deferred={}
    timer.Simple=function(_,callback) deferred[#deferred+1]=callback end
    local projectile={GetClass=function() return "rpg_missile" end,GetOwner=function() return nil end}
    hook.Run("OnEntityCreated",projectile)
    assert(#deferred==1 and #state(zombie).Contacts==0)
    projectile.GetOwner=function() return human end; deferred[1]()
    tick(now)
    assert(state(zombie).Contacts[1].ID==human.id)
    tick(10.2); hook.Run("ZPRadarGunshot",friend)
    tick(now)
    assert(#state(zombie).Contacts==2)
    round=3; tick(11); hook.Run("ZPRadarGunshot",human)
    assert(#state(zombie).Contacts==0)
`));

test("multiple shots are batched into one private snapshot per viewer per service tick", () => run(setup + `
    local other=newPlayer(4,TEAM_ZOMBIES,300); ready(other)
    local count=#packets
    ZPRadar:Attack(zombie,false); ZPRadar:Attack(other,false)
    assert(#packets==count,"Shot hooks must not flood the network with full snapshots")
    tick(10.1)
    assert(#packets==count+2,"Only the two human viewers receive updated contacts")
    assert(#state(human).Contacts==2 and #state(friend).Contacts==2)
`));

test("scan pulses find silent enemies, respect range and leave basic access after expiry", () => run(setup + `
    set("mode",1); set("scan_range",1000)
    zombie.position=Vector(800,0,0); ZPRadar:Purchase(human)
    assert(state(human).ScanUntil==20 and #state(human).Contacts==1)
    assert(state(human).Contacts[1].Source=="scan" and #state(friend).Contacts==0)
    zombie.position=Vector(900,0,0); tick(10.5)
    assert(state(human).Contacts[1].Position.x==800)
    tick(11); assert(state(human).Contacts[1].Position.x==900)
    zombie.position=Vector(1500,0,0); tick(12); assert(#state(human).Contacts==0)
    attack(zombie,false)
    assert(state(human).Contacts[1].Source=="attack","Passive detection remains available beyond the scan radius")
    tick(20); assert(state(human).Enabled and state(human).ScanUntil==0)
    assert(ZPRadar:CanBuy(human)); ZPRadar:Purchase(human); assert(state(human).ScanUntil==30)
`));

test("death, infection, cure, round end and disconnect revoke purchases and old contacts", () => run(setup + `
    set("mode",1); ZPRadar:Purchase(human); ZPRadar:Purchase(zombie)
    human.team=TEAM_ZOMBIES; hook.Run("OnPlayerChangedTeam",human,TEAM_HUMANS,TEAM_ZOMBIES)
    assert(not state(human).Enabled and state(human).ScanUntil==0)
    for _,contact in ipairs(state(zombie).Contacts) do assert(contact.ID~=human.id,"Changed teams must remove this target's old samples") end
    human.team=TEAM_HUMANS; hook.Run("OnPlayerChangedTeam",human,TEAM_ZOMBIES,TEAM_HUMANS)
    assert(not state(human).Enabled)
    ZPRadar:Purchase(human); human.alive=false; hook.Run("PlayerDeath",human)
    assert(not state(human).Enabled and state(human).ScanUntil==0)
    human.alive=true; hook.Run("PlayerSpawn",human); assert(not state(human).Enabled)
    ZPRadar:Purchase(human); hook.Run("ZPEndRound")
    assert(not state(human).Enabled and not state(zombie).Enabled)
    ZPRadar:Purchase(human); hook.Run("PlayerDisconnected",human)
    local replacement=newPlayer(1,TEAM_HUMANS,0); ready(replacement)
    assert(not state(replacement).Enabled,"Entity index reuse must not inherit purchases")
`));

test("no overview, failed client material, dead players and nonplaying rounds cannot charge for a scan", () => run(setup + `
    extras(); local item=ExtraItemsManager:GetItemById(TEAM_HUMANS,"ZPRadar")
    tick(10.6); readBool=false; receivers.ZPRadarReady(1,human)
    assert(ExtraItemsManager:BuyItem(human,item)=="restricted" and human.balance==100)
    tick(11.2); readBool=true; receivers.ZPRadarReady(1,human)
    human.alive=false; assert(not ZPRadar:CanBuy(human)); human.alive=true
    round=3; assert(not ZPRadar:CanBuy(human)); round=2
    file.Read=function() return nil end
    include("sv_radar.lua")
    assert(not ZPRadar:Available() and not ZPRadar:CanBuy(human) and not item:ShouldBeEnabled())
`));

test("native overviews are normalized and malformed server overrides cannot fall back silently", () => run(setup + `
    local load=include("sv_radar_overview.lua").loadOverview
    file.Read=function(path,realm) if path=="scripts/overviews/gm_construct.txt" then return "native" end end
    util.KeyValuesToTable=function() return {gm_construct={material=definition.Material,pos_x="-1000",pos_y="1000",scale="2"}} end
    local native=load(); assert(native.X==-1000 and native.Y==1000 and native.Scale==2 and native.Size==1024)
    util.KeyValuesToTable=function() return {material=definition.Material,pos_x="-1000",pos_y="1000",scale="0"} end
    assert(load()==nil)
    file.Read=function(path,realm)
        if realm=="DATA" then return "malformed" end
        if path=="scripts/overviews/gm_construct.txt" then return "native" end
    end
    assert(load()==nil,"An invalid explicit override must not be silently replaced")
`));

test("overview stacks validate every image before distributing the complete map", () => run(setup + `
    local load=include("sv_radar_overview.lua").loadOverview
    definition.Layers={{Material="lower.png",MinZ=-1000,MaxZ=100},{Material=definition.Material,MinZ=100,MaxZ=1000}}
    downloaded={}
    assert(load()==nil and #downloaded==0,"A missing layer must not advertise a partial overview")
    file.Exists=function(path) return path=="materials/"..definition.Material or path=="materials/lower.png" end
    local map=load()
    assert(map and #map.Layers==2 and #downloaded==2,"All images must be distributed, with shared materials deduplicated")
`));
