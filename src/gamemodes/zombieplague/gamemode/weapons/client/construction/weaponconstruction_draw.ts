export {};
if (CLIENT) {
    const drawElements = (weapon: ZPScriptedWeapon, elements: ZPConstructionElements, order: string[], entity: GLuaEntity, world: boolean): void => {
        for (const name of order) {
            const element = elements[name];
            if (!element || element.hide || (!world && !element.bone))
                continue;
            const [position, angle] = weapon.GetBoneOrientation(elements, element, entity, world && !element.bone ? "ValveBiped.Bip01_R_Hand" : undefined);
            if (!position || !angle)
                continue;
            const forward = angle.Forward(), right = angle.Right(), up = angle.Up();
            const pos = Vector(position.x + forward.x * element.pos.x + right.x * element.pos.y + up.x * element.pos.z, position.y + forward.y * element.pos.x + right.y * element.pos.y + up.y * element.pos.z, position.z + forward.z * element.pos.x + right.z * element.pos.y + up.z * element.pos.z);
            if (element.type === "Sprite") {
                if (element.spriteMaterial) {
                    render.SetMaterial(element.spriteMaterial);
                    render.DrawSprite(pos, element.size.x, element.size.y, element.color);
                }
                continue;
            }
            angle.RotateAroundAxis(angle.Up(), element.angle.y);
            angle.RotateAroundAxis(angle.Right(), element.angle.p);
            angle.RotateAroundAxis(angle.Forward(), element.angle.r);
            if (element.type === "Quad") {
                if (element.draw_func) {
                    cam.Start3D2D(pos, angle, element.size);
                    element.draw_func(weapon);
                    cam.End3D2D();
                }
                continue;
            }
            const model = element.modelEnt;
            if (!model || !IsValid(model))
                continue;
            model.SetPos(pos);
            model.SetAngles(angle);
            const matrix = Matrix();
            matrix.Scale(element.size);
            model.EnableMatrix("RenderMultiply", matrix);
            if (model.GetMaterial() !== element.material)
                model.SetMaterial(element.material);
            if (model.GetSkin() !== element.skin)
                model.SetSkin(element.skin);
            for (const [id, value] of pairs(element.bodygroup))
                if (model.GetBodygroup(tonumber(id) ?? 0) !== value)
                    model.SetBodygroup(tonumber(id) ?? 0, value);
            if (element.surpresslightning)
                render.SuppressEngineLighting(true);
            render.SetColorModulation(element.color.r / 255, element.color.g / 255, element.color.b / 255);
            render.SetBlend(element.color.a / 255);
            model.DrawModel();
            render.SetBlend(1);
            render.SetColorModulation(1, 1, 1);
            if (element.surpresslightning)
                render.SuppressEngineLighting(false);
        }
    };
    const renderOrder = (elements: ZPConstructionElements): string[] => {
        const order: string[] = [];
        for (const [name, element] of pairs(elements))
            if (element.type === "Model")
                order.unshift(name);
            else
                order.push(name);
        return order;
    };
    SWEP.ViewModelDrawn = function (): void {
        if (!IsValid(this.Owner))
            return;
        const vm = this.Owner.GetViewModel();
        if (!IsValid(vm) || !this.VElements)
            return;
        this.UpdateBonePositions(vm);
        this.vRenderOrder ??= renderOrder(this.VElements);
        drawElements(this, this.VElements, this.vRenderOrder, vm, false);
    };
    SWEP.DrawWorldModel = function (): void {
        if (this.ShowWorldModel !== false)
            this.DrawModel();
        if (!this.WElements)
            return;
        this.wRenderOrder ??= renderOrder(this.WElements);
        drawElements(this, this.WElements, this.wRenderOrder, IsValid(this.Owner) ? this.Owner : this, true);
    };
}
