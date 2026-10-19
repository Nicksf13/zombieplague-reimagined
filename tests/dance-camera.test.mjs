import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { danceClientSetup as setup } from "./helpers/dance-client.mjs";

test("gesture snapshots keep the model's native main pose and entry waits for a client gesture", () => run(setup + `
    complete=false; move(); assert(frame(10)==nil and not viewer.gesture)
    complete=true; move(); assert(frame(10.01)==nil and not viewer.gesture)
    assert(animate()==nil and viewer.gesture.sequence==42 and nativeSequence==7)
    assert(frame(10.02)==nil)
    local view=frame(10.24)
    assert(view.drawviewer and hooks.ShouldDrawLocalPlayer.ZPDanceModel(viewer))
    near(distance(view),100)
    nativeSequence=0; frame(10.3); near(distance(frame(10.4)),100)
    assert(viewer.starts==1, "normal main-sequence changes must not restart the gesture or camera")
`));

test("zombie models keep a stable captured heading while orbit input only changes the camera", () => run(setup + `
    for _,path in ipairs({"models/player/zombie_classic.mdl","models/player/zombie_fast.mdl","models/player/zombie_soldier.mdl"}) do
        model=path; networkModel=path; viewer.team=TEAM_ZOMBIES; heading=-137; pitch=-25
        viewer.ZPDanceAnimationUntil=nil; untilTime=now+6; started=now
        local view=start(); near(view.angles.y,heading); near(view.angles.p,pitch)
        local cmd=move(100,50); assert(cmd.cleared and cmd.stopped and cmd.impulse==0)
        near(cmd.angles.y,heading); near(cmd.angles.p,pitch)
        view=frame(now+0.02); near(view.angles.y,heading-2.2); near(view.angles.p,pitch+1.1)
        hooks.PrePlayerDraw.ZPDanceFacing(viewer)
        near(viewer:GetRenderAngles().y,heading); near(viewer:GetRenderAngles().p,0)
        hooks.PostPlayerDraw.ZPDanceFacing(viewer)
        near(viewer:GetRenderAngles().y,10); assert(not viewer.ZPDanceRenderAngles)
        assert(viewer.invalidations>=2, "bone caches must not retain the old rotation")
        untilTime=0; frame(now); frame(now+0.23)
    end
`));

test("cursor warp after closing the wheel cannot jerk the initial emote view", () => run(setup + `
    animate(); move(16000,-16000); frame(10)
    local view=frame(10.22)
    near(view.angles.y,heading); near(view.angles.p,pitch)
    move(100,-100); view=frame(10.24)
    near(view.angles.y,heading-2.2); near(view.angles.p,pitch-2.2)
`));

test("cancelling halfway through entry reverses continuously and ends without more user commands", () => run(setup + `
    animate(); move(); frame(10)
    local entry=frame(10.08); assert(distance(entry)>0 and distance(entry)<100)
    left=true; local cmd=move()
    assert(cmd.consumed and sent[1]=="ZPDanceCancel" and requests==1)
    assert(KeyManager.PressingKeyList[MOUSE_LEFT])
    local reverse=frame(10.08)
    near(distance(reverse),distance(entry)); near(reverse.angles.y,entry.angles.y)
    assert(not reverse.drawviewer and hooks.ShouldDrawLocalPlayer.ZPDanceModel(viewer)==nil)
    assert(distance(frame(10.18))<distance(reverse))
    assert(frame(10.31)==nil and frame(11)==nil, "CalcView alone must finish the exit")
    move(); assert(requests==1)
`));

test("render count and frame rate do not change the camera path", () => run(setup + `
    animate(); move(); frame(10)
    local a=frame(10.11); local b=frame(10.11)
    near(distance(a),distance(b)); near(distance(a),50)
    near(a.angles.y,b.angles.y)
    for i=1,20 do near(distance(frame(10.11)),50) end
    near(distance(frame(10.22)),100)
    untilTime=0; local out=frame(10.22); near(distance(out),100)
    near(distance(frame(10.33)),50)
    assert(frame(10.45)==nil)
`));

test("camera collision ignores players, respects walls and scales distance for larger zombie models", () => run(setup + `
    viewer.scale=1.1; local view=start(); near(distance(view),110)
    assert(traced.mask==MASK_SOLID and traced.filter[1]==viewer)
    assert(traced.mins.x==-6 and traced.maxs.z==6)
    traceHit=Vector(0,-20,64); view=frame(now+0.01)
    near(view.origin.y,-20); near(distance(view),20)
    traceSolid=true; view=frame(now+0.01); near(distance(view),0)
`));

test("a late client applies the elapsed gesture cycle without borrowing a human or stale pose", () => run(setup + `
    model="models/player/zombie_fast.mdl"; networkModel=model; viewer.team=TEAM_ZOMBIES; now=12
    assert(animate()==nil and nativeSequence==7)
    near(viewer.gesture.cycle,1/3); assert(viewer.gesture.autoKill and viewer.weight==1)
    animate(); assert(viewer.starts==1)
    untilTime=0; animate(); assert(not viewer.gesture and nativeSequence==7)
`));

test("death, spectator views and model changes release the camera and temporary bone rotation", () => run(setup + `
    start(); viewer.alive=false; assert(frame(now+0.01)==nil)
    viewer.alive=true; untilTime=now+6; started=now; viewer.ZPDanceAnimationUntil=nil; start()
    model="other"; assert(frame(now+0.01)==nil)
    model="human"; networkModel="human"; untilTime=now+6; started=now; viewer.ZPDanceAnimationUntil=nil; start()
    viewer.viewEntity={}; assert(frame(now+0.01)==nil)
    assert(hooks.ShouldDrawLocalPlayer.ZPDanceModel(viewer)==nil)
`));

test("Mouse1 cancellation before gesture readiness stays cancelled after a delayed animation update", () => run(setup + `
    KeyManager:SetBinding("RequestAbility",MOUSE_LEFT)
    left=true; local cmd=move(); assert(cmd.consumed and sent[1]=="ZPDanceCancel")
    animate(); left=false; move(); assert(frame(10)==nil and frame(10.3)==nil)
    untilTime=20; started=10.3; animate(); move(); frame(10.31)
    assert(frame(10.54).drawviewer, "a new emote epoch clears the previous cancellation")
`));

test("UI clicks do not cancel an emote and the direct dance command retains its legacy payload", () => run(setup + `
    start(); cursor=true; left=true; move(); assert(requests==0)
    cursor=false; move(); assert(requests==0, "holding a click from a menu must not count as a new click")
    left=false; move(); left=true; move(); assert(requests==1 and sent[1]=="ZPDanceCancel")
    consoleCommands.zp_dance(); assert(sent[1]=="ZPDanceStart" and #sent==1)
`));
