-- Generated from src/gamemodes/zombieplague/gamemode/menus/client/cl_weapon_menu.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ObjectAssign(target, ...)
    local sources = {...}
    for i = 1, #sources do
        local source = sources[i]
        if type(source) == "table" then
            for key in pairs(source) do
                target[key] = source[key]
            end
        end
    end
    return target
end

local function __TS__ArrayMap(self, callbackfn, thisArg)
    local result = {}
    for i = 1, #self do
        result[i] = callbackfn(thisArg, self[i], i - 1, self)
    end
    return result
end

local function __TS__ArraySome(self, callbackfn, thisArg)
    for i = 1, #self do
        if callbackfn(thisArg, self[i], i - 1, self) then
            return true
        end
    end
    return false
end

local function __TS__ArrayFind(self, predicate, thisArg)
    for i = 1, #self do
        local elem = self[i]
        if predicate(thisArg, elem, i - 1, self) then
            return elem
        end
    end
    return nil
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end
-- End of Lua Library inline imports
local ____exports = {}
____exports.WeaponMenuController = __TS__Class()
local WeaponMenuController = ____exports.WeaponMenuController
WeaponMenuController.name = "WeaponMenuController"
function WeaponMenuController.prototype.____constructor(self)
    self.presentations = {}
    self.presentationID = "classic"
    self.opened = false
    self.automatic = false
    self.category = "primary"
    self.sequence = 0
    self.feedback = "zombieplague.weaponmenuready"
end
function WeaponMenuController.prototype.RegisterPresentation(self, id, factory)
    if type(id) == "string" and #id > 0 and not self.presentations[id] then
        self.presentations[id] = factory
    end
end
function WeaponMenuController.prototype.GetState(self)
    local state = {
        Open = self.opened,
        Category = self.category,
        Presentation = self.presentationID,
        Pending = self.pending ~= nil,
        Feedback = self.feedback
    }
    if not self.snapshot then
        return state
    end
    return __TS__ObjectAssign(
        {},
        state,
        {Snapshot = {
            Entries = __TS__ArrayMap(
                self.snapshot.Entries,
                function(____, entry) return __TS__ObjectAssign({}, entry) end
            ),
            Selected = __TS__ObjectAssign({}, self.snapshot.Selected),
            CanReceive = __TS__ObjectAssign({}, self.snapshot.CanReceive),
            Truncated = self.snapshot.Truncated
        }}
    )
end
function WeaponMenuController.prototype.Update(self)
    if self.opened then
        local ____opt_0 = self.presentation
        if ____opt_0 ~= nil then
            ____opt_0:Update(self:GetState())
        end
    end
end
function WeaponMenuController.prototype.UsePresentation(self, id)
    local factory = self.presentations[id]
    if not factory then
        return
    end
    local ____opt_2 = self.presentation
    if ____opt_2 ~= nil then
        ____opt_2:Destroy()
    end
    self.presentation = nil
    self.presentationID = id
    ZPThemes:UseTheme(id)
    if self.opened then
        self.presentation = factory()
        self.presentation:Open(
            self:GetState(),
            self
        )
    end
end
function WeaponMenuController.prototype.Open(self)
    local ____opt_4 = _G.ZPSettings
    if ____opt_4 ~= nil then
        ____opt_4:Close()
    end
    ZPMainMenu:Close()
    if self.opened then
        return
    end
    self.opened = true
    self:UsePresentation(self.presentationID)
    self:Refresh()
end
function WeaponMenuController.prototype.OpenMissing(self, kind)
    if not ZPWeaponMenuProtocol.Category(kind) then
        return
    end
    self.category = kind
    self:Open()
    self.automatic = true
    self:Refresh()
    self:Update()
end
function WeaponMenuController.prototype.Close(self)
    self.opened = false
    self.automatic = false
    local ____opt_6 = self.presentation
    if ____opt_6 ~= nil then
        ____opt_6:Destroy()
    end
    self.presentation = nil
end
function WeaponMenuController.prototype.Toggle(self)
    if self.opened then
        self:Close()
    else
        self:Open()
    end
end
function WeaponMenuController.prototype.SetCategory(self, kind)
    if not ZPWeaponMenuProtocol.Category(kind) then
        return
    end
    self.category = kind
    self:Update()
