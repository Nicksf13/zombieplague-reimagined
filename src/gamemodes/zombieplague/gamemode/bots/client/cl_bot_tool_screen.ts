interface ToolScreenContract { Begin(vm: GLuaBoostViewModel, palette: ZPThemePalette, paint: ZPAction): void; Restore(): void; }
/** A temporary screen material shared by the map-editing toolguns. */
export class BotToolScreen implements ToolScreenContract {
    private texture: GLuaBoostTexture | undefined;
    private material: GLuaMaterial | undefined;
    private override: { Model: GLuaBoostViewModel; Slot: number; Previous: string } | undefined;
    constructor(private name: string) {}
    Restore(): void {
        const previous = this.override; this.override = undefined;
        if (previous && IsValid(previous.Model) && previous.Model.GetSubMaterial(previous.Slot) === "!" + this.material?.GetName())
            previous.Model.SetSubMaterial(previous.Slot, previous.Previous === "" ? undefined : previous.Previous);
    }
    Begin(vm: GLuaBoostViewModel, palette: ZPThemePalette, paint: ZPAction): void {
        this.Restore();
        if (!IsValid(vm)) return;
        const slot = vm.GetMaterials().findIndex(name => name.toLowerCase() === "models/weapons/v_toolgun/screen");
        if (slot < 0) return;
        if (!this.texture) {
            this.texture = GetRenderTarget(this.name, 512, 512);
            this.material = CreateMaterial(this.name + "Material", "UnlitGeneric", { "$basetexture": this.texture.GetName(), "$model": 1 });
            surface.CreateFont(this.name + "Text", { font: "Roboto", size: 28, weight: 700, antialias: true, additive: false, extended: true });
        }
        if (!this.material) return;
        const clipping = DisableClipping(true);
        render.PushRenderTarget(this.texture); render.Clear(palette.Surface.r, palette.Surface.g, palette.Surface.b, 255);
        cam.Start2D(); const [ok] = pcall(paint); cam.End2D();
        render.PopRenderTarget(); DisableClipping(clipping);
        if (!ok) return;
        this.override = { Model: vm, Slot: slot, Previous: vm.GetSubMaterial(slot) };
        vm.SetSubMaterial(slot, "!" + this.material.GetName());
    }
}
