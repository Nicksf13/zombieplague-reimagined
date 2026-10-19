// One continuous blend drives both entering and leaving third person. Animation
// sequence changes never reset it; reversing during entry starts at the current distance.
export class EmoteCamera implements ZPEmoteCamera {
    private active = false;
    private from = 0;
    private changedAt = SysTime();
    private pitch = 0;
    private yaw = 0;
    private ignoreNextInput = true;

    private Fraction(): number {
        const progress = Math.max(0, Math.min(1, (SysTime() - this.changedAt) / 0.22));
        const eased = progress * progress * (3 - 2 * progress);
        return this.from + ((this.active ? 1 : 0) - this.from) * eased;
    }

    Begin(state: ZPDanceAnimationState): void {
        if (this.Fraction() <= 0) { this.pitch = state.Pitch; this.yaw = state.Yaw; }
        // Closing the mouse-driven wheel can leave a cursor-warp delta in the next command.
        this.ignoreNextInput = true;
    }

    Move(command: ZPClientUserCommand): void {
        if (this.ignoreNextInput) { this.ignoreNextInput = false; return; }
        this.pitch = Math.max(-89, Math.min(89, this.pitch + command.GetMouseY() * (GetConVar("m_pitch")?.GetFloat() ?? 0.022)));
        this.yaw -= command.GetMouseX() * (GetConVar("m_yaw")?.GetFloat() ?? 0.022);
    }

    private BlendAngle(from: number, to: number, fraction: number): number {
        const difference = ((to - from + 180) % 360 + 360) % 360 - 180;
        return from + difference * fraction;
    }

    View(ply: ZPClientPlayer, view: ZPDanceViewData, on: boolean): ZPDanceViewData | undefined {
        if (on !== this.active) {
            this.from = this.Fraction();
            this.changedAt = SysTime();
            this.active = on;
        }
        const fraction = this.Fraction();
        if (fraction <= 0) return undefined;
        const distance = 100 * Math.max(0.5, Math.min(2, ply.GetModelScale())) * fraction;
        const pitch = this.pitch * Math.PI / 180, yaw = this.yaw * Math.PI / 180;
        const target = Vector(view.origin.x - Math.cos(pitch) * Math.cos(yaw) * distance,
            view.origin.y - Math.cos(pitch) * Math.sin(yaw) * distance, view.origin.z + Math.sin(pitch) * distance);
        const trace = util.TraceHull({ start: view.origin, endpos: target, mins: Vector(-6, -6, -6),
            maxs: Vector(6, 6, 6), mask: MASK_SOLID, filter: player.GetAll() });
        view.origin = trace.StartSolid ? view.origin : trace.HitPos;
        view.angles = Angle(this.BlendAngle(view.angles.p, this.pitch, fraction),
            this.BlendAngle(view.angles.y, this.yaw, fraction), this.BlendAngle(view.angles.r, 0, fraction));
        view.drawviewer = on && this.Visible();
        view.drawviewmodel = false;
        return view;
    }

    Visible(): boolean { return this.active && this.Fraction() >= 0.25; }

    Reset(): void {
        this.active = false;
        this.from = 0;
        this.changedAt = SysTime();
        this.ignoreNextInput = true;
    }
}
