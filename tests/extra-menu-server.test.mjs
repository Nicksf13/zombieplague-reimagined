import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { extraServerSetup } from "./helpers/extra-menu.mjs";

test("extra shop catalogs expose prices and team-specific rules without callbacks or missing addons", () => run(extraServerSetup + `
    local response=extraCatalog(1); local snapshot=response.Snapshot
    assert(response.Code=="catalog" and snapshot.Balance==200 and snapshot.Team=="human" and snapshot.Alive)
    assert(extraEntry(snapshot,"ZPArmor").Price==12 and extraEntry(snapshot,"ZPArmor").Availability=="available")
    assert(not extraEntry(snapshot,"ZPZombieMadness"))
    assert(not extraEntry(snapshot,"ZPRPG7") and not snapshot.Truncated)
    for _,entry in ipairs(snapshot.Entries) do
        assert(entry.Kind=="human" and not entry.OnBuy and not entry.CanBuy and not entry.BuySounds)
    end
    ply.human=false; special=true
    snapshot=extraCatalog(2).Snapshot
    assert(extraEntry(snapshot,"ZPAntidote").Availability=="restricted")
    assert(extraEntry(snapshot,"ZPZombieMadness").Availability=="available")
    assert(not extraEntry(snapshot,"ZPArmor"))
    for _,entry in ipairs(snapshot.Entries) do assert(entry.Kind=="zombie") end
    ply.spectator=true; snapshot=extraCatalog(3).Snapshot
    assert(snapshot.Team=="spectator" and #snapshot.Entries==0 and not snapshot.Truncated)
    commands.extras(ply); assert(sent[1]=="ZPExtraMenuOpen" and sent.recipient==ply)
`));

test("foreign-team addon catalogs cannot fill the current team's budget or evaluate their rules", () => run(extraServerSetup + `
    for index=1,300 do
        ExtraItemsManager:AddExtraItem({ID="foreign"..index,Name=string.rep("n",128),Price=1,Order=index,
            OnBuy=function() end,CanBuy=function() error("Wrong team's rule evaluated") end,
            ShouldBeEnabled=function() error("Wrong team's catalog evaluated") end},ITEM_ZOMBIE)
    end
    local snapshot=extraCatalog(1).Snapshot
    assert(not snapshot.Truncated and extraEntry(snapshot,"ZPArmor"))
    for _,entry in ipairs(snapshot.Entries) do assert(entry.Kind=="human") end
`));

test("a purchase uses the real server price, delivers once and refreshes the authoritative balance", () => run(extraServerSetup + `
    local response=buyExtra(1,"human","ZPArmor")
    assert(response.Code=="bought" and ply.armor==100 and ply.balance==188 and ply.charges==1)
    assert(response.Snapshot.Balance==188 and notices[1].Phrase=="zombieplague.extraitembought")
    assert(buyExtra(1,"human","ZPArmor").Code=="bought" and ply.armor==100 and ply.charges==1)
    assert(buyExtra(1,"zombie","ZPZombieMadness").Code=="invalid_item" and not ply.madness)
    assert(buyExtra(2,"human","ZPArmor").Code=="bought" and ply.armor==200 and ply.charges==2)
`));

test("team, life, item restrictions and current balance are rechecked when buying", () => run(extraServerSetup + `
    extraCatalog(1)
    assert(buyExtra(2,"zombie","ZPZombieMadness").Code=="restricted")
    ply.alive=false; assert(buyExtra(3,"human","ZPArmor").Code=="restricted")
    ply.alive=true; ply.spectator=true; assert(buyExtra(4,"human","ZPArmor").Code=="restricted")
    ply.spectator=false; ply.balance=11
    local reply=buyExtra(5,"human","ZPArmor")
    assert(reply.Code=="insufficient" and extraEntry(reply.Snapshot,"ZPArmor").Availability=="insufficient")
    ply.balance=200; special=true
    assert(buyExtra(6,"human","ZPTVirus").Code=="restricted")
    special=false; lastHuman=true; assert(buyExtra(7,"human","ZPTVirus").Code=="restricted")
    ply.human=false; lastZombie=true; assert(buyExtra(8,"zombie","ZPAntidote").Code=="restricted")
    assert(not ply.charges and ply.balance==200 and not ply.armor)
`));

