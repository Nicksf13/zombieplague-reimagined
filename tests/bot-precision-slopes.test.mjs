import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { botSetup } from "./helpers/adaptive-bots.mjs";

const setup = botSetup + `
local bot=newPlayer(TEAM_ZOMBIES,0)
local movement=include("sv_bot_motion_actions.lua")
local physics=include("sv_bot_motion_physics.lua").physics
local slope=0.1
local hole=false
local drop=false
util.TraceHull=function(options) return {Hit=false,Entity=emptyEntity,HitPos=options.endpos} end
util.TraceLine=function(options)
    local z=drop and -64 or options.start.x*slope
    local hit=not (hole and options.start.x>=7 and options.start.x<=13) and options.start.z>=z and options.endpos.z<=z
    return {Hit=hit,Entity=emptyEntity,HitPos=Vector(options.start.x,options.start.y,z),HitNormal=Vector(-slope,0,1)}
end
local function choices(target)
    return movement.options(bot,target,physics(bot),false,false,false,false,nil,false,80)
end
`;

for (const direction of [-1, 1]) {
    test(`precision validates a short ${direction < 0 ? "downhill" : "uphill"} step at its own height`, () => run(setup + `
        slope=${direction * 0.1}
        local surface=choices(Vector(400,0,400*slope))
        assert(#surface.Options>0 and not surface.Ground,
            "a distant destination's height must not replace the short probe endpoint height")
        assert(surface.Options[1].Precision and not surface.Options[1].Jump)
        assert(surface.Options[1].Position.x==400,"the movement target must remain the original checkpoint")
    `));
}

test("slope height interpolation preserves intermediate hole and lower-floor rejection", () => run(setup + `
    hole=true
    local surface=choices(Vector(400,0,40))
    assert(#surface.Options==0,"endpoint support cannot hide an intermediate hole")
    assert(surface.SupportProbe and surface.SupportProbe.Reason=="missing")
    assert(surface.SupportProbe.Sample[1]>=7 and surface.SupportProbe.Sample[1]<=13)
    assert(surface.SupportProbe.End[3]==2,"record the local projected height rather than the distant target height")
    hole=false; drop=true
    assert(#choices(Vector(400,0,-40)).Options==0,"an unrelated lower floor cannot authorize the short step")
`));
