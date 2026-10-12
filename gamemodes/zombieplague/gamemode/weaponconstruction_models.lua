-- Generated from src/gamemodes/zombieplague/gamemode/weapons/client/construction/weaponconstruction_models.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__StringIncludes(self, searchString, position)
    if not position then
        position = 1
    else
        position = position + 1
    end
    local index = string.find(self, searchString, position, true)
    return index ~= nil
end

local function __TS__New(target, ...)
    local instance = setmetatable({}, target.prototype)
    instance:____constructor(...)
    return instance
end

local function __TS__Class(self)
    local c = {prototype = {}}
    c.prototype.__index = c.prototype
    c.prototype.constructor = c
    return c
end

local function __TS__ClassExtends(target, base)
    target.____super = base
    local staticMetatable = setmetatable({__index = base}, base)
    setmetatable(target, staticMetatable)
    local baseMetatable = getmetatable(base)
    if baseMetatable then
        if type(baseMetatable.__index) == "function" then
            staticMetatable.__index = baseMetatable.__index
        end
        if type(baseMetatable.__newindex) == "function" then
            staticMetatable.__newindex = baseMetatable.__newindex
        end
    end
    setmetatable(target.prototype, base.prototype)
    if type(base.prototype.__index) == "function" then
        target.prototype.__index = base.prototype.__index
    end
    if type(base.prototype.__newindex) == "function" then
        target.prototype.__newindex = base.prototype.__newindex
    end
    if type(base.prototype.__tostring) == "function" then
        target.prototype.__tostring = base.prototype.__tostring
    end
end

local Error, RangeError, ReferenceError, SyntaxError, TypeError, URIError
do
    local function getErrorStack(self, constructor)
        if debug == nil then
            return nil
        end
        local level = 1
        while true do
            local info = debug.getinfo(level, "f")
            level = level + 1
            if not info then
                level = 1
                break
            elseif info.func == constructor then
                break
            end
        end
        if __TS__StringIncludes(_VERSION, "Lua 5.0") then
            return debug.traceback(("[Level " .. tostring(level)) .. "]")
        elseif _VERSION == "Lua 5.1" then
            return string.sub(
                debug.traceback("", level),
                2
            )
        else
            return debug.traceback(nil, level)
        end
    end
    local function wrapErrorToString(self, getDescription)
        return function(self)
            local description = getDescription(self)
            local caller = debug.getinfo(3, "f")
            local isClassicLua = __TS__StringIncludes(_VERSION, "Lua 5.0")
            if isClassicLua or caller and caller.func ~= error then
                return description
            else
                return (description .. "\n") .. tostring(self.stack)
            end
        end
    end
    local function initErrorClass(self, Type, name)
        Type.name = name
        return setmetatable(
            Type,
            {__call = function(____, _self, message) return __TS__New(Type, message) end}
        )
    end
    local ____initErrorClass_1 = initErrorClass
    local ____class_0 = __TS__Class()
    ____class_0.name = ""
    function ____class_0.prototype.____constructor(self, message)
        if message == nil then
            message = ""
        end
        self.message = message
        self.name = "Error"
        self.stack = getErrorStack(nil, __TS__New)
        local metatable = getmetatable(self)
        if metatable and not metatable.__errorToStringPatched then
            metatable.__errorToStringPatched = true
            metatable.__tostring = wrapErrorToString(nil, metatable.__tostring)
        end
    end
    function ____class_0.prototype.__tostring(self)
        return self.message ~= "" and (self.name .. ": ") .. self.message or self.name
    end
    Error = ____initErrorClass_1(nil, ____class_0, "Error")
    local function createErrorClass(self, name)
        local ____initErrorClass_3 = initErrorClass
        local ____class_2 = __TS__Class()
        ____class_2.name = ____class_2.name
        __TS__ClassExtends(____class_2, Error)
        function ____class_2.prototype.____constructor(self, ...)
            ____class_2.____super.prototype.____constructor(self, ...)
            self.name = name
        end
        return ____initErrorClass_3(nil, ____class_2, name)
    end
    RangeError = createErrorClass(nil, "RangeError")
    ReferenceError = createErrorClass(nil, "ReferenceError")
    SyntaxError = createErrorClass(nil, "SyntaxError")
    TypeError = createErrorClass(nil, "TypeError")
    URIError = createErrorClass(nil, "URIError")
