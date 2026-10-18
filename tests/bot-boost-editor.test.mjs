import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { boostSetup } from "./helpers/bot-boosts.mjs";

const setup = boostSetup + `
local service=construct(include("sv_bot_boost_editor.lua").BotBoostEditorService,manager,function() return {support,climber} end)
local function editorPlayer()
    local ply=newPlayer(TEAM_HUMANS,0,false); ply.admin=true
    function ply:IsSuperAdmin() return false end
    local previous=ply.weapon; function previous:GetClass() return "weapon_pistol" end
    local weapons={weapon_pistol=previous}
    function ply:GetWeapon(class) return weapons[class] end
    function ply:Give(class)
        if self.failGive then return nil end
        local tool={GetClass=function() return class end}; weapons[class]=tool; return tool
    end
    function ply:SelectWeapon(class) self.weapon=weapons[class] end
    function ply:StripWeapon(class) weapons[class]=nil end
    return ply,weapons,previous
end
local admin,inventory,original=editorPlayer()
local uints={}; net.ReadUInt=function() return table.remove(uints,1) end
local sequence=0
local function request(operation,id,revision,length,ply)
    now=now+0.2; sequence=sequence+1; uints={1,sequence,revision or 1,operation,id or 0}
    sent={}; service:Receive(length or 90,ply or admin); return sent[2]
end
local function capture(position)
    admin.eyeTrace={Hit=true,HitPos=position,HitNormal=Vector(0,0,1),Entity={GetClass=function() return "worldspawn" end}}
end
request(10)
request(1)
`;

test("boost marking captures the server eye trace, validates all three positions and persists a revisioned point", () => run(setup + `
    capture(Vector(0,0,0)); local packet=request(2); assert(packet.Draft.Base[1]==0)
    capture(Vector(-64,0,0)); packet=request(3); assert(packet.Draft.Approach[1]==-64)
    capture(Vector(64,0,72)); packet=request(4); assert(packet.Draft.Exit[3]==72)
    packet=request(5); assert(packet.Feedback=="saved" and packet.Revision==2 and #packet.Points==1)
    assert(ZPBotBoostProtocol.Snapshot(packet))
    local stale=request(6,1,1); assert(stale.Feedback=="busy" and #manager.Store:Points()==1)
    packet=request(9,1,2); assert(packet.Draft.ID==1 and packet.Draft.Exit[3]==72)
    packet=request(7,1,2); assert(packet.Feedback=="testing" and #packet.Sessions==1)
    packet=request(6,1,2); assert(packet.Feedback=="saved" and #packet.Points==0 and #packet.Sessions==0)
`));

test("boost editing rejects unauthorized senders, malformed sizes, sky, steep faces and unsaved incomplete drafts", () => run(setup + `
    admin.admin=false; assert(not request(1)); admin.admin=true; request(10); request(1)
    assert(not request(1,0,1,91)); assert(not request(15))
    capture(Vector(0,0,0)); admin.eyeTrace.HitNormal.z=0; assert(request(2).Feedback=="invalid")
    capture(Vector(0,0,0)); admin.eyeTrace.Hit=false; assert(request(2).Feedback=="invalid")
    capture(Vector(0,0,0)); admin.eyeTrace.HitSky=true; assert(request(2).Feedback=="invalid")
    capture(Vector(5000,0,0)); assert(request(2).Feedback=="invalid")
    capture(Vector(0,0,0)); admin.eyeTrace.Entity.GetClass=function() return "prop_physics" end
    assert(request(2).Feedback=="invalid")
    assert(request(5).Feedback=="invalid" and #manager.Store:Points()==0)
    loaded=false; assert(request(5).Feedback=="missing")
`));

test("boost tool pickup requires a non-bot admin on either team and does not require superadmin", () => run(boostSetup + `
    GM={}; include("sv_event_players.lua")
    local tool={GetClass=function() return "zp_bot_boost_tool" end}
    local admin=newPlayer(TEAM_ZOMBIES,0,false); admin.admin=true
    function admin:IsSuperAdmin() return false end
    assert(GM:PlayerCanPickupWeapon(admin,tool), "zombie superadmins can equip the editing tool")
    admin.team=TEAM_HUMANS; assert(GM:PlayerCanPickupWeapon(admin,tool))
    admin.admin=false; assert(not GM:PlayerCanPickupWeapon(admin,tool))
    admin.admin=true; admin.bot=true; assert(not GM:PlayerCanPickupWeapon(admin,tool))
`));

test("server drafts survive tool release, reject silent replacement and identify the exact geometry error", () => run(setup + `
    capture(Vector(0,0,0)); request(2)
    capture(Vector(-300,0,0)); request(3)
    capture(Vector(64,0,72)); local packet=request(4)
    assert(packet.Dirty and packet.Editing and packet.Issue.Code=="distance" and packet.Issue.Slot==3 and packet.Issue.Actual==300)
    packet=request(5); assert(packet.Issue.Min==40 and packet.Issue.Max==128 and #manager.Store:Points()==0)
    assert(request(1).Issue.Code=="unsaved")
    request(11); packet=request(10); assert(packet.Dirty and packet.Draft.Approach[1]==-300)
    capture(Vector(-64,0,0)); request(3); packet=request(5)
    assert(packet.Feedback=="saved" and not packet.Dirty and not packet.Editing and packet.Selected==1)
    packet=request(12,1,2); assert(packet.Selected==1 and not packet.Editing)
`));

