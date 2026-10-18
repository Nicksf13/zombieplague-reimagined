import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { integritySetup } from "./helpers/bot-integrity.mjs";

test("progress followed by a witnessed fall learns failure once and cannot retain positive crossing reward", () => run(integritySetup + `
    local owner=begin(); now=10.5; learner:Harm(20,"fall-1")
    local result=updates(owner)
    assert(#result==1 and result[1].After<0 and result[1].Total<=-1)
    assert(memory.Passages["physics:1>2"].Failures==1)
    assert(memory.Totals.Harm==20 and memory.Totals.Failures==1)
    learner:Harm(20,"fall-1"); learner:Cancel("death")
    assert(#updates(owner)==1 and memory.Totals.Harm==20 and memory.Totals.Failures==1)
    for _,event in ipairs(updates()) do assert(event.Total<=0,"a failed crossing cannot pay positive partial progress") end
`));

test("a fall after the action interval belongs to the executed departure, not the newest airborne choice", () => run(integritySetup + `
    local owner=begin()
    now=10.6; learner:Choose(frame(90,"air"),{forward},now); input(now,90,"air")
    local newest=learner:ExperienceID(); assert(newest~=owner)
    now=10.8; learner:Harm(25,"late-fall")
    assert(#updates(owner)==1 and #updates(newest)==0)
    assert(updates(owner)[1].State=="physics:1>2:ground")
    assert(memory.Estimates["physics:1>2:ground:forward"].Samples==1)
    assert(not memory.Estimates["physics:1>2:air:forward"])
`));

test("stage replacement and explicit stage cancellation retain an already observed flight owner", () => run(integritySetup + `
    local owner=begin()
    learner:Cancel("stage_changed",true)
    now=10.6; learner:Choose(frame(90,"air","physics:2>3"),{forward},now); input(now,90,"air")
    local other=learner:ExperienceID()
    now=10.8; learner:Harm(30,"stage-fall")
    assert(#updates(owner)==1 and #updates(other)==0)
    assert(memory.Passages["physics:1>2"].Failures==1 and not memory.Passages["physics:2>3"])
`));

test("unknown interruption and a role fence do not punish the latest action or reuse old causal state", () => run(integritySetup + `
    local owner=begin(); learner:Cancel("scope_changed")
    assert(#updates()==0 and next(memory.Estimates)==nil)
    now=10.6; learner:Choose(frame(90,"air","new-role"),{forward},now)
    learner:Harm(20,"unobserved-fall")
    assert(#updates()==0 and learner:Integrity().Unattributed==1 and memory.Totals.Harm==20)
    local found=false
    for _,event in ipairs(events) do if event.Kind=="unattributed" then assert(not event.Updated); found=true end end
    assert(found and #updates(owner)==0)
`));

test("safely completing a crossing releases escrowed progress and earns more than a failed crossing", () => run(integritySetup + `
    now=10; learner:Choose(frame(0),{forward},now); input(now,0)
    now=10.2; learner:Choose(frame(40),{forward},now); input(now,40)
    now=10.6; learner:Choose(frame(100),{forward},now); input(now,100)
    assert(#updates()==0,"partial advancement remains unresolved")
    now=10.8; local done=frame(180); done.Completed=true
    learner:Choose(done,{},now)
    now=11.3; learner:Observe({Mode="ground",Position=Vector(180,0,0),Velocity=Vector(0,0,0),Run=300,Controlled=true,Moving=false})
    local total=0; for _,event in ipairs(updates()) do total=total+event.Total end
    assert(total>0 and memory.Passages["physics:1>2"].Successes==1)
    learner:Cancel("death")
    local after=0; for _,event in ipairs(updates()) do after=after+event.Total end
    assert(after==total,"a later interruption cannot erase or repeat the known successful outcome")
`));

test("an intervening controller or forced displacement records missing causality instead of blaming recent input", () => run(integritySetup + `
    begin()
    learner:Observe({Mode="air",Position=Vector(70,0,0),Velocity=Vector(1000,0,-100),Run=300,Controlled=true,Moving=true})
    learner:Harm(20,"pushed-fall")
    assert(#updates()==0 and learner:Integrity().Unattributed==1)
    learner:Cancel("controller_substitution")
    now=10.6; learner:Choose(frame(80),{forward},now); input(now,80)
    learner:Observe({Mode="air",Position=Vector(90,0,0),Velocity=Vector(100,0,-100),Run=300,Controlled=false,Moving=true})
    learner:Harm(20,"override-fall")
    assert(#updates()==0 and learner:Integrity().Unattributed==2)
`));

test("the same physical crossing produces no parameter updates during frozen evaluation", () => run(integritySetup + `
    values.zp_bot_evaluation=true
    begin(); now=10.6; learner:Harm(20,"evaluation-fall")
    assert(next(memory.Estimates)==nil and next(memory.Passages)==nil and #updates()==0)
    assert(memory.Totals.Harm==20)
`));

test("stage changes without completion finalize prior partial progress neutrally and do not leave it to pay out on another stage", () => run(integritySetup + `
    now=10; learner:Choose(frame(0),{forward},now)
    now=10.6; learner:Choose(frame(100),{forward},now)
    now=10.8; learner:Choose(frame(110,"ground","next-stage"),{forward},now)
    assert(#updates()==0,"changing stages is not evidence of successful traversal")
    local ended=false
    for _,event in ipairs(events) do if event.Kind=="finalize" and event.Stage=="physics:1>2" then
        assert(event.Outcome=="interrupted" and not event.Updated); ended=true
    end end
    assert(ended)
    local done=frame(180,"ground","next-stage"); done.Completed=true
    now=11; learner:Choose(done,{},now)
    for _,event in ipairs(updates()) do assert(event.Stage=="next-stage") end
`));

test("combat displacement uncertainty discards partial success without assigning the subsequent fall to walking", () => run(integritySetup + `
    begin(); learner:InvalidateCausality("combat_damage_possible_displacement")
    now=10.5; learner:Harm(20,"combat-fall")
    assert(#updates()==0 and learner:Integrity().Pending==0 and learner:Integrity().Unattributed==1)
    local found=false
    for _,event in ipairs(events) do if event.Kind=="unattributed" then assert(event.Reason=="combat_damage_possible_displacement"); found=true end end
    assert(found)
`));
