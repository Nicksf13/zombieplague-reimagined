interface MapLightingContract {
    Receive(length: number): void;
    ApplyMaterials(): void;
    Restore(): void;
    DebugState(): object;
    BeginModels(drawingDepth: boolean): void;
    EndModels(): void;
}

const materialCatalog = include("cl_map_material_catalog.lua");
interface MapMaterialSnapshot {
    readonly material: GLuaMaterial;
    readonly color: GLuaVector;
    readonly reflection: GLuaVector | undefined;
}

// LightmappedGeneric/WorldVertexTransition draw the projected flashlight in a
// separate pass. Their base-pass tint dims baked lighting without a screen filter.
// See the shader references and compatibility limits in docs/map-environment.md.
export class MapLightingController implements MapLightingContract {
    private scale: number = 1;
    private appliedScale: number = 1;
    private materials: MapMaterialSnapshot[] | undefined;
    private synchronized: boolean = false;
    private lastPacketBits: number = 0;
    private candidates: number = 0;
    private shaders: Record<string, number> = {};
    private modelLightingActive: boolean = false;

    private CaptureMaterials(): boolean {
        const world = game.GetWorld();
        // GMod deliberately returns false from IsValid(worldspawn). Check its
        // identity instead, while still rejecting NULL before the map is ready.
        if (!world || !world.IsWorld())
            return false;
        // Read the actual BSP surface materials, including runtime instances.
        // The model list also covers materials absent from the surface list.
        const candidates = world.GetMaterials().map(name => Material(name));
        for (const surface of world.GetBrushSurfaces() ?? [])
            candidates.push(surface.GetMaterial());
        for (const name of materialCatalog.ReadMapMaterialNames())
            candidates.push(Material(name));
        if (candidates.length === 0)
            return false;
        this.materials = [];
        const seen: Record<string, boolean> = {};
        for (const material of candidates) {
            const name = material.GetName();
            if (seen[name])
                continue;
            seen[name] = true;
            this.candidates++;
            const shader = material.GetShader().toLowerCase();
            this.shaders[shader] = (this.shaders[shader] ?? 0) + 1;
            // Unlit decals/detail sprites otherwise retain their daytime color.
            // Static props can keep baked vertex lighting even when engine model
            // lighting is suppressed. Only their catalogued materials get tinted.
            if (name.toLowerCase().startsWith("skybox/"))
                continue;
            const staticModel = materialCatalog.IsStaticPropMaterial(name) &&
                (shader === "vertexlitgeneric" || shader === "vertexlitgeneric_dx9");
            if (!staticModel && shader !== "lightmappedgeneric" && shader !== "lightmappedgeneric_dx9" &&
                shader !== "worldvertextransition" && shader !== "worldvertextransition_dx9" &&
                shader !== "unlitgeneric" && shader !== "unlitgeneric_dx9")
                continue;
            // $color is the render modulation and may be overwritten by the
            // engine. $color2 is the persistent material tint in the base pass.
            const color = material.GetVector("$color2") ?? Vector(1, 1, 1);
            const reflection = material.GetVector("$envmaptint");
            this.materials.push({ material, color: Vector(color.x, color.y, color.z),
                reflection: reflection ? Vector(reflection.x, reflection.y, reflection.z) : undefined });
        }
        return true;
    }

    Receive(length: number): void {
        this.lastPacketBits = length;
        // Retain compatibility with messages sent before exposure was introduced.
        // Pattern (16 bits), exposure (32 bits) and lightmap refresh flag (1 bit).
        if (length !== 16 && length !== 49)
            return;
        const pattern = net.ReadString();
        const index = "bcdefghijklm".indexOf(pattern);
        if (pattern.length !== 1 || index < 0)
            return;
        const exposure = length === 49 ? net.ReadFloat() : 1;
        // Reject NaN and out-of-range values before updating the last valid state.
        if (!(exposure >= 0 && exposure <= 1))
            return;
        this.scale = (0.25 + index / 11 * 0.75) * exposure;
        this.synchronized = true;
        // Cleanup/late joins need refreshed props even with an unchanged style.
        // Only exposure edits explicitly skip the expensive lightmap rebuild.
        if (length === 49 && !net.ReadBool())
            return;
        // Let the engine's replicated style arrive before rebuilding lightmaps.
        // Repeated messages replace the same timer instead of rebuilding twice.
        timer.Create("ZPRefreshMapLighting", 0.1, 1, () => {
            render.RedownloadAllLightmaps(true, true);
        });
    }

