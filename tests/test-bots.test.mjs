import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
ROUND_WAITING_PLAYERS,ROUND_RESTARTING=0,4
local state,restarts=ROUND_WAITING_PLAYERS,0
local clients,consoleCommands,messages={}, {}, {}
local singleplayer,maxplayers,creationCalls,failCreation=false,8,0,false
IsValid=function(value) return type(value)=="table" and not value.invalid end
concommand={Add=function(name,callback) consoleCommands[name]=callback end}
function SendConsoleMessage(ply,message) messages[#messages+1]=message end
function SendPopupMessage(ply,message) messages[#messages+1]=message end
function SendColorMessage() end
game={SinglePlayer=function() return singleplayer end,MaxPlayers=function() return maxplayers end}
string.Explode=function(separator,text)
    local result={}; for word in text:gmatch("%S+") do result[#result+1]=word end; return result
end
local function newPlayer(bot,admin)
    return {team=TEAM_SPECTATOR,IsBot=function() return bot end,IsSuperAdmin=function() return admin end,
        Team=function(self) return self.team end,SetTeam=function(self,id) self.team=id end,
        Alive=function() return true end}
end
local host=newPlayer(false,true)
clients[1]=host
player={}
player.GetCount=function() return #clients end
player.GetAll=function() return clients end
player.GetBots=function()
    local result={}; for _,ply in ipairs(clients) do if ply:IsBot() then result[#result+1]=ply end end; return result
end
player.CreateNextBot=function(name)
    creationCalls=creationCalls+1
    if failCreation then return nil end
    local bot=newPlayer(true,false); bot.name=name; clients[#clients+1]=bot; return bot
end
RoundManager={PlayersToPlay={},GetRoundState=function() return state end,
    RestartRound=function() restarts=restarts+1; state=ROUND_RESTARTING end}
include("sv_round_players.lua")
RoundManager:AddPlayerToPlay(host)
`;

test("zp_addbot adds a real bot participant and crosses the normal round-start threshold", () => run(setup + `
    include("sv_commands.lua")
    assert(restarts==0 and RoundManager:CountPlayersToPlay()==1)
    consoleCommands.zp_addbot(host,"zp_addbot",{})
    assert(creationCalls==1 and #clients==2 and restarts==1)
    local bot=clients[2]
    assert(bot.ZPIdleTestBot and bot:Team()==TEAM_HUMANS and bot.name=="ZP Test Bot 1")
    assert(RoundManager:GetPlayersToPlay()[2]==bot and state==ROUND_RESTARTING)
    assert(messages[#messages].Phrase=="zombieplague.botcreated" and messages[#messages].Arguments[1]==1)
    assert(not timers.bot)
`));

test("chat /bot and console quantities use the same creation path and respect remaining slots", () => run(setup + `
    include("sv_commands.lua")
    assert(hooks.PlayerSay.Commands(host,"/bot 2")=="")
    assert(#clients==3 and RoundManager:CountPlayersToPlay()==3 and restarts==1)
    maxplayers=4
    consoleCommands.zp_addbot(host,"zp_addbot",{"16"})
    assert(#clients==4 and creationCalls==3 and RoundManager:CountPlayersToPlay()==4)
    assert(messages[#messages].Arguments[1]==1)
    consoleCommands.zp_addbot(host,"zp_addbot",{})
    assert(messages[#messages].Phrase=="zombieplague.botfull" and creationCalls==3)
`));

test("bot creation rejects unauthorized callers and malformed quantities before spawning", () => run(setup + `
    include("sv_commands.lua")
    local ordinary=newPlayer(false,false)
    consoleCommands.zp_addbot(ordinary,"zp_addbot",{})
    assert(hooks.PlayerSay.Commands(ordinary,"/bot 1")=="")
    assert(messages[#messages].Phrase=="zombieplague.commandnotaccess" and creationCalls==0)
    for _,amount in ipairs({"0","-1","1.5","17","inf","nan","abc"}) do
        consoleCommands.zp_addbot(host,"zp_addbot",{amount})
        assert(messages[#messages].Phrase=="zombieplague.botusage" and creationCalls==0)
    end
    consoleCommands.zp_addbot(host,"zp_addbot",{"1","extra"})
    assert(messages[#messages].Phrase=="zombieplague.botusage" and creationCalls==0)
`));

test("singleplayer and failed engine creation are reported without phantom participants", () => run(setup + `
    include("sv_commands.lua")
    singleplayer=true
    consoleCommands.zp_addbot(host,"zp_addbot",{})
    assert(messages[#messages].Phrase=="zombieplague.botsingleplayer" and creationCalls==0)
    singleplayer=false; failCreation=true
    consoleCommands.zp_addbot(host,"zp_addbot",{"2"})
    assert(messages[#messages].Phrase=="zombieplague.botfailed" and creationCalls==1)
    assert(#clients==1 and RoundManager:CountPlayersToPlay()==1 and restarts==0)
`));

test("dedicated console can create bots and command registration respects BOT_MODE", () => run(setup + `
    BOT_MODE=false; include("sv_commands.lua")
    assert(not consoleCommands.zp_addbot and not Commands.CommandList.bot and not hooks.StartCommand)
    BOT_MODE=true; include("sv_commands.lua")
    local log
    print=function(text) log=text end
    consoleCommands.zp_addbot(nil,"zp_addbot",{"1"})
    assert(creationCalls==1 and log=="[ZP] Added 1 idle test bot(s).")
`));

test("only bots created for testing lose movement, attack buttons and impulses", () => run(setup + `
    include("sv_commands.lua")
    consoleCommands.zp_addbot(host,"zp_addbot",{})
    local command={buttons=1,forward=100,impulse=100}
    function command:ClearButtons() self.buttons=0 end
    function command:ClearMovement() self.forward=0 end
    function command:SetImpulse(value) self.impulse=value end
    hooks.StartCommand.ZPIdleTestBots(host,command)
    hooks.StartCommand.ZPIdleTestBots(newPlayer(true,false),command)
    assert(command.buttons==1 and command.forward==100 and command.impulse==100)
    hooks.StartCommand.ZPIdleTestBots(clients[2],command)
    assert(command.buttons==0 and command.forward==0 and command.impulse==0)
`));
