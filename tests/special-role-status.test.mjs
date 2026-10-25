import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

test("initial server snapshots include explicit special-role flags for joining clients", () => run(`
    local function makePlayer(id,nemesis,survivor)
        return {
            id=id,IsNemesis=function() return nemesis end,IsSurvivor=function() return survivor end,
            GetAmmoPacks=function() return 0 end,GetMaxBatteryCharge=function() return 100 end,
            GetZombieClass=function() return {Name="Classic"} end,GetHumanClass=function() return {Name="Human"} end,
            GetLight=function() return nil end,GetFootstep=function() return true end,
            GetAbilityPower=function() return 0 end,GetMaxAbilityPower=function() return 100 end
        }
    end
    local players={makePlayer("nemesis",true,false),makePlayer("survivor",false,true),makePlayer("normal")}
    RoundManager={GetTime=function() return 90 end,GetRoundState=function() return 2 end,
        GetRound=function() return 1 end,GetPlayersToPlay=function() return players end}
    PlayerManager={GetPlayerID=function(_,ply) return ply.id end}
    local runtimeInclude=include
    include=function(path) if path=="sv_roundmanager.lua" then return runtimeInclude(path) end end
    include("sv_roundmanager.lua")
    local snapshot=RoundManager:GetServerStatus()
    assert(snapshot.Players[1].ID=="nemesis" and snapshot.Players[1].Nemesis and not snapshot.Players[1].Survivor)
    assert(snapshot.Players[2].Survivor and not snapshot.Players[2].Nemesis)
    assert(snapshot.Players[3].Nemesis==false and snapshot.Players[3].Survivor==false)
`));