end
function WeaponMenuController.prototype.Begin(self)
    self.sequence = self.sequence >= 2147483647 and 1 or self.sequence + 1
    self.pending = {
        ID = self.sequence,
        Deadline = CurTime() + 5
    }
    self.feedback = "zombieplague.weaponmenuwaiting"
    self:Update()
    return self.sequence
end
function WeaponMenuController.prototype.Refresh(self)
    if self.pending then
        return
    end
    local id = self:Begin()
    net.Start("ZPWeaponMenuCatalog")
    net.WriteUInt(1, 8)
    net.WriteUInt(id, 31)
    net.SendToServer()
end
function WeaponMenuController.prototype.Select(self, id)
    if self.pending or not self.snapshot or not __TS__ArraySome(
        self.snapshot.Entries,
        function(____, entry) return entry.Kind == self.category and entry.ID == id end
    ) then
        return
    end
    local kind = self.category
    local request = {
        Version = 1,
        RequestID = self:Begin(),
        Kind = kind,
        ID = id
    }
    net.Start("ZPWeaponMenuSelect")
    net.WriteTable(request)
    net.SendToServer()
end
function WeaponMenuController.prototype.Receive(self, reply)
    local ____reply_RequestID_10 = reply.RequestID
    local ____opt_8 = self.pending
    if ____reply_RequestID_10 ~= (____opt_8 and ____opt_8.ID) then
        return
    end
    self.pending = nil
    if reply.Snapshot then
        self.snapshot = reply.Snapshot
    end
    local code = reply.Code == "catalog" and "ready" or (reply.Code == "invalid_weapon" and "invalidweapon" or (reply.Code == "rate_limited" and "ratelimited" or reply.Code))
    self.feedback = "zombieplague.weaponmenu" .. code
    if self.opened and self.automatic and reply.Snapshot then
        local missing = __TS__ArrayFind(
            {"primary", "secondary", "melee"},
            function(____, kind)
                local ____opt_11 = reply.Snapshot
                return (____opt_11 and ____opt_11.Selected[kind]) == "" and __TS__ArraySome(
                    reply.Snapshot.Entries,
                    function(____, entry) return entry.Kind == kind end
                )
            end
        )
        if missing then
            self.category = missing
        else
            self:Close()
        end
    end
    self:Update()
end
function WeaponMenuController.prototype.Tick(self)
    if self.opened and self.automatic then
        local ply = LocalPlayer()
        if not IsValid(ply) or not ply:Alive() or not ply:IsHuman() then
            self:Close()
        end
    end
    if self.opened and input.IsKeyDown(KEY_ESCAPE) then
        self:Close()
    end
    if self.pending and CurTime() >= self.pending.Deadline then
        self.pending = nil
        self.feedback = "zombieplague.weaponmenutimeout"
        self:Update()
    end
end
local controller = __TS__New(____exports.WeaponMenuController)
_G.ZPWeaponMenu = controller
net.Receive(
    "ZPWeaponMenuReply",
    function(length)
        if length > 524000 then
            return
        end
        local reply = ZPWeaponMenuProtocol.Reply(net.ReadTable())
        if reply then
            controller:Receive(reply)
        end
    end
)
net.Receive(
    "ZPWeaponMenuOpen",
    function() return controller:Open() end
)
net.Receive(
    "ZPWeaponMenuMissing",
    function(length)
        if length > 128 then
            return
        end
        local kind = net.ReadString()
        local ply = LocalPlayer()
        if ZPWeaponMenuProtocol.Category(kind) and IsValid(ply) and ply:Alive() and ply:IsHuman() then
            controller:OpenMissing(kind)
        end
    end
)
hook.Add(
    "Think",
    "ZPWeaponMenuController",
    function() return controller:Tick() end
)
concommand.Add(
    "zp_weapons",
    function() return controller:Toggle() end
)
for ____, id in ipairs({"classic", "hl2", "cs16"}) do
    concommand.Add(
        "zp_weapon_hud_" .. id,
        function()
            controller:UsePresentation(id)
            controller:Open()
        end
    )
end
return ____exports
