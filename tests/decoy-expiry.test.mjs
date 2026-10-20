import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { decoySetup as setup } from "./helpers/decoy.mjs";

test("natural decoy expiry emits one harmless explosion at its final position and clears the radar", () => run(setup + `
    local grenade=launch(human); arm(grenade)
    assert(contact(zombie,grenade.id))
    util.BlastDamage=function() error("The final explosion must never deal damage") end
    DamageInfo=function() error("The final explosion must not create damage information") end
    ents.Create=function() error("The final explosion must not create a damaging entity") end
    grenade.position=Vector(750,125,256)
    local before=#effects; advance(20.74)
    for _,effect in ipairs(effects) do assert(effect[1]~="Explosion") end
    before=#effects; advance(20.75)
    assert(grenade.removed and not contact(zombie,grenade.id))
    assert(#effects==before+1 and effects[#effects][1]=="Explosion")
    local data=effects[#effects][2]
    assert(data.position.x==750 and data.position.y==125 and data.position.z==262)
    assert(data.magnitude==0 and data.scale>0 and data.scale<1)
    local count=#effects; advance(21); advance(30)
    assert(#effects==count,"The final explosion must occur exactly once")
`));

test("death, infection, disconnect, round end and external removal cancel a decoy without exploding", () => run(setup + `
    for _,reason in ipairs({"death","infection","disconnect","round","removed"}) do
        human.alive=true; human.team=TEAM_HUMANS; human.removed=nil; human.held=nil
        local grenade=launch(human); arm(grenade)
        if reason=="death" then human.alive=false
        elseif reason=="infection" then human.team=TEAM_ZOMBIES
        elseif reason=="disconnect" then human.removed=true
        elseif reason=="round" then hook.Run("ZPEndRound")
        else grenade:Remove() end
        advance(now+0.1)
        assert(grenade.removed and not contact(zombie,grenade.id))
        for _,effect in ipairs(effects) do assert(effect[1]~="Explosion",reason) end
    end
`));