end

local function __TS__ObjectGetOwnPropertyDescriptors(object)
    local metatable = getmetatable(object)
    if not metatable then
        return {}
    end
    return rawget(metatable, "_descriptors") or ({})
end

local function __TS__Delete(target, key)
    local descriptors = __TS__ObjectGetOwnPropertyDescriptors(target)
    local descriptor = descriptors[key]
    if descriptor then
        if not descriptor.configurable then
            error(
                __TS__New(
                    TypeError,
                    ((("Cannot delete property " .. tostring(key)) .. " of ") .. tostring(target)) .. "."
                ),
                0
            )
        end
        descriptors[key] = nil
        return true
    end
    target[key] = nil
    return true
end
-- End of Lua Library inline imports
local ____exports = {}
if CLIENT then
    table.FullCopy = function(value)
        local clone
        clone = function(item)
            if isvector(item) then
                return Vector(item.x, item.y, item.z)
            end
            if isangle(item) then
                return Angle(item.p, item.y, item.r)
            end
            if not istable(item) then
                return item
            end
            local copy = {}
            for key, child in pairs(item) do
                copy[key] = clone(child)
            end
            return copy
        end
        return clone(value)
    end
    SWEP.CreateModels = function(self, elements)
        for ____, element in pairs(elements) do
            if element.type == "Model" and element.model ~= "" and (not IsValid(element.modelEnt) or element.createdModel ~= element.model) and string.EndsWith(element.model, ".mdl") and file.Exists(element.model, "GAME") then
                local model = ClientsideModel(element.model, RENDER_GROUP_VIEW_MODEL_OPAQUE)
                if IsValid(model) then
                    model:SetPos(self:GetPos())
                    model:SetAngles(self:GetAngles())
                    model:SetParent(self)
                    model:SetNoDraw(true)
                    element.modelEnt = model
                    element.createdModel = element.model
                else
                    __TS__Delete(element, "modelEnt")
                end
            elseif element.type == "Sprite" and element.sprite ~= "" and (not element.spriteMaterial or element.createdSprite ~= element.sprite) and file.Exists(("materials/" .. element.sprite) .. ".vmt", "GAME") then
                local name = element.sprite .. "-"
                local params = {["$basetexture"] = element.sprite}
                for ____, key in ipairs({
                    "nocull",
                    "additive",
                    "vertexalpha",
                    "vertexcolor",
                    "ignorez"
                }) do
                    if element[key] then
                        params["$" .. key] = 1
                        name = name .. "1"
                    else
                        name = name .. "0"
                    end
                end
                element.createdSprite = element.sprite
                element.spriteMaterial = CreateMaterial(name, "UnlitGeneric", params)
            end
        end
    end
    SWEP.InitializeConstruction = function(self)
        self.VElements = table.FullCopy(self.VElements)
        self.WElements = table.FullCopy(self.WElements)
        self.ViewModelBoneMods = table.FullCopy(self.ViewModelBoneMods)
        self:CreateModels(self.VElements)
        self:CreateModels(self.WElements)
        if IsValid(self.Owner) then
            local vm = self.Owner:GetViewModel()
            if IsValid(vm) then
                self:ResetBonePositions(vm)
                vm:SetColor(Color(255, 255, 255, self.ShowViewModel == false and 1 or 255))
                if self.ShowViewModel == false then
                    vm:SetMaterial("Debug/hsv")
                end
            end
        end
    end
    SWEP.RemoveConstructionModels = function(self)
        for ____, elements in ipairs({self.VElements, self.WElements}) do
            for ____, element in pairs(elements) do
                if element.type == "Model" and element.modelEnt and IsValid(element.modelEnt) then
                    element.modelEnt:Remove()
                    __TS__Delete(element, "modelEnt")
                end
            end
        end
    end
end
return ____exports