test("test failures identify disabled AI, inactive rounds, freeze and unavailable allies", () => run(setup + `
    savePoint(); local originalBool=cvars.Bool
    cvars.Bool=function(name,default) if name=="zp_bot_ai_enabled" then return false end return originalBool(name,default) end
    assert(request(7,1).Issue.Code=="disabled"); cvars.Bool=originalBool
    RoundManager.state=ROUND_WAITING_PLAYERS; assert(request(7,1).Issue.Code=="round")
    RoundManager.state=ROUND_PLAYING; RoundManager.FreezeTimeActive=true; assert(request(7,1).Issue.Code=="frozen")
    RoundManager.FreezeTimeActive=false; support.alive=false; assert(request(7,1).Issue.Code=="bots")
`));

test("bot testing distinguishes an unreachable approach, insufficient class jump reach and occupied body space", () => run(setup + `
    savePoint(); climber.position=Vector(64,0,72); support.position=Vector(64,0,72)
    assert(request(7,1).Issue.Code=="path")
    now=now+2.1; climber.position=Vector(-64,0,0); support.position=Vector(0,0,0)
    climber.jumpPower=40; support.jumpPower=40
    assert(request(7,1).Issue.Code=="physics")
    now=now+2.1; climber.jumpPower=300; support.jumpPower=300
    util.TraceHull=function(options) return {Hit=true,HitPos=options.start,Entity=emptyEntity} end
    assert(request(7,1).Issue.Code=="obstacle")
`));

test("catalog polling never rebases an open draft after another admin changes the saved catalog", () => run(setup + `
    savePoint(); local packet=request(9,1); assert(packet.Editing and not packet.Dirty)
    local other=editorPlayer(); request(10,0,1,90,other)
    packet=request(6,1,1,90,other); assert(packet.Revision==2)
    packet=request(0); assert(packet.Revision==2 and packet.Editing and packet.Draft.ID==1)
    capture(Vector(1,0,0)); packet=request(2,0,2); assert(packet.Issue.Code=="stale" and packet.Draft.Base[1]==0)
    packet=request(5,0,2); assert(packet.Issue.Code=="stale" and #manager.Store:Points()==0)
    packet=request(8,0,2); assert(not packet.Dirty and not packet.Editing)
`));

test("failed editor writes retain the draft and retry saves exactly one point", () => run(setup + `
    capture(Vector(0,0,0)); request(2); capture(Vector(-64,0,0)); request(3); capture(Vector(64,0,72)); request(4)
    failWrite=true; local packet=request(5)
    assert(packet.Issue.Code=="storage" and packet.Dirty and packet.Editing and #manager.Store:Points()==0)
    failWrite=false; packet=request(5)
    assert(packet.Feedback=="saved" and packet.Selected==1 and #manager.Store:Points()==1)
`));

test("tool leases restore the previous weapon and reject captures after unequipping, dying or losing permission", () => run(setup + `
    assert(admin.weapon:GetClass()=="zp_bot_boost_tool" and inventory.zp_bot_boost_tool)
    capture(Vector(0,0,0)); admin.weapon=original
    assert(request(2).Feedback=="invalid")
    request(10); assert(request(2).Draft.Base[1]==0)
    assert(not request(11) and not inventory.zp_bot_boost_tool and admin.weapon==original)
    request(10); admin.alive=false; service:Tick(); assert(not inventory.zp_bot_boost_tool)
    assert(request(10).Issue.Code=="alive"); admin.alive=true
    request(10); admin.admin=false; service:Tick(); assert(not inventory.zp_bot_boost_tool)
    assert(not request(10)); admin.admin=true
    admin.failGive=true; assert(request(10).Issue.Code=="tool" and admin.weapon==original)
`));

test("closing bypasses the request throttle and abandoned tool sessions expire without deleting a changed loadout", () => run(setup + `
    uints={1,100,1,11,0}; sent={}; service:Receive(90,admin)
    assert(not inventory.zp_bot_boost_tool and admin.weapon==original, "immediate close releases the tool")
    request(10); now=now+5.1; service:Tick(); assert(not inventory.zp_bot_boost_tool)
    request(10); inventory.weapon_pistol=nil; admin.weapon=original; service:Remove(admin)
    assert(not inventory.zp_bot_boost_tool and not inventory.weapon_pistol, "cleanup never gives an old weapon back")
    request(10); admin.invalid=true
    function admin:SteamID64() error("Invalid players cannot be queried") end
    service:Tick(); service:Tick()
`));

test("boost snapshots detach coordinates and reject invalid session references, duplicate IDs and nonfinite points", () => run(setup + `
    savePoint(); local packet=request(0); local valid=ZPBotBoostProtocol.Snapshot(packet)
    assert(valid); valid.Points[1].Base[1]=999; assert(manager.Store:Points()[1].Base[1]==0)
    packet.Points[1].Exit[3]=0/0; assert(not ZPBotBoostProtocol.Snapshot(packet))
    packet=request(0); packet.Points[2]=packet.Points[1]; assert(not ZPBotBoostProtocol.Snapshot(packet))
    packet=request(0); packet.Sessions={{Point=99,Support=1,Climber=2,Phase="mount"}}; assert(not ZPBotBoostProtocol.Snapshot(packet))
    packet=request(0); packet.Results={{Point=1,Successes=-1,Failures=0}}; assert(not ZPBotBoostProtocol.Snapshot(packet))
    packet=request(0); packet.Issue={Code="unknown",Slot=3,Actual=0,Min=0,Max=1}; assert(not ZPBotBoostProtocol.Snapshot(packet))
    packet=request(0); packet.Issue={Code="distance",Slot=1,Actual=0,Min=0,Max=1}; assert(not ZPBotBoostProtocol.Snapshot(packet))
    packet=request(0); packet.Dirty="yes"; assert(not ZPBotBoostProtocol.Snapshot(packet))
    packet=request(0); packet.Selected=99; assert(not ZPBotBoostProtocol.Snapshot(packet))
`));
