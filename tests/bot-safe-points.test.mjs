import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup=botSetup+`
local Store=include("sv_bot_safe_store.lua").BotSafeStore
local path="zombieplague/bots/safe-points/"..util.SHA256(mapName):sub(1,64)..".json"
`;

test("safe points validate untrusted arrays, IDs, roles, coordinates and snapshots",()=>run(setup+`
    local valid={{ID=1,Role="both",Position={100,0,0}}}
    assert(ZPBotSafeProtocol.Points(valid)[1].Role=="both")
    for _,data in ipairs({false,"bad",{[2]=valid[1]},{valid[1],valid[1]},{{ID=0,Role="both",Position={0,0,0}}},
        {{ID=1,Role="admin",Position={0,0,0}}},{{ID=1,Role="human",Position={0,0,math.huge}}},
        {{ID=1,Role="human",Position={0,0,0,4}}}}) do assert(not ZPBotSafeProtocol.Points(data)) end
    for i=2,33 do valid[i]={ID=i,Role="human",Position={i*100,0,0}} end
    assert(not ZPBotSafeProtocol.Points(valid))
    assert(not ZPBotSafeProtocol.Snapshot({Request=1,Revision=1,Points={},Feedback="surprise"}))
    assert(not ZPBotSafeProtocol.Snapshot({Request=0,Revision=1,Points={},Feedback="ready"}))
`));

test("safe points persist per map, copy state and never reuse deleted IDs",()=>run(setup+`
    local store=construct(Store)
    assert(store:Add(Vector(100,0,0),"human")=="saved" and store.Revision==2)
    assert(store:Add(Vector(110,0,0),"both")=="invalid")
    local copy=store:Points(); copy[1].Position[1]=900; copy[1].Role="zombie"
    assert(store:Points()[1].Position[1]==100 and store:Points()[1].Role=="human")
    assert(store:Add(Vector(200,0,0),"zombie")=="saved")
    assert(store:Remove(1)=="saved" and store:Remove(1)=="invalid")
    store=construct(Store); assert(#store:Points()==1 and store:Points()[1].ID==2)
    assert(store:Add(Vector(300,0,0),"both")=="saved" and store:Points()[2].ID==3)
    local data=util.JSONToTable(files[path]); assert(data.Map==mapName and data.Version==1 and data.NextID==4)
    mapName="other_map"; assert(#construct(Store):Points()==0)
`));

test("invalid persisted safe points are preserved and failed writes publish no revision",()=>run(setup+`
    for _,value in ipairs({false,{Version=2,Map=mapName,NextID=1,Points={}},
        {Version=1,Map="wrong",NextID=1,Points={}},
        {Version=1,Map=mapName,NextID=1,Points={{ID=1,Role="both",Position={100,0,0}}}}}) do
        files[path]=util.TableToJSON(value); local original=files[path]; local store=construct(Store)
        assert(store:Add(Vector(100,0,0),"both")=="error" and files[path]==original)
    end
    files[path]=nil; local store=construct(Store)
    assert(store:Add(Vector(100,0,0),"both")=="saved")
    local original=files[path]; failWrite=true
    assert(store:Add(Vector(200,0,0),"both")=="error")
    assert(store.Revision==2 and #store:Points()==1 and files[path]==original)
    failWrite=false
    for i=2,32 do assert(store:Add(Vector(i*100,0,0),"both")=="saved") end
    assert(store:Add(Vector(3300,0,0),"both")=="capacity")
`));

