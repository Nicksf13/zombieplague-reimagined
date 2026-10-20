import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { decoySetup as setup } from "./helpers/decoy.mjs";

test("pin and impact sounds play once on the server, throttle resting contacts and preserve base arming", () => run(setup + `
    file.Exists=function() return true end
    ZPDecoy:Give(human); local weapon=human.held
    blocked=true; weapon:PrimaryAttack(); assert(not weapon.sounds)
    blocked=false; SERVER,CLIENT=false,true
    weapon:PrimaryAttack(); assert(not weapon.sounds)
    SERVER,CLIENT=true,false; weapon:PrimaryAttack(); weapon:PrimaryAttack()
    assert(#weapon.sounds==1 and weapon.sounds[1]=="weapons/pinpull.wav")
    local grenade=projectiles[1]
    grenade:PhysicsCollide({Speed=10},{})
    assert(grenade.Armed and #grenade.sounds==0,"Soft impacts still arm without noisy resting chatter")
    local timerID=grenade.Timer
    grenade:PhysicsCollide({Speed=200},{})
    assert(#grenade.sounds==1 and grenade.sounds[1]=="weapons/hegrenade/he_bounce-1.wav")
    grenade:PhysicsCollide({Speed=200},{})
    assert(#grenade.sounds==1 and grenade.Timer==timerID)
    advance(10.2); grenade:PhysicsCollide({Speed=200},{})
    assert(#grenade.sounds==2)
    advance(10.4)
    grenade:PhysicsCollide({Speed=0/0},{}); grenade:PhysicsCollide({Speed=math.huge},{})
    assert(#grenade.sounds==2 and not contact(zombie,grenade.id),"Handling and impacts must not pretend to be gunfire")
`));

test("handling sounds fall back to installed HL2 audio when the preferred grenade files are absent", () => run(setup + `
    file.Exists=function() return false end
    local grenade,weapon=launch(human)
    assert(weapon.sounds[1]=="weapons/slam/throw.wav")
    grenade:PhysicsCollide({Speed=100},{})
    assert(grenade.sounds[1]=="weapons/slam/throw.wav")
`));

test("every simulated shot emits a bounded orange sprite flash and smoke puff at the grenade", () => run(setup + `
    local grenade=launch(human); arm(grenade)
    assert(#sprites==1 and #effects==1)
    local packet=sprites[1]
    assert(packet.Pos.x==grenade.position.x and packet.Pos.z==grenade.position.z+6)
    assert(#packet.ParticleInformations==4)
    for index,particle in ipairs(packet.ParticleInformations) do
        assert(particle.DieTime>0 and particle.DieTime<=0.55)
        assert(particle.StartAlpha>0 and particle.StartAlpha<=255 and particle.EndAlpha==0)
        if index<=3 then
            assert(particle.File=="sprites/light_glow02_add" and particle.Color.r==255)
            assert(particle.StartSize<=6 and particle.EndSize==0)
        else
            assert(particle.File=="particle/smokesprites_0001" and particle.EndSize<=12)
        end
    end
    grenade.position=Vector(500,0,128)
    for step=1,20 do advance(10.75+step*0.1) end
    assert(#sprites>1 and #sprites==#effects)
    assert(sprites[#sprites].Pos.x==500 and sprites[#sprites].Pos.z==134)
    local count=#sprites; advance(21); advance(30)
    assert(#sprites==count and grenade.removed,"Removal must stop sprites as well as sounds")
`));

test("random cadence mixes single shots, varied bursts and long pauses without extending the lifetime", () => run(setup + `
    local lengths={1,4,2,5}; local lengthIndex,quick,pauses=0,0,0
    math.random=function(min,max)
        if min==1 and max==5 then
            lengthIndex=lengthIndex+1; return lengths[(lengthIndex-1)%#lengths+1]
        end
        return math.floor((min+max)/2)
    end
    math.Rand=function(min,max)
        if min==0.12 and max==0.28 then quick=quick+1; return quick%2==0 and max or min end
        if min==0.45 and max==1.65 then pauses=pauses+1; return pauses%2==0 and max or min end
        return (min+max)/2
    end
    local grenade=launch(human); local times={}
    grenade.EmitSound=function(self,sound) self.sounds[#self.sounds+1]=sound; times[#times+1]=now end
    ZPDecoy:Activate(grenade); advance(10)
    for step=1,99 do advance(10+step*0.1) end
    local fast,long=false,false
    for index=2,#times do
        local gap=times[index]-times[index-1]
        assert(gap>=0.12-0.001 and gap<=1.75+0.001)
        fast=fast or gap<0.35; long=long or gap>1.5
    end
    assert(fast and long and lengthIndex>=3 and #times>=6 and #times<60)
    assert(#sprites==#times and #effects==#times)
    local count=#times; advance(20); advance(30)
    assert(grenade.removed and #times==count and not contact(zombie,grenade.id))
`));
