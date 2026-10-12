export {};
if (CLIENT) {
    SWEP.GetBoneOrientation = function (elements, element, entity, override, visited = {}): LuaMultiReturn<[
        GLuaVector | undefined,
        GLuaAngle | undefined
    ]> {
        let position: GLuaVector, angle: GLuaAngle;
        if (element.rel !== "") {
            if (visited[element.rel])
                return $multi(undefined, undefined);
            visited[element.rel] = true;
            const relative = elements[element.rel];
            if (!relative)
                return $multi(undefined, undefined);
            const [pos, ang] = this.GetBoneOrientation(elements, relative, entity, undefined, visited);
            if (!pos || !ang)
                return $multi(undefined, undefined);
            position = Vector(pos.x, pos.y, pos.z);
            angle = Angle(ang.p, ang.y, ang.r);
            const forward = angle.Forward(), right = angle.Right(), up = angle.Up();
            position.Add(Vector(forward.x * relative.pos.x + right.x * relative.pos.y + up.x * relative.pos.z, forward.y * relative.pos.x + right.y * relative.pos.y + up.y * relative.pos.z, forward.z * relative.pos.x + right.z * relative.pos.y + up.z * relative.pos.z));
            angle.RotateAroundAxis(angle.Up(), relative.angle.y);
            angle.RotateAroundAxis(angle.Right(), relative.angle.p);
            angle.RotateAroundAxis(angle.Forward(), relative.angle.r);
        }
        else {
            const bone = entity.LookupBone(override ?? element.bone);
            if (bone === undefined)
                return $multi(undefined, undefined);
            const matrix = entity.GetBoneMatrix(bone);
            position = matrix ? matrix.GetTranslation() : Vector(0, 0, 0);
            angle = matrix ? matrix.GetAngles() : Angle(0, 0, 0);
            if (IsValid(this.Owner) && entity === this.Owner.GetViewModel() && this.ViewModelFlip)
                angle.r = -angle.r;
        }
        return $multi(position, angle);
    };
    SWEP.UpdateBonePositions = function (vm): void {
        if (!this.ViewModelBoneMods) {
            this.ResetBonePositions(vm);
            return;
        }
        const count = vm.GetBoneCount();
        if (count === undefined)
            return;
        const all: Record<string, ZPBoneModification> = {};
        for (let i = 0; i <= count; i++) {
            const name = vm.GetBoneName(i);
            all[name] = this.ViewModelBoneMods[name] ?? { scale: Vector(1, 1, 1), pos: Vector(0, 0, 0), angle: Angle(0, 0, 0) };
        }
        for (const [name, modification] of pairs(all)) {
            const bone = vm.LookupBone(name);
            if (bone === undefined)
                continue;
            const scale = Vector(modification.scale.x, modification.scale.y, modification.scale.z);
            let parent = vm.GetBoneParent(bone);
            while (parent >= 0) {
                const ancestor = all[vm.GetBoneName(parent)];
                if (ancestor)
                    scale.Mul(ancestor.scale);
                parent = vm.GetBoneParent(parent);
            }
            vm.ManipulateBoneScale(bone, scale);
            vm.ManipulateBoneAngles(bone, modification.angle);
            vm.ManipulateBonePosition(bone, modification.pos);
        }
    };
    SWEP.ResetBonePositions = function (vm): void {
        const count = vm.GetBoneCount();
        if (count === undefined)
            return;
        for (let i = 0; i <= count; i++) {
            vm.ManipulateBoneScale(i, Vector(1, 1, 1));
            vm.ManipulateBoneAngles(i, Angle(0, 0, 0));
            vm.ManipulateBonePosition(i, Vector(0, 0, 0));
        }
    };
}
