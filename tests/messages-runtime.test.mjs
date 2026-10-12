import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

test("server message globals preserve detached calls, wire order, broadcast exclusions and defaults", () => run(`
    local packets = {}
    net.WriteColor = function(value) sent[#sent+1]=value end
    net.WriteInt = function(value,bits) assert(bits==8); sent[#sent+1]=value end
    net.Send = function(ply) sent.recipient=ply; packets[#packets+1]=sent end
    local first,second,third = {},{},{}
    player = {GetAll=function() return {first,second,third} end}
    include("sv_message.lua")
    local detached = SendMessage
    detached(first,"literal %s")
    assert(sent[1]=="SendMessage" and sent[2].r==255 and sent[2].g==255 and sent[2].b==255)
    assert(sent[3]=="literal %s" and sent.recipient==first and #sent==3)
    SendConsoleMessage(second,"console")
    assert(sent[1]=="SendConsoleMessage" and sent[2]=="console" and sent.recipient==second)
    local color = Color(10,20,30)
    packets = {}
    BroadcastColorMessage("chat",color,{second})
    assert(#packets==2 and packets[1].recipient==first and packets[2].recipient==third)
    assert(packets[1][2]==color and packets[1][3]=="chat")
    packets = {}
    BroadcastSound("sound.wav",{first,third})
    assert(#packets==1 and sent[1]=="SendSound" and sent[2]=="sound.wav" and sent.recipient==second)
    SendNotifyMessage(first,"notice")
    assert(sent[1]=="SendNotifyMessage" and sent[2]==5 and sent[3]=="notice" and sent[4].r==255)
    SendNotifyMessage(first,"notice",0,color)
    assert(sent[2]==0 and sent[4]==color)
    local payload = {Phrase="zombieplague.roundsleft",Arguments={2}}
    packets = {}
    BroadcastNotifyMessage(payload,0,color)
    assert(#packets==3 and packets[3].recipient==third)
    assert(sent[1]=="SendLocalizedMessage" and sent[2]=="notify" and sent[3]==payload)
    assert(sent[4]==color and sent[5]==0 and #sent==5)
    packets = {}
    BroadcastMessage(payload)
    assert(#packets==3 and sent[2]=="chat" and sent[3]==payload and sent[4].r==255 and sent[5]==5)
`));

test("server message broadcasts call the receiving instance without relying on global send functions", () => run(`
    local class = include("sv_message.lua").ServerMessageManager
    local first = setmetatable({},class.prototype)
    local second = setmetatable({},class.prototype)
    first:____constructor(); second:____constructor()
    local ply = {}
    player = {GetAll=function() return {ply} end}
    local calls = {}
    first.SendColorMessage = function(self,recipient,text,color)
        assert(self==first and recipient==ply and color.r==255)
        calls[#calls+1]=text
    end
    second.SendColorMessage = function(self,recipient,text,color)
        assert(self==second and recipient==ply and color.r==255)
        calls[#calls+1]="second:"..text
    end
    first.SendSound = function(self,recipient,path)
        assert(self==first and recipient==ply); calls[#calls+1]=path
    end
    first.SendNotifyMessage = function(self,recipient,text,duration,color)
        assert(self==first and recipient==ply and duration==9 and color.b==255)
        calls[#calls+1]=text
    end
    SendColorMessage = function() error("Instance called a global SendColorMessage") end
    SendSound = function() error("Instance called a global SendSound") end
    SendNotifyMessage = function() error("Instance called a global SendNotifyMessage") end
    first:BroadcastMessage("first")
    second:BroadcastColorMessage("chat",Color(255,255,255))
    first:BroadcastSound("sound.wav")
    first:BroadcastNotifyMessage("notice",9,Color(255,255,255))
    assert(table.concat(calls,",")=="first,second:chat,sound.wav,notice")
`));