const editorSetup=setup+`
include("sv_bot_safe_points.lua")
loaded=true; local area=newArea(1,100)
local function editorPlayer()
    local ply=newPlayer(TEAM_HUMANS,100,false); ply.admin=true
    local previous=ply.weapon; function previous:GetClass() return "weapon_pistol" end
    local inventory={weapon_pistol=previous}
    function ply:GetWeapon(class) return inventory[class] end
    function ply:Give(class)
        if self.failGive then return nil end
        local tool={GetClass=function() return class end}; inventory[class]=tool; return tool
    end
    function ply:SelectWeapon(class) if not self.deferSelect then self.weapon=inventory[class] end end
    function ply:StripWeapon(class) inventory[class]=nil end
    function ply:GetEyeTrace() return self.trace end
    return ply,inventory,previous
end
local admin,inventory,previous=editorPlayer()
local reads,sequence=0,0
local function query(action,revision,role,id,length,ply,version)
    now=now+0.2; sequence=sequence+1; local values={version or 2,sequence,revision or 1,action or 0,role or 2,id or 0}
    net.ReadUInt=function() reads=reads+1; return table.remove(values,1) end
    sent={}; receivers.ZPBotSafeRequest(length or 91,ply or admin); return sent[2]
end
local trace={Hit=true,HitWorld=true,HitNormal=Vector(0,0,1),HitPos=Vector(100,0,0),Entity=emptyEntity}
admin.trace=trace; util.TraceLine=function() return trace end
`;

test("safe tool editing requires a real equipped lease and revisioned authoritative floor traces",()=>run(editorSetup+`
    local outsider=newPlayer(TEAM_HUMANS,100,false)
    query(1,1,2,0,91,outsider); query(1,1,2,0,90); query(1,1,2,0,92)
    assert(reads==0 and #ZPBotSafePoints:Points()==0)
    assert(query(1).Feedback=="invalid", "an admin without the equipped tool cannot mutate")
    assert(query(4).Equipped and inventory.zp_bot_safe_tool==admin.weapon)
    assert(query(1).Feedback=="saved" and #ZPBotSafePoints:Points()==1)
    assert(query(3,1,2,1).Feedback=="stale" and #ZPBotSafePoints:Points()==1)
    assert(query(3,2,2,1).Feedback=="saved" and #ZPBotSafePoints:Points()==0)
    trace.HitNormal=Vector(0,0,0.2); assert(query(2,3).Feedback=="invalid")
    trace.HitNormal=Vector(0,0,1); trace.HitWorld=false; assert(query(2,3).Feedback=="invalid")
    trace.HitWorld=true; trace.HitPos=Vector(100,0,80); assert(query(2,3).Feedback=="invalid")
    trace.HitPos=Vector(100,0,0); blocked=true; assert(query(2,3).Feedback=="invalid")
    blocked=false; area.blocked=true; assert(query(2,3).Feedback=="invalid")
    area.blocked=false; local saved=query(2,3,0)
    assert(saved.Feedback=="saved" and ZPBotSafeProtocol.Snapshot(saved))
    assert(ZPBotSafePoints:Points()[1].Role=="human")
    admin.weapon=previous; assert(query(3,4,2,2).Feedback=="invalid" and #ZPBotSafePoints:Points()==1)
    query(5); assert(not inventory.zp_bot_safe_tool and admin.weapon==previous)
`));

test("safe tool leases restore weapons on close, timeout, death and permission loss",()=>run(editorSetup+`
    for _,reason in ipairs({"close","timeout","death","permission","disconnect"}) do
        admin.alive=true; admin.admin=true
        assert(query(4).Equipped)
        if reason=="close" then query(5)
        elseif reason=="disconnect" then hooks.PlayerDisconnected.ZPBotSafePoints(admin)
        else
            if reason=="timeout" then now=now+6 elseif reason=="death" then admin.alive=false else admin.admin=false end
            hooks.Think.ZPBotSafePoints()
        end
        assert(not inventory.zp_bot_safe_tool and admin.weapon==previous,reason)
    end
    admin.admin=true; admin.alive=true; admin.failGive=true
    assert(query(4).Feedback=="error" and not inventory.zp_bot_safe_tool)
    admin.failGive=false; admin.deferSelect=true
    assert(query(4).Equipped and admin.weapon==previous, "equip acknowledgment allows asynchronous weapon selection")
    assert(query(1).Feedback=="invalid", "mutations still require the actual active weapon")
`));

