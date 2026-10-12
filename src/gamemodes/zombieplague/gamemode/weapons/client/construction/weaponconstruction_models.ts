export {};
// SWEP Construction Kit support, originally by MagicSwap / The Alium community.
// https://github.com/MagicSwap/SWEP_Construction_Kit/blob/master/lua/weapons/swep_construction_kit/base_code.lua
if (CLIENT) {
    table.FullCopy = function <T>(value: T): T {
        const clone = (item: unknown): unknown => {
            if (isvector(item))
                return Vector(item.x, item.y, item.z);
            if (isangle(item))
                return Angle(item.p, item.y, item.r);
            if (!istable(item))
                return item;
            const copy: Record<string, unknown> = {};
            for (const [key, child] of pairs(item))
                copy[key] = clone(child);
            return copy;
        };
        // Cloning preserves the value's table shape and scalar/userdata types.
        return clone(value) as T;
    };
    SWEP.CreateModels = function (elements): void {
        for (const [, element] of pairs(elements)) {
            if (element.type === "Model" && element.model !== "" && (!IsValid(element.modelEnt) || element.createdModel !== element.model) && string.EndsWith(element.model, ".mdl") && file.Exists(element.model, "GAME")) {
                const model = ClientsideModel(element.model, RENDER_GROUP_VIEW_MODEL_OPAQUE);
                if (IsValid(model)) {
                    model.SetPos(this.GetPos());
                    model.SetAngles(this.GetAngles());
                    model.SetParent(this);
                    model.SetNoDraw(true);
                    element.modelEnt = model;
                    element.createdModel = element.model;
                }
                else
                    delete element.modelEnt;
            }
            else if (element.type === "Sprite" && element.sprite !== "" && (!element.spriteMaterial || element.createdSprite !== element.sprite) && file.Exists("materials/" + element.sprite + ".vmt", "GAME")) {
                let name = element.sprite + "-";
                const params: Record<string, string | number> = { "$basetexture": element.sprite };
                for (const key of ["nocull", "additive", "vertexalpha", "vertexcolor", "ignorez"] as const) {
                    if (element[key]) {
                        params["$" + key] = 1;
                        name += "1";
                    }
                    else
                        name += "0";
                }
                element.createdSprite = element.sprite;
                element.spriteMaterial = CreateMaterial(name, "UnlitGeneric", params);
            }
        }
    };
    SWEP.InitializeConstruction = function (): void {
        this.VElements = table.FullCopy(this.VElements);
        this.WElements = table.FullCopy(this.WElements);
        this.ViewModelBoneMods = table.FullCopy(this.ViewModelBoneMods);
        this.CreateModels(this.VElements);
        this.CreateModels(this.WElements);
        if (IsValid(this.Owner)) {
            const vm = this.Owner.GetViewModel();
            if (IsValid(vm)) {
                this.ResetBonePositions(vm);
                vm.SetColor(Color(255, 255, 255, this.ShowViewModel === false ? 1 : 255));
                if (this.ShowViewModel === false)
                    vm.SetMaterial("Debug/hsv");
            }
        }
    };
    SWEP.RemoveConstructionModels = function (): void {
        for (const elements of [this.VElements, this.WElements])
            for (const [, element] of pairs(elements)) {
                if (element.type === "Model" && element.modelEnt && IsValid(element.modelEnt)) {
                    element.modelEnt.Remove();
                    delete element.modelEnt;
                }
            }
    };
}