    private SetMaterialScale(scale: number): void {
        if (scale === this.appliedScale)
            return;
        if (!this.materials && !this.CaptureMaterials())
            return;
        for (const snapshot of this.materials ?? []) {
            const color = snapshot.color;
            snapshot.material.SetVector("$color2", Vector(color.x * scale, color.y * scale, color.z * scale));
            const reflection = snapshot.reflection;
            if (reflection)
                snapshot.material.SetVector("$envmaptint", Vector(reflection.x * scale,
                    reflection.y * scale, reflection.z * scale));
            // World shaders cache their render state. Merely setting vectors
            // can leave the old bright snapshot active until it is recomputed.
            snapshot.material.Recompute();
        }
        this.appliedScale = scale;
    }

    // Nightvision supplies local projected light; it must not restore daytime.
    ApplyMaterials(): void {
        this.SetMaterialScale(hook.Call("ZPRadarCaptureLighting", GAMEMODE) === true ? 1 : this.scale);
    }
    Restore(): void { this.EndModels(); this.SetMaterialScale(1); }

    BeginModels(drawingDepth: boolean): void {
        if (drawingDepth || this.scale >= 1 || hook.Call("ZPRadarCaptureLighting", GAMEMODE) === true)
            return;
        // Replace baked model lighting, without tinting the model's texture or
        // multiplying its projected-flashlight pass. Never leak into HUD/menus.
        render.SuppressEngineLighting(true);
        render.ResetModelLighting(this.scale, this.scale, this.scale);
        this.modelLightingActive = true;
    }

    EndModels(): void {
        if (!this.modelLightingActive)
            return;
        render.SuppressEngineLighting(false);
        render.ResetModelLighting(1, 1, 1);
        this.modelLightingActive = false;
    }
    // Machine-readable developer diagnostics; no settings or permissions change.
    DebugState(): object {
        return { implementation: "material-color2-v7", synchronized: this.synchronized,
            packet_bits: this.lastPacketBits, requested_scale: this.scale, applied_scale: this.appliedScale,
            nightvision: IsNightvisionOn(), candidates: this.candidates,
            materials: this.materials?.length ?? 0, shaders: this.shaders,
            model_lighting_active: this.modelLightingActive };
    }
}

// Restore the old instance before a Lua refresh snapshots already-darkened colors.
hook.Run("ZPResetMapMaterials");
const lighting = new MapLightingController();
net.Receive("ZPRefreshMapLighting", length => lighting.Receive(length));
concommand.Add("zp_map_environment_status", () => print(util.TableToJSON(lighting.DebugState(), true)));
hook.Remove("RenderScreenspaceEffects", "ZPMapEnvironment");
hook.Add("PreRender", "ZPMapEnvironment", () => lighting.ApplyMaterials());
hook.Add("PreDrawOpaqueRenderables", "ZPMapEnvironment", depth => lighting.BeginModels(depth));
hook.Add("PreDrawTranslucentRenderables", "ZPMapEnvironment", depth => lighting.BeginModels(depth));
hook.Add("PostDrawOpaqueRenderables", "ZPMapEnvironment", () => lighting.EndModels());
hook.Add("PostDrawTranslucentRenderables", "ZPMapEnvironment", () => lighting.EndModels());
// Viewmodels have their own pass after the world. Reapply before each model and
// separate hands, then restore after the entire pass, including SWEP attachments.
hook.Add("PreDrawViewModels", "ZPMapEnvironment", () => lighting.BeginModels(false));
hook.Add("PreDrawViewModel", "ZPMapEnvironment", () => lighting.BeginModels(false));
hook.Add("PreDrawPlayerHands", "ZPMapEnvironment", () => lighting.BeginModels(false));
hook.Add("PreDrawEffects", "ZPMapEnvironment", () => lighting.EndModels());
hook.Add("PreDrawHUD", "ZPMapEnvironment", () => lighting.EndModels());
hook.Add("PostRender", "ZPMapEnvironment", () => lighting.EndModels());
hook.Add("ShutDown", "ZPMapEnvironment", () => lighting.Restore());
hook.Add("ZPResetMapMaterials", "ZPMapEnvironment", () => lighting.Restore());
