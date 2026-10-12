-- Generated from src/gamemodes/zombieplague/gamemode/weapons/client/construction/weaponconstruction_draw.ts. DO NOT EDIT; run npm run build.
-- Lua Library inline imports
local function __TS__ArrayUnshift(self, ...)
    local items = {...}
    local numItemsToInsert = #items
    if numItemsToInsert == 0 then
        return #self
    end
    for i = #self, 1, -1 do
        self[i + numItemsToInsert] = self[i]
    end
    for i = 1, numItemsToInsert do
        self[i] = items[i]
    end
    return #self
end
-- End of Lua Library inline imports
local ____exports = {}
if CLIENT then
    local function drawElements(weapon, elements, order, entity, world)
        for ____, name in ipairs(order) do
            do
                local __continue4
                repeat
                    local element = elements[name]
                    if not element or element.hide or not world and not element.bone then
                        __continue4 = true
                        break
                    end
                    local position, angle = weapon:GetBoneOrientation(elements, element, entity, world and not element.bone and "ValveBiped.Bip01_R_Hand" or nil)
                    if not position or not angle then
                        __continue4 = true
                        break
                    end
                    local forward = angle:Forward()
                    local right = angle:Right()
                    local up = angle:Up()
                    local pos = Vector(position.x + forward.x * element.pos.x + right.x * element.pos.y + up.x * element.pos.z, position.y + forward.y * element.pos.x + right.y * element.pos.y + up.y * element.pos.z, position.z + forward.z * element.pos.x + right.z * element.pos.y + up.z * element.pos.z)
                    if element.type == "Sprite" then
                        if element.spriteMaterial then
                            render.SetMaterial(element.spriteMaterial)
                            render.DrawSprite(pos, element.size.x, element.size.y, element.color)
                        end
                        __continue4 = true
                        break
                    end
                    angle:RotateAroundAxis(
                        angle:Up(),
                        element.angle.y
                    )
                    angle:RotateAroundAxis(
                        angle:Right(),
                        element.angle.p
                    )
                    angle:RotateAroundAxis(
                        angle:Forward(),
                        element.angle.r
                    )
                    if element.type == "Quad" then
                        if element.draw_func then
                            cam.Start3D2D(pos, angle, element.size)
                            element.draw_func(weapon)
                            cam.End3D2D()
                        end
                        __continue4 = true
                        break
                    end
                    local model = element.modelEnt
                    if not model or not IsValid(model) then
                        __continue4 = true
                        break
                    end
                    model:SetPos(pos)
                    model:SetAngles(angle)
                    local matrix = Matrix()
                    matrix:Scale(element.size)
                    model:EnableMatrix("RenderMultiply", matrix)
                    if model:GetMaterial() ~= element.material then
                        model:SetMaterial(element.material)
                    end
                    if model:GetSkin() ~= element.skin then
                        model:SetSkin(element.skin)
                    end
                    for id, value in pairs(element.bodygroup) do
                        if model:GetBodygroup(tonumber(id) or 0) ~= value then
                            model:SetBodygroup(
                                tonumber(id) or 0,
                                value
                            )
                        end
                    end
                    if element.surpresslightning then
                        render.SuppressEngineLighting(true)
                    end
                    render.SetColorModulation(element.color.r / 255, element.color.g / 255, element.color.b / 255)
                    render.SetBlend(element.color.a / 255)
                    model:DrawModel()
                    render.SetBlend(1)
                    render.SetColorModulation(1, 1, 1)
                    if element.surpresslightning then
                        render.SuppressEngineLighting(false)
                    end
                    __continue4 = true
                until true
                if not __continue4 then
                    break
                end
            end
        end
    end
    local function renderOrder(elements)
        local order = {}
        for name, element in pairs(elements) do
            if element.type == "Model" then
                __TS__ArrayUnshift(order, name)
            else
                order[#order + 1] = name
            end
        end
        return order
    end
    SWEP.ViewModelDrawn = function(self)
        if not IsValid(self.Owner) then
            return
        end
        local vm = self.Owner:GetViewModel()
        if not IsValid(vm) or not self.VElements then
            return
        end
        self:UpdateBonePositions(vm)
        if self.vRenderOrder == nil then
            self.vRenderOrder = renderOrder(self.VElements)
        end
        drawElements(
            self,
            self.VElements,
            self.vRenderOrder,
            vm,
            false
        )
    end
    SWEP.DrawWorldModel = function(self)
        if self.ShowWorldModel ~= false then
            self:DrawModel()
        end
        if not self.WElements then
            return
        end
        if self.wRenderOrder == nil then
            self.wRenderOrder = renderOrder(self.WElements)
        end
        drawElements(
            self,
            self.WElements,
            self.wRenderOrder,
            IsValid(self.Owner) and self.Owner or self,
            true
        )
    end
end
return ____exports
