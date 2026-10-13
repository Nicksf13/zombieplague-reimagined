interface NightvisionLightContract {
    Update(): void;
    Remove(): void;
}

// A projected pass remains visible with zero ambient material tint. DynamicLight
// shares that tint and required restoring the entire map's daytime appearance.
export class NightvisionLightController implements NightvisionLightContract {
    private light: GLuaNightvisionLight | undefined;

    Update(): void {
        const ply = LocalPlayer();
        if (!IsValid(ply) || !IsNightvisionOn()) {
            this.Remove();
            return;
        }
        if (!this.light || !this.light.IsValid()) {
            const light = ProjectedTexture();
            if (!light || !light.IsValid())
                return;
            light.SetTexture("effects/flashlight001");
            light.SetFOV(120);
            light.SetNearZ(4);
            light.SetFarZ(750);
            light.SetBrightness(0.6);
            // Keep the shadow slots available for players' native flashlights.
            light.SetEnableShadows(false);
            this.light = light;
        }
        this.light.SetPos(ply.GetShootPos());
        this.light.SetAngles(ply.EyeAngles());
        this.light.SetColor(ply.GetNightvisionColor());
        this.light.Update();
    }

    Remove(): void {
        if (this.light?.IsValid())
            this.light.Remove();
        this.light = undefined;
    }
}

hook.Run("ZPResetNightvisionLight");
const nightvision = new NightvisionLightController();
hook.Add("Think", "ZPNightvisionLight", () => nightvision.Update());
hook.Add("ShutDown", "ZPNightvisionLight", () => nightvision.Remove());
hook.Add("ZPResetNightvisionLight", "ZPNightvisionLight", () => nightvision.Remove());
