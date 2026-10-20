export {};
const { paintRadar } = include("cl_radar_hud.lua") as typeof import("./cl_radar_hud");

class RadarClient implements ZPRadarClient {
    private readonly visible = CreateClientConVar("zp_radar_show", "1", true, false, "Show the radar when allowed by the server.");
    private overview: ZPRadarOverview | undefined;
    private material: GLuaMaterial | undefined;
    private layerMaterials: GLuaMaterial[] = [];
    private layer: number | undefined;
    private state: ZPRadarSnapshot | undefined;
    private updated = -10;

    IsVisible(): boolean { return this.visible.GetBool(); }
    SetVisible(visible: boolean): void { this.visible.SetBool(visible); }
    Configure(raw: unknown): void {
        this.overview = ZPRadarRules.Overview(raw); this.material = undefined; this.state = undefined;
        this.layerMaterials = []; this.layer = undefined;
        if (this.overview) {
            const material = Material(this.overview.Material, "smooth");
            if (!material.IsError()) this.material = material;
            for (const layer of this.overview.Layers ?? []) {
                const image = Material(layer.Material, "smooth");
                if (image.IsError()) { this.material = undefined; break; }
                this.layerMaterials.push(image);
            }
        }
        net.Start("ZPRadarReady"); net.WriteBool(this.material !== undefined); net.SendToServer();
    }
    Receive(raw: unknown): void {
        const state = ZPRadarRules.Snapshot(raw, CurTime());
        if (state) {
            if (!state.Enabled || this.state?.Team !== state.Team) this.layer = undefined;
            this.state = state; this.updated = CurTime();
        }
    }
    Paint(): void {
        const ply = LocalPlayer(), state = this.state, overview = this.overview, material = this.material;
        const theme = ZPThemes.GetTheme();
        // Live player checks prevent old packets from exposing a previous life or team.
        if (!this.IsVisible() || !IsValid(ply) || !ply.Alive() || !state?.Enabled || ply.Team() !== state.Team ||
            !overview || !material || !theme || CurTime() - this.updated > 5 || hook.Call("HUDShouldDraw", GAMEMODE, "ZPRadar") === false) return;
        const position = ply.GetPos();
        if (overview.Layers && (this.layer === undefined || ply.OnGround() || ply.WaterLevel() >= 2 ||
            ply.GetMoveType() === MOVETYPE_LADDER || ply.GetMoveType() === MOVETYPE_NOCLIP))
            this.layer = ZPRadarRules.Layer(overview, position.z, this.layer);
        const image = this.layer === undefined ? material : this.layerMaterials[this.layer] ?? material;
        paintRadar(overview, image, state, position, ply.EyeAngles().y, theme.Palette, ZPThemes.GetActiveID(), this.layer);
    }
}
const radar = new RadarClient();
_G.ZPRadar = radar;
net.Receive("ZPRadarOverview", length => { if (length <= 262144) radar.Configure(net.ReadTable()); });
net.Receive("ZPRadarState", length => { if (length <= 262144) radar.Receive(net.ReadTable()); });
hook.Add("HUDPaint", "ZPRadar", () => radar.Paint());
