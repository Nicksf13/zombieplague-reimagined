import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { radarServerSetup } from "./helpers/radar.mjs";

test("allied, attack and scan samples carry the special role at detection time", () => run(radarServerSetup + `
    friend.survivor=true; zombie.nemesis=true
    tick(10.5)
    local ally
    for _,contact in ipairs(state(human).Contacts) do if contact.ID==friend.id then ally=contact end end
    assert(ally and ally.Source=="ally" and ally.Special and ally.Role=="survivor","Expected the allied Survivor sample")
    attack(zombie,false)
    local hostile
    for _,contact in ipairs(state(human).Contacts) do if contact.ID==zombie.id then hostile=contact end end
    assert(hostile and hostile.Source=="attack" and hostile.Special and hostile.Role=="nemesis","Expected the detected Nemesis attack sample")
    ZPRadar:Purchase(human)
    for _,contact in ipairs(state(human).Contacts) do if contact.ID==zombie.id then hostile=contact end end
    assert(hostile.Source=="scan" and hostile.Special,"Expected the Nemesis scan sample")
    zombie.nemesis=false; zombie.position=Vector(600,0,0); tick(10.6)
    for _,contact in ipairs(state(human).Contacts) do if contact.ID==zombie.id then hostile=contact end end
    assert(hostile.Special and hostile.Role=="nemesis" and hostile.Position.x==500,"Role changes must not refresh old snapshots")
    tick(11.5)
    for _,contact in ipairs(state(human).Contacts) do if contact.ID==zombie.id then hostile=contact end end
    assert(not hostile.Special and not hostile.Role and hostile.Position.x==600,"The next pulse must sample the current role")
`));

test("decoys retain normal marker colors even when the thrower is a Survivor", () => run(radarServerSetup + `
    human.survivor=true
    local decoy={EntIndex=function() return 200 end,GetPos=function() return Vector(50,0,0) end}
    ZPRadar:Decoy(decoy); tick(10)
    local found
    for _,contact in ipairs(state(zombie).Contacts) do if contact.ID==200 then found=contact end end
    assert(found and not found.Special and not found.Role)
`));
