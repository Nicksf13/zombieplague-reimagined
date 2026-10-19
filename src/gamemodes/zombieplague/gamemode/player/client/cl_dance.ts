const { GetDanceState } = include("sh_dance.lua") as typeof import("../shared/sh_dance");
const { EmoteCamera } = include("cl_dance_camera.lua") as typeof import("./cl_dance_camera");
export class DanceView implements ZPDanceView {
    private camera: ZPEmoteCamera = new EmoteCamera();
    private cancelled = false;
    private consumeAttack = false;
    private leftDown = false;
    private deadline = 0;
    private cameraDeadline = 0;
    private cameraModel = "";
    private CanView(ply: ZPClientPlayer): boolean {
        return IsValid(ply) && ply.Alive() && ply.Team() !== TEAM_SPECTATOR && ply.GetViewEntity() === ply;
    }
    private Active(ply: ZPClientPlayer): ZPDanceAnimationState | undefined {
        const deadline = IsValid(ply) ? ply.GetNWFloat("ZPDanceUntil", 0) : 0;
        if (deadline !== this.deadline) this.cancelled = false;
        this.deadline = deadline;
        return this.CanView(ply) ? GetDanceState(ply) : undefined;
    }
    private ResetCamera(): void {
        this.camera.Reset();
        this.cameraDeadline = 0;
        this.cameraModel = "";
    }
    private CameraOn(ply: ZPClientPlayer, state: ZPDanceAnimationState | undefined): boolean {
        if (!this.CanView(ply)) { this.ResetCamera(); return false; }
        if (this.cameraModel !== "" && ply.GetModel() !== this.cameraModel) this.ResetCamera();
        const on = state !== undefined && !this.cancelled && ply.ZPDanceAnimationUntil === state.Until;
        if (on && this.cameraDeadline !== state.Until) {
            this.cameraDeadline = state.Until;
            this.cameraModel = ply.GetModel();
            this.camera.Begin(state);
        }
        return on;
    }
    Move(command: ZPClientUserCommand): void {
        const ply = LocalPlayer(), active = this.Active(ply), left = input.IsMouseDown(MOUSE_LEFT);
        if (active && !this.cancelled && left && !this.leftDown && !vgui.CursorVisible() && !ply.IsTyping()) {
            this.cancelled = true; this.consumeAttack = true;
            KeyManager.PressingKeyList[MOUSE_LEFT] = true;
            net.Start("ZPDanceCancel"); net.SendToServer();
        }
        this.leftDown = left;
        const on = this.CameraOn(ply, active);
        if (on) this.camera.Move(command);
        if (active) {
            command.ClearButtons(); command.ClearMovement(); command.SetImpulse(0);
            command.SetViewAngles(Angle(active.Pitch, active.Yaw, 0));
        }
        if (this.consumeAttack) {
            command.RemoveKey(IN_ATTACK);
            if (!left) this.consumeAttack = false;
        }
    }
    View(ply: ZPClientPlayer, view: ZPDanceViewData): ZPDanceViewData | undefined {
        if (!this.CanView(ply)) { this.ResetCamera(); return undefined; }
        const on = this.CameraOn(ply, this.Active(ply));
        return this.camera.View(ply, view, on);
    }
    Draw(ply: ZPClientPlayer): boolean | undefined {
        if (!this.CanView(ply)) return undefined;
        if (this.CameraOn(ply, this.Active(ply)) && this.camera.Visible()) return true;
        return undefined;
    }
    PreparePlayer(ply: ZPClientPlayer): void {
        const state = GetDanceState(ply);
        if (!state) return;
        if (!ply.ZPDanceRenderAngles) {
            const angles = ply.GetRenderAngles();
            ply.ZPDanceRenderAngles = Angle(angles.p, angles.y, angles.r);
        }
        ply.SetRenderAngles(Angle(0, state.Yaw, 0));
        ply.InvalidateBoneCache();
    }
    RestorePlayer(ply: ZPClientPlayer): void {
        if (!ply.ZPDanceRenderAngles) return;
        ply.SetRenderAngles(ply.ZPDanceRenderAngles);
        ply.InvalidateBoneCache();
        delete ply.ZPDanceRenderAngles;
    }
}
const view = new DanceView();
hook.Add("CreateMove", "ZPDanceControls", command => view.Move(command));
hook.Add("CalcView", "ZPDanceCamera", (ply, origin, angles, fov, znear, zfar) =>
    view.View(ply, { origin, angles, fov, znear, zfar, drawviewer: true }));
hook.Add("ShouldDrawLocalPlayer", "ZPDanceModel", ply => view.Draw(ply));
hook.Add("PrePlayerDraw", "ZPDanceFacing", ply => view.PreparePlayer(ply));
hook.Add("PostPlayerDraw", "ZPDanceFacing", ply => view.RestorePlayer(ply));
concommand.Add("zp_dance", () => { net.Start("ZPDanceStart"); net.SendToServer(); });
