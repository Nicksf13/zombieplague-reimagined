export {};
const { analyse } = include("cl_radar_capture_analysis.lua") as typeof import("./cl_radar_capture_analysis");
const { options, plan } = include("cl_radar_capture_plan.lua") as typeof import("./cl_radar_capture_plan");
const { capture } = include("cl_radar_capture_render.lua") as typeof import("./cl_radar_capture_render");

class RadarCapture implements ZPRadarCaptureManager {
    private analysis: ReturnType<typeof analyse> | undefined;
    private options: ZPRadarCaptureOptions = {};
    private plan: ZPRadarCapturePlan | undefined;
    private saved: Record<string, string> = {};
    private directory = "";
    private index = -1;
    private deadline = 0;
    private ready = 0;
    private drawing = false;
    private stage = "start";
    private diagnostic: ZPRadarCapturePlanDiagnostics = {};

    private Notice(key: string): void { print("[ZP Radar] " + language.GetPhrase("zombieplague." + key)); }
    Start(): void {
        if (this.analysis || this.plan) return;
        this.stage = "start"; this.diagnostic = {};
        const ply = LocalPlayer();
        // This authoring tool never changes a multiplayer server or enables cheats itself.
        if (!game.SinglePlayer() || !IsValid(ply) || !ply.IsAdmin() || !GetConVar("sv_cheats")?.GetBool()) {
            this.Notice("radarcapturepermission"); return;
        }
        const map = game.GetMap().toLowerCase();
        const raw = file.Read(`zombieplague/radar/capture/${map}.json`, "DATA") ??
            file.Read(`resource/zombieplague/radar/capture/${map}.json`, "GAME");
        const override = raw === undefined ? {} : raw.length <= 16384 ? options(util.JSONToTable(raw)) : undefined;
        if (!override) { this.Fail("invalid_capture_override"); return; }
        this.options = override;
        const [ok, reason] = pcall(() => { this.analysis = analyse(ply); });
        if (!ok) { this.Fail(reason); return; }
        this.stage = "analysis"; this.deadline = SysTime() + 180;
        this.Notice("radarcapturestarted");
    }
    Cancel(): void {
        const active = this.analysis !== undefined || this.plan !== undefined;
        this.Restore();
        if (active) this.Notice("radarcapturecancelled");
    }
    private Restore(): void {
        this.analysis = undefined; this.plan = undefined; this.drawing = false;
        for (const [name, value] of pairs(this.saved)) RunConsoleCommand(name, value);
        this.saved = {};
    }
    private Prepare(): void {
        const analysis = this.analysis;
        if (!analysis || !analysis.Step()) return;
        this.stage = "plan";
        const result = plan(game.GetMap().toLowerCase(), analysis.Samples(), this.options, this.diagnostic);
        if (!result) throw "invalid_floor_plan";
        this.stage = "setup";
        const extent = result.Overview.Scale * 1024;
        const desired: Record<string, string> = { cl_leveloverview: String(extent / 1024), cl_leveloverviewmarker: "0",
            r_novis: "1", r_3dsky: "0", cl_drawhud: "0", r_drawviewmodel: "0", mat_fullbright: "1", fog_override: "1", fog_enable: "0" };
        // Snapshot everything before the first mutation, including error/cancel restoration.
        for (const [name] of pairs(desired)) {
            const variable = GetConVar(name);
            if (!variable) throw "missing_cvar:" + name;
            this.saved[name] = variable.GetString();
        }
        this.plan = result; this.analysis = undefined; this.index = -1; this.ready = SysTime() + 1;
        // Unique runs keep the last successful export intact if this run is interrupted.
        this.directory = `zombieplague/radar/exports/${result.Map}/${String(Math.floor(SysTime() * 1000))}`;
        file.CreateDir(this.directory);
        for (const [name, value] of pairs(desired)) RunConsoleCommand(name, value);
    }
    Think(): void {
        if (!this.analysis && !this.plan) return;
        if (SysTime() > this.deadline) { this.Fail("capture_timeout"); return; }
        if (!game.SinglePlayer() || !IsValid(LocalPlayer()) || !LocalPlayer().IsAdmin() || !GetConVar("sv_cheats")?.GetBool()) {
            this.Fail("permission_changed"); return;
        }
        const [ok, reason] = pcall(() => this.Prepare());
        if (!ok) this.Fail(reason);
    }
    View(): ZPDanceViewData | undefined {
        const plan = this.plan;
        if (!plan) return;
        const overview = plan.Overview, extent = overview.Scale * 1024;
        return { origin: Vector(overview.X + extent / 2, overview.Y - extent / 2, Math.max(...plan.Cuts, ...plan.Heights) + 512),
            angles: Angle(90, 90, 0), fov: 90, znear: 1, zfar: 65536, drawviewer: false, drawviewmodel: false };
    }
    PostRender(): void {
        if (!this.plan || this.drawing || SysTime() < this.ready || gui.IsConsoleVisible() || gui.IsGameUIVisible()) return;
        const [ok, reason] = pcall(() => this.Frame());
        if (!ok) this.Fail(reason);
    }
    private Frame(): void {
        const plan = this.plan;
        if (!plan) return;
        this.stage = "capture";
        this.drawing = true;
        let png: string | undefined;
        try { png = capture(plan, this.index); } finally { this.drawing = false; }
        if (!png) return; // Allow native camera/cvars to settle; timeout still applies.
        this.stage = "write";
        const material = this.index < 0 ? plan.Overview.Material : plan.Overview.Layers?.[this.index]?.Material;
        if (!material || !file.Write(this.directory + "/" + material.split("/").pop()!, png)) throw "Could not write capture.";
        this.index++;
        if (this.index < plan.Heights.length) { this.ready = SysTime() + 0.1; return; }
        // The manifest is the commit marker; incomplete image stacks are never installable.
        if (!file.Write(this.directory + "/overview.json", util.TableToJSON(plan.Overview, true)) ||
            !file.Write(this.directory + "/capture.json", util.TableToJSON({ Map: plan.Map, Heights: plan.Heights, Cuts: plan.Cuts }, true)))
            throw "Could not commit capture metadata.";
        const directory = this.directory;
        this.Restore(); this.Notice("radarcapturesaved"); print("garrysmod/data/" + directory);
    }
    private Fail(reason: unknown): void {
        const message = ZPRadarRules.Record(reason)?.message;
        const details = { Map: game.GetMap(), Stage: this.stage, Error: typeof message === "string" ? message : String(reason),
            Analysis: this.analysis?.Diagnostics(), Plan: this.diagnostic };
        this.Restore();
        this.Notice("radarcapturefailed");
        // Preserve engine errors and machine-readable context instead of swallowing pcall results.
        const json = util.TableToJSON(details, true);
        print("[ZP Radar] " + json);
        file.CreateDir("zombieplague/radar");
        file.Write("zombieplague/radar/capture_error.json", json);
    }
    HideActors(): boolean | undefined { return this.drawing ? true : undefined; }
    Lighting(): boolean | undefined { return this.plan ? true : undefined; }
}
hook.Run("ZPResetRadarCapture");
const generator = new RadarCapture();
concommand.Add("zp_radar_generate", () => generator.Start());
concommand.Add("zp_radar_generate_cancel", () => generator.Cancel());
hook.Add("Think", "ZPRadarCapture", () => generator.Think());
hook.Add("CalcView", "ZPRadarCapture", () => generator.View());
hook.Add("PostRender", "ZPRadarCapture", () => generator.PostRender());
hook.Add("PrePlayerDraw", "ZPRadarCapture", () => generator.HideActors());
hook.Add("PreDrawSkyBox", "ZPRadarCapture", () => generator.HideActors());
hook.Add("PreDraw2DSkyBox", "ZPRadarCapture", () => generator.HideActors());
hook.Add("ShutDown", "ZPRadarCapture", () => generator.Cancel());
hook.Add("ZPResetRadarCapture", "ZPRadarCapture", () => generator.Cancel());
hook.Add("ZPRadarCaptureLighting", "ZPRadarCapture", () => generator.Lighting());
