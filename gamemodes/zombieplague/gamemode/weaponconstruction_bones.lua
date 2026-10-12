-- Generated from src/gamemodes/zombieplague/gamemode/weapons/client/construction/weaponconstruction_bones.ts. DO NOT EDIT; run npm run build.
local ____exports = {}
if CLIENT then
    SWEP.GetBoneOrientation = function(self, elements, element, entity, override, visited)
        if visited == nil then
            visited = {}
        end
        local position
        local angle
        if element.rel ~= "" then
            if visited[element.rel] then
                return nil, nil
            end
            visited[element.rel] = true
            local relative = elements[element.rel]
            if not relative then
                return nil, nil
            end
            local pos, ang = self:GetBoneOrientation(
                elements,
                relative,
                entity,
                nil,
                visited
            )
            if not pos or not ang then
                return nil, nil
            end
            position = Vector(pos.x, pos.y, pos.z)
            angle = Angle(ang.p, ang.y, ang.r)
            local forward = angle:Forward()
            local right = angle:Right()
            local up = angle:Up()
            position:Add(Vector(forward.x * relative.pos.x + right.x * relative.pos.y + up.x * relative.pos.z, forward.y * relative.pos.x + right.y * relative.pos.y + up.y * relative.pos.z, forward.z * relative.pos.x + right.z * relative.pos.y + up.z * relative.pos.z))
            angle:RotateAroundAxis(
                angle:Up(),
                relative.angle.y
            )
            angle:RotateAroundAxis(
                angle:Right(),
                relative.angle.p
            )
            angle:RotateAroundAxis(
                angle:Forward(),
                relative.angle.r
            )
        else
            local bone = entity:LookupBone(override or element.bone)
            if bone == nil then
                return nil, nil
            end
            local matrix = entity:GetBoneMatrix(bone)
            position = matrix and matrix:GetTranslation() or Vector(0, 0, 0)
            angle = matrix and matrix:GetAngles() or Angle(0, 0, 0)
            if IsValid(self.Owner) and entity == self.Owner:GetViewModel() and self.ViewModelFlip then
                angle.r = -angle.r
            end
        end
        return position, angle
    end
    SWEP.UpdateBonePositions = function(self, vm)
        if not self.ViewModelBoneMods then
            self:ResetBonePositions(vm)
            return
        end
        local count = vm:GetBoneCount()
        if count == nil then
            return
        end
        local all = {}
        do
            local i = 0
            while i <= count do
                local name = vm:GetBoneName(i)
                all[name] = self.ViewModelBoneMods[name] or ({
                    scale = Vector(1, 1, 1),
                    pos = Vector(0, 0, 0),
                    angle = Angle(0, 0, 0)
                })
                i = i + 1
            end
        end
        for name, modification in pairs(all) do
            do
                local __continue16
                repeat
                    local bone = vm:LookupBone(name)
                    if bone == nil then
                        __continue16 = true
                        break
                    end
                    local scale = Vector(modification.scale.x, modification.scale.y, modification.scale.z)
                    local parent = vm:GetBoneParent(bone)
                    while parent >= 0 do
                        local ancestor = all[vm:GetBoneName(parent)]
                        if ancestor then
                            scale:Mul(ancestor.scale)
                        end
                        parent = vm:GetBoneParent(parent)
                    end
                    vm:ManipulateBoneScale(bone, scale)
                    vm:ManipulateBoneAngles(bone, modification.angle)
                    vm:ManipulateBonePosition(bone, modification.pos)
                    __continue16 = true
                until true
                if not __continue16 then
                    break
                end
            end
        end
    end
    SWEP.ResetBonePositions = function(self, vm)
        local count = vm:GetBoneCount()
        if count == nil then
            return
        end
        do
            local i = 0
            while i <= count do
                vm:ManipulateBoneScale(
                    i,
                    Vector(1, 1, 1)
                )
                vm:ManipulateBoneAngles(
                    i,
                    Angle(0, 0, 0)
                )
                vm:ManipulateBonePosition(
                    i,
                    Vector(0, 0, 0)
                )
                i = i + 1
            end
        end
    end
end
return ____exports