test("disabled, unknown, malformed and invalid-price items cannot charge or deliver", () => run(extraServerSetup + `
    local armor=ExtraItemsManager:GetItemById(TEAM_HUMANS,"ZPArmor")
    armor.ShouldBeEnabled=function() return false end
    assert(buyExtra(1,"human","ZPArmor").Code=="invalid_item")
    assert(buyExtra(2,"human","missing").Code=="invalid_item")
    armor.ShouldBeEnabled=function() return true end
    for index,price in ipairs({-1,1.5,math.huge,0/0}) do
        armor.Price=price; assert(buyExtra(2+index,"human","ZPArmor").Code=="invalid_item")
    end
    local previous=sent
    for _,data in ipairs({{Version=2,RequestID=7,Kind="human",ID="ZPArmor"},
        {Version=1,RequestID=0,Kind="human",ID="ZPArmor"},
        {Version=1,RequestID=7,Kind="spectator",ID="ZPArmor"},
        {Version=1,RequestID=7,Kind="human",ID=string.rep("x",129)}}) do
        readTable=data; receivers.ZPExtraMenuBuy(512,ply); assert(sent==previous)
    end
    receivers.ZPExtraMenuBuy(5000,ply); assert(sent==previous and not ply.charges)
`));

test("old purchase IDs remain harmless after receipt eviction and requests are rate limited", () => run(extraServerSetup + `
    ply.balance=1000
    for id=1,18 do assert(buyExtra(id,"human","ZPArmor").Code=="bought") end
    local balance,armor=ply.balance,ply.armor
    assert(buyExtra(1,"human","ZPArmor").Code=="invalid_item")
    assert(ply.balance==balance and ply.armor==armor and ply.charges==18)
    uints={1,20}; receivers.ZPExtraMenuCatalog(39,ply); assert(sent[2].Code=="rate_limited")
    hooks.PlayerDisconnected.ZPExtraMenuCleanup(ply)
    assert(buyExtra(1,"human","ZPArmor").Code=="bought" and ply.charges==19)
`));

test("conversion items refresh the team and retain cleanup callbacks and purchase sounds", () => run(extraServerSetup + `
    assert(buyExtra(1,"human","ZPTVirus").Snapshot.Team=="zombie" and not ply.human)
    assert(buyExtra(2,"zombie","ZPAntidote").Snapshot.Team=="human" and ply.human)
    local cleaned=0
    ExtraItemsManager:AddExtraItem({ID="custom",Name="ExtraItemArmorName",Price=1,Order=1,
        OnBuy=function() end,CanBuy=function() return true end,ShouldBeEnabled=function() return true end,
        BuySounds={"custom.wav"},RemoveFunction=function() cleaned=cleaned+1 end},ITEM_HUMAN)
    assert(buyExtra(3,"human","custom").Code=="bought" and sounds[1]=="custom.wav")
    hooks.ZPEndRound.ZPExtraItemsRemove(); hooks.ZPEndRound.ZPExtraItemsRemove(); assert(cleaned==1)
`));

test("extra item catalogs stay bounded when addons register hundreds of items", () => run(extraServerSetup + `
    for index=1,300 do
        ExtraItemsManager:AddExtraItem({ID="custom"..index,Name=string.rep("n",128),Price=1,Order=index,
            OnBuy=function() end,CanBuy=function() return true end,ShouldBeEnabled=function() return true end},ITEM_HUMAN)
    end
    local snapshot=extraCatalog(1).Snapshot
    assert(snapshot.Truncated and #snapshot.Entries<=128)
    assert(ZPExtraMenuProtocol.Reply({Version=1,RequestID=1,Code="catalog",Snapshot=snapshot}))
`));
