import test from "node:test";
import { run } from "./helpers/lua-runtime.mjs";

const setup = `
function CurTime() return 10 end
KEY_NONE,KEY_F3,KEY_F4,KEY_T=0,94,95,30
KEY_1,KEY_2,KEY_3,KEY_4,KEY_5,KEY_6,KEY_7,KEY_8,KEY_9,KEY_0=1,2,3,4,5,6,7,8,9,10
NOTIFY_GENERIC=0
local typing=false
local localPlayer={IsTyping=function() return typing end,Team=function() return TEAM_HUMANS end,IsAdmin=function() return false end,IsSuperAdmin=function() return false end}
function LocalPlayer() return localPlayer end
notification={AddLegacy=function() end}
input={IsKeyDown=function() return false end,WasKeyPressed=function() return false end}
hook.Remove=function(name,id) if hooks[name] then hooks[name][id]=nil end end
net.SendToServer=function() end
file.Read=function() return nil end
file.Exists=function() return true end
file.Write=function() end
util.TableToJSON=function() return "{}" end
util.JSONToTable=function() return {} end
include("cl_data.lua")
`;

test("key bindings merge valid saved values with defaults and preserve action self", () => run(setup + `
    local saved={ZombiePlagueActions={NightVisionToggle=22,RequestAbility="invalid"},ZombiePlagueMenu={ZPMenu=-1},unknown={x=50}}
    file.Read=function() return "saved" end
    util.JSONToTable=function() return saved end
    include("cl_keymanager.lua")
    assert(KeyManager.Keys.ZombiePlagueActions.NightVisionToggle==22)
    assert(KeyManager.Keys.ZombiePlagueActions.RequestAbility==KEY_T and not KeyManager.Keys.ZombiePlagueMenu)
    assert(not KeyManager.Keys.unknown)
    local calls=0
    KeyManager.EventGroups.ZombiePlagueActions.NightVisionToggle.Action=function(self) assert(self.Name=="KeyBindingNightVisionToggle"); calls=calls+1 end
    input.IsKeyDown=function(key) return key==22 end
    hooks.Think.KeyManagerHook(); hooks.Think.KeyManagerHook(); assert(calls==1)
    KeyManager.LastPress=0; input.IsKeyDown=function() return false end; hooks.Think.KeyManagerHook()
    input.IsKeyDown=function(key) return key==22 end; hooks.Think.KeyManagerHook(); assert(calls==2)
`));

