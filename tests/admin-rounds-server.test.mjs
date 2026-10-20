import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";
import { adminRoundsSetup as setup } from "./helpers/admin-rounds.mjs";

test("selected first zombie starts one simple round and cancels preparation and countdown timers", () => run(setup + `
    local first,count=nil,0
    hook.Add("ZPFirstZombieEvent","test",function(p) first=p; count=count+1 end)
    RoundManager:FreezeTime()
    timer.Create("NoSoundInfectionDelayTimer",1,1,function() error("stale countdown") end)
    timer.Create("TimerSound",1,5,function() error("stale sound") end)
    transform(0,c.id)
    assert(first==c and count==1 and c:IsZombie() and a:IsHuman())
    assert(RoundManager:GetRoundState()==ROUND_PLAYING and RoundManager:GetRound()==1)
    assert(RoundManager:GetCurrentRoundPlaying()==RoundManager.Rounds.SimpleRound)
    assert(not RoundManager.FreezeTimeActive and not a.frozen and not c.frozen)
    assert(not timers.NoSoundInfectionDelayTimer and not timers.TimerSound and timers.ZombiePlagueTimer[1]==300)
    local current,timer=RoundManager:GetCurrentRoundPlaying(),timers.ZombiePlagueTimer
    transform(0,d.id)
    assert(d:IsZombie() and count==1 and RoundManager:GetRound()==1)
    assert(RoundManager:GetCurrentRoundPlaying()==current and timers.ZombiePlagueTimer==timer)
`));

test("Nemesis and Survivor use the chosen player and preserve each mode's team setup", () => run(setup + `
    hook.Add("ZPFirstZombieEvent","unexpected",function() error("simple reward in special mode") end)
    transform(1,c.id)
    assert(c.nemesis and not a.nemesis and c:IsZombie() and a:IsHuman())
    assert(RoundManager:GetCurrentRoundPlaying()==RoundManager.Rounds.NemesisRound)
    assert(RoundManager:GetRound()==1 and RoundManager:IsSpecialRound())
    local before=#notices
    transform(1,a.id); transform(2,a.id)
    assert(#notices==before+2 and not a.nemesis and not a.survivor and RoundManager:GetRound()==1)
    RoundManager:SetRoundState(ROUND_RESTARTING)
    transform(2,a.id)
    assert(a.survivor and not c.survivor and a:IsHuman())
    assert(c:IsZombie() and b:IsZombie() and d:IsZombie() and e:IsZombie())
    assert(RoundManager:GetCurrentRoundPlaying()==RoundManager.Rounds.SurvivalRound)
`));

test("unauthorized, malformed, disconnected, dead and spectator targets cannot change a round", () => run(setup + `
    net.ReadUInt=function() error("unauthorized payload parsed") end
    receivers.ZPAdminPlayerRound(42,a); receivers.ZPAdminRoundsRequest(25,a)
    net.ReadUInt=function() return table.remove(uints,1) end
    transform(0,c.id,admin,41); transform(0,c.id,admin,50); transform(0,c.id,admin,42,2)
    transform(3,c.id); transform(0,0); transform(0,999)
    c.alive=false; transform(0,c.id); c.alive=true
    c.invalid=true; transform(1,c.id); c.invalid=false
    transform(0,admin.id)
    RoundManager.PlayersToPlay={a,b,d,e}; transform(0,c.id)
    assert(RoundManager:GetRound()==0 and c:IsHuman() and not c.nemesis)
    admin.admin=false; transform(0,a.id)
    assert(a:IsHuman())
`));

test("catalog lists all registered modes in order and honors minimum players and addon enablement", () => run(setup + `
    local started=0
    RoundManager:AddRoundType("Custom",{Name="Addon mode",MinPlayers=2,Chance=0,Order=0,
        ShouldBeEnabled=function(self) assert(self.Name=="Addon mode"); return false end,
        StartFunction=function() started=started+1 end})
    request(0)
    assert(sent[1]=="ZPAdminRoundsReply" and sent[2]==1 and sent[3]==7 and sent[5]==7)
    assert(sent[6]=="Custom" and sent[7]=="Addon mode" and sent[8]==2 and not sent[9])
    request(1,"Custom"); assert(started==0 and sent[4]=="zombieplague.adminroundunavailable")
    RoundManager.Rounds.Custom.ShouldBeEnabled=function() return true end
    request(1,"Custom"); assert(started==1 and sent[4]=="zombieplague.adminroundstarted")
    request(1,"SimpleRound"); assert(started==1 and RoundManager:GetRound()==1)
    RoundManager:SetRoundState(ROUND_STARTING_NEW_ROUND); RoundManager.PlayersToPlay={a,b}
    transform(1,a.id); transform(2,a.id)
    assert(not a.nemesis and not a.survivor)
    request(1,"NemesisRound"); assert(sent[4]=="zombieplague.adminroundunavailable")
    request(1,"unknown"); assert(RoundManager:GetRound()==1)
`));

test("idle starts prepare once, while ending, map voting and map changes reject all starts", () => run(setup + `
    RoundManager:SetRoundState(ROUND_RESTARTING)
    request(1,"SimpleRound")
    assert(cleanups==1 and a.spawns==1 and RoundManager:GetRound()==1)
    for _,state in ipairs({ROUND_ENDING,ROUND_VOTEMAP,ROUND_CHANGING_MAP}) do
        RoundManager:SetRoundState(state)
        request(1,"SurvivalRound"); transform(0,b.id); transform(1,b.id); transform(2,b.id)
        assert(RoundManager:GetRound()==1 and not b.infections and not b.nemesis and not b.survivor)
    end
`));

test("infection of the last human clears Survivor flags and ends without starting another round", () => run(setup + `
    transform(2,c.id)
    local round=RoundManager:GetRound()
    transform(0,c.id)
    assert(c:IsZombie() and not c.survivor and not c.nemesis and not c.light)
    assert(RoundManager:GetRound()==round and RoundManager:GetRoundState()==ROUND_ENDING)
`));

test("rate limiting blocks repeated actions and permission is checked again for every request", () => run(setup + `
    transform(0,c.id)
    uints={1,0,d.id}; receivers.ZPAdminPlayerRound(42,admin)
    assert(not d.infections)
    now=now+0.3; admin.admin=false
    uints={1,0,d.id}; receivers.ZPAdminPlayerRound(42,admin)
    assert(not d.infections)
`));

test("background catalog refresh does not throttle an immediate start action", () => run(setup + `
    request(0)
    uints={1,8,1}; readString="SimpleRound"
    receivers.ZPAdminRoundsRequest(200,admin)
    assert(RoundManager:GetRound()==1 and sent[4]=="zombieplague.adminroundstarted")
`));
