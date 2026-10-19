import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import fengari from "fengari";

const { lua, lauxlib, lualib, to_luastring, to_jsstring } = fengari;
const manifest = JSON.parse(await readFile(new URL("../../migration.json", import.meta.url), "utf8"));
const sources = await Promise.all(manifest.files.map(async name => [name + ".lua",
    await readFile(new URL("../../" + name + ".lua", import.meta.url), "utf8")]));
const sourceTable = sources.map(([name, content]) => {
    assert(!content.includes("]====]"));
    return `[${JSON.stringify(name.replace(/^gamemodes\//, ""))}]=[====[${content}]====]`;
}).join(",\n");
const prelude = `
unpack = table.unpack
local sources = {${sourceTable}}
local receivers, commands, registered, timers, sent, hooks = {}, {}, {}, {}, {}, {}
TEAM_HUMANS, TEAM_ZOMBIES, TEAM_SPECTATOR = 3, 2, 1002
ZOMBIE_KNIFE, BOT_MODE, ROUND_PLAYING = "zp_weapon_fists", true, 2
function include(path)
    local key = sources[path] and path or "zombieplague/gamemode/" .. path
    assert(sources[key], "Missing include " .. path)
    return assert(load(sources[key], "@" .. key))()
end
function SysTime() return 1.25 end
KEY_LAST,KEY_BACKQUOTE=106,57
KEY_G=17
MOUSE_LEFT,MOUSE_RIGHT,MOUSE_MIDDLE,MOUSE_4,MOUSE_5=107,108,109,110,111
gui={IsGameUIVisible=function() return false end,IsConsoleVisible=function() return false end}
vgui={GetKeyboardFocus=function() return nil end}
function AddCSLuaFile() end
function RunConsoleCommand() end
function IsValid(value) return value ~= nil and value ~= false end
function Color(r,g,b,a) return {r=r,g=g,b=b,a=a or 255} end
function SafeTableRandom(values) for _, value in pairs(values) do return value end end
function table.Random(values) for key, value in pairs(values) do return value,key end end
string.EndsWith = function(value,suffix) return value:sub(-#suffix)==suffix end
resource = { AddFile = function() end }
file = { Find = function(pattern)
    local parent = pattern:match("^(.*)/[^/]*$")
    local files, directories, seen = {}, {}, {}
    for key in pairs(sources) do
        if key:sub(1,#parent+1) == parent .. "/" then
            local rest = key:sub(#parent+2)
            local directory = rest:match("^([^/]+)/")
            if directory and not seen[directory] then directories[#directories+1]=directory; seen[directory]=true
            elseif not directory then files[#files+1]=rest end
        end
    end
    table.sort(files); table.sort(directories)
    return files,directories
end }
Commands = { AddCommand = function(self, aliases, description, action)
    if type(aliases)=="string" then aliases={aliases} end
    for _,name in ipairs(aliases) do commands[name]=action end
end }
ConvarManager = { CreateConVar = function() end }
cvars = { Number = function(_, default) return default end, Bool = function(_, default) return default end }
net = {
    Receive=function(name, callback) receivers[name]=callback end,
    Start=function(name) sent={name} end, WriteString=function(value) sent[#sent+1]=value end,
    WriteTable=function(value) sent[#sent+1]=value end, WriteBool=function(value) sent[#sent+1]=value end,
    Send=function(ply) sent.recipient=ply end,
    ReadString=function() return readString end, ReadBool=function() return readBool end,
    ReadTable=function() return readTable end
}
util = {AddNetworkString=function(name) registered[name]=true end}
hook = {
    Add=function(name,id,callback) hooks[name]=hooks[name] or {}; hooks[name][id]=callback end,
    Remove=function(name,id) if hooks[name] then hooks[name][id]=nil end end,
    Run=function(name,...) for _,callback in pairs(hooks[name] or {}) do callback(...) end end
}
timer = {Create=function(name, delay, repetitions, callback) timers[name]={delay,callback} end}
weapons = {GetList=function() return {{ClassName="m9k_usp"}} end}
`;
export function run(script, resultName) {
    const state = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(state);
    try {
        const status = lauxlib.luaL_dostring(state, to_luastring(prelude + script));
        assert.equal(status, lua.LUA_OK, status === lua.LUA_OK ? undefined : to_jsstring(lua.lua_tostring(state, -1)));
        if (resultName) {
            lua.lua_getglobal(state, to_luastring(resultName));
            assert.equal(lua.lua_type(state, -1), lua.LUA_TSTRING);
            return to_jsstring(lua.lua_tostring(state, -1));
        }
    } finally { lua.lua_close(state); }
}

