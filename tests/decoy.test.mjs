import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { decoySetup as setup } from "./helpers/decoy.mjs";

test("the decoy is a human-only extra item with one carried or deployed grenade per player", () => run(setup + `
    Utils={RecursiveFileSearch=function() return {"extraitems/zp_decoy_grenade.lua"} end}
    include("sv_extraitems.lua"); ExtraItemsManager:Search()
    local item=ExtraItemsManager:GetItemById(TEAM_HUMANS,"ZPDecoyGrenade")
    assert(item and item.Price==8 and not ExtraItemsManager:GetItemById(TEAM_ZOMBIES,"ZPDecoyGrenade"))
    assert(ExtraItemsManager:BuyItem(zombie,item)=="restricted" and zombie.balance==100)
    friend.balance=7; assert(ExtraItemsManager:BuyItem(friend,item)=="insufficient" and not friend.held)
    assert(ExtraItemsManager:BuyItem(human,item)=="bought" and human.balance==92)
    assert(human.held.DecoySound=="Weapon_AR2.Single" and human.active==human.held)
    assert(ExtraItemsManager:BuyItem(human,item)=="restricted" and human.balance==92)
    human.held:PrimaryAttack(); deferred[1]()
    assert(not human.held and not ZPDecoy:CanBuy(human),"A deployed decoy must prevent stacking")
    hook.Run("ZPEndRound"); assert(ZPDecoy:CanBuy(human))
    human.alive=false; assert(not ZPDecoy:CanBuy(human))
    human.alive=true; round=3; assert(not ZPDecoy:CanBuy(human))
`));

test("decoy projectiles inherit the grenade base, arm once and simulate harmless bursts at the impact position", () => run(setup + `
    local grenade,weapon=launch(human)
    assert(grenade.Base=="zp_grenade_base" and grenade.Mode==ARM_ON_HIT_MODE)
    assert(grenade:GetExplosionDelay()==0.75 and grenade.velocity.x==710 and grenade.velocity.z==120)
    assert(weapon.consumed==1 and #grenade.sounds==0 and not contact(zombie,grenade.id))
    grenade.position=Vector(800,0,256)
    arm(grenade)
    assert(#grenade.sounds==1 and grenade.sounds[1]=="Weapon_AR2.Single")
    local sample=contact(zombie,grenade.id)
    assert(sample.Source=="attack" and sample.Position.x==800 and sample.Position.z==256)
    assert(not contact(human,grenade.id) and not contact(friend,grenade.id))
    assert(not contact(zombie,human.id),"The real thrower must not be revealed by fake shots")
    assert(effects[1][1]=="MuzzleFlash" and effects[1][2].position.x==800)
    grenade:PhysicsCollide({},{}); assert(#grenade.sounds==1)
    for step=1,20 do advance(10.75+step*0.1) end
    assert(#grenade.sounds>1,"The decoy must continue firing within its active lifetime")
    advance(20.75)
    assert(grenade.removed and not contact(zombie,grenade.id),"Expiry must remove the fake contact immediately")
    local count=#grenade.sounds; advance(30); assert(#grenade.sounds==count)
`));

test("decoy marks respect radar access and distance decay without impersonating a teammate or overriding a real target", () => run(setup + `
    local other=prepare(newPlayer(4,TEAM_ZOMBIES,2400)); ready(other)
    local grenade=launch(human); grenade.position=Vector(0,0,0); arm(grenade)
    assert(contact(other,grenade.id).Expires<contact(zombie,grenade.id).Expires)
    assert(ZPRadarRules.Snapshot(state(zombie),now),"Decoys must use the validated player-contact wire format")
    attack(human,false)
    assert(contact(zombie,human.id) and contact(zombie,grenade.id),"A real shooter and its decoy need separate IDs")
    set("mode",1); advance(12.2)
    assert(not state(zombie).Enabled and not contact(zombie,grenade.id))
    ZPRadar:Purchase(zombie); advance(13.3)
    assert(contact(zombie,grenade.id) and not contact(other,grenade.id))
    set("mode",0); local shots=#grenade.sounds; advance(14.4)
    assert(#grenade.sounds>shots and not state(zombie).Enabled,"Audio remains useful when radar is disabled")
`));

test("unlanded decoys have a bounded arming fallback and owner or round cleanup cannot leave sounds behind", () => run(setup + `
    local grenade=launch(human)
    advance(12.9); assert(#grenade.sounds==0)
    advance(13); assert(#grenade.sounds==1)
    human.team=TEAM_ZOMBIES; advance(13.1)
    assert(grenade.removed and not contact(zombie,grenade.id))
    human.team=TEAM_HUMANS; deferred[1]()
    local second=launch(human); arm(second)
    human.alive=false; advance(now+0.1); assert(second.removed)
    human.alive=true; deferred[2]()
    local third=launch(human); arm(third)
    hook.Run("ZPEndRound")
    assert(third.removed and not contact(zombie,third.id))
`));

test("invalid physics, blocked throws, failed creation and client prediction cannot spend a decoy", () => run(setup + `
    ZPDecoy:Give(human); local weapon=human.held
    blocked=true; weapon:PrimaryAttack(); assert(not weapon.consumed and #projectiles==0)
    blocked=false; createFailure=true; weapon:PrimaryAttack(); assert(not weapon.consumed)
    createFailure=false; badPhysics=true; weapon:PrimaryAttack()
    assert(projectiles[1].removed and not weapon.consumed)
    badPhysics=false; human.frozen=true; weapon:PrimaryAttack(); assert(not weapon.consumed)
    human.frozen=false; human.team=TEAM_ZOMBIES; weapon:PrimaryAttack(); assert(not weapon.consumed)
    human.team=TEAM_HUMANS; SERVER,CLIENT=false,true
    weapon:PrimaryAttack(); assert(not weapon.consumed and #projectiles==1)
    SERVER,CLIENT=true,false; weapon:PrimaryAttack(); weapon:PrimaryAttack()
    assert(weapon.consumed==1 and #projectiles==2)
`));

test("externally removed entities retire their cached ID without calling methods on a NULL entity", () => run(setup + `
    local grenade=launch(human); arm(grenade)
    assert(contact(zombie,grenade.id))
    grenade.removed=true; advance(now+0.1)
    assert(not contact(zombie,grenade.id))
    advance(now+1)
`));

test("sound capture supports native guns, addon conventions, weapon switches and bounded fallbacks", () => run(setup + `
    local sounds=include("sv_decoy_sound.lua")
    assert(sounds.weaponSound(gun("weapon_pistol"))=="Weapon_Pistol.Single","native")
    assert(sounds.weaponSound(gun("m9k_test",{Primary={Sound="M9K.Test"}}))=="M9K.Test","primary")
    assert(sounds.weaponSound(gun("arccw_test",{ShootSound={"arccw/test.wav"}}))=="arccw/test.wav","shoot list")
    assert(sounds.weaponSound(gun("tfa_test",{FireSound="TFA.Test"}))=="TFA.Test","fire")
    local inherited=gun("custom"); inherited.Primary={Sound="Custom.Inherited"}
    assert(sounds.weaponSound(inherited)=="Custom.Inherited","inherited")
    assert(not sounds.weaponSound(gun("knife",{Primary={Sound="Knife.Swing"}},-1)))
    assert(not sounds.weaponSound(gun("bad",{ShootSound="../cfg/server.cfg"})))
    human.gun=gun("unknown"); human.active=human.gun
    assert(sounds.captureSound(human)=="Weapon_AR2.Single","fallback")
    human.gun=gun("custom",{ShootSound="Custom.Single"}); human.active=human.gun
    ZPDecoy:Give(human); assert(human.held.DecoySound=="Custom.Single","give")
    local previous=gun("weapon_shotgun")
    hook.Run("PlayerSwitchWeapon",human,previous,human.held)
    assert(human.held.DecoySound=="Weapon_Shotgun.Single","switch")
`));

test("concurrent decoys stay independent and the server bounds the total deployed entities", () => run(setup + `
    for index=1,32 do
        local owner=prepare(newPlayer(10+index,TEAM_HUMANS,index*10))
        local grenade=launch(owner)
        assert(grenade.owner==owner and not ZPDecoy:CanBuy(owner))
    end
    assert(#projectiles==32 and not ZPDecoy:CanBuy(human))
    local first=projectiles[1]; first:Remove()
    assert(ZPDecoy:CanBuy(human))
    hook.Run("ZPEndRound")
    for _,grenade in ipairs(projectiles) do assert(grenade.removed) end
`));

test("an invalid or disconnected owner retires its deployed decoy on the next service tick", () => run(setup + `
    local grenade=launch(human); arm(grenade)
    local count=#grenade.sounds
    human.removed=true; advance(now+0.1)
    assert(grenade.removed and #grenade.sounds==count and not contact(zombie,grenade.id))
`));
