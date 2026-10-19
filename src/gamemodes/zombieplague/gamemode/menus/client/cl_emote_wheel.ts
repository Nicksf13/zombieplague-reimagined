const { Emotes } = include("sh_emotes.lua") as typeof import("../../player/shared/sh_emotes");
const { IsBindingDown } = include("cl_key_input.lua") as typeof import("../../interface/client/cl_key_input");
const { EmoteWheelHUD } = include("cl_emote_wheel_hud.lua") as typeof import("./cl_emote_wheel_hud");

export class EmoteWheel implements ZPEmoteWheel, ZPEmoteWheelActions {
    private hud: ZPEmoteWheelPresentation | undefined;
    private heldKey: number | undefined;
    private page = 0;
    private entries: ZPEmoteWheelEntry[] = [];
    private model = "";
    private team = 0;
    private consumeCommand = false;
    private consumeClicks = false;
    private pendingOpen = false;

    private Allowed(): boolean {
        const ply = LocalPlayer(), state = RoundManager.GetRoundState();
        return IsValid(ply) && ply.Alive() && (ply.Team() === TEAM_HUMANS || ply.Team() === TEAM_ZOMBIES) &&
            !ply.IsTyping() && ply.GetViewEntity() === ply && ply.GetNWFloat("ZPDanceUntil", 0) <= CurTime() &&
            !KeyManager.Capturing && !gui.IsGameUIVisible() && !gui.IsConsoleVisible() && !IsValid(vgui.GetKeyboardFocus()) &&
            (state === ROUND_WAITING_PLAYERS || state === ROUND_STARTING_NEW_ROUND || state === ROUND_PLAYING);
    }

    IsOpen(): boolean { return this.hud !== undefined; }

    Open(key?: number): void {
        if (this.IsOpen() || !this.Allowed() || vgui.CursorVisible() || !ZPThemes.GetTheme()) return;
        const ply = LocalPlayer();
        this.model = ply.GetModel(); this.team = ply.Team();
        this.entries = Emotes.map(entry => {
            const sequence = ply.SelectWeightedSequence(entry.Activity);
            const duration = sequence >= 0 ? ply.SequenceDuration(sequence) : 0;
            return { ...entry, Available: duration > 0 && Number.isFinite(duration) };
        });
        this.heldKey = key !== undefined && key !== KEY_NONE ? key : undefined;
        this.consumeCommand = true;
        this.hud = new EmoteWheelHUD(this);
        this.hud.Open();
    }

    State(): ZPEmoteWheelState {
        return { Entries: this.entries.slice(this.page * 8, this.page * 8 + 8), Page: this.page,
            Pages: Math.ceil(this.entries.length / 8) };
    }

    Page(direction: number): void {
        const pages = this.State().Pages;
        if (pages > 0) this.page = (this.page + direction + pages) % pages;
    }

    private Finish(cancel: boolean): void {
        const hud = this.hud;
        if (!hud) return;
        const selected = hud.Selection(), state = this.State();
        const entry = selected === undefined ? undefined : state.Entries[selected];
        const ply = LocalPlayer();
        const allowed = this.Allowed() && ply.GetModel() === this.model && ply.Team() === this.team;
        // Clear ownership before panel removal, whose callback can also cancel.
        this.hud = undefined;
        this.heldKey = undefined;
        this.consumeCommand = true;
        hud.Destroy();
        if (!cancel && allowed && entry?.Available) {
            net.Start("ZPDanceStart"); net.WriteUInt(entry.ID, 8); net.SendToServer();
        }
    }

    Cancel(): void { this.pendingOpen = false; this.Finish(true); }

    OpenFromCommand(): void {
        // A console-issued command must wait for the console to relinquish input.
        if (gui.IsConsoleVisible()) this.pendingOpen = true;
        else this.Open();
    }

    Click(button: number): void {
        if (button !== MOUSE_LEFT && button !== MOUSE_RIGHT) return;
        if (button === this.heldKey) return;
        this.consumeClicks = true;
        KeyManager.PressingKeyList[button] = true;
        this.Finish(button === MOUSE_RIGHT);
    }

    Tick(): void {
        if (this.pendingOpen && !gui.IsConsoleVisible()) {
            this.pendingOpen = false;
            this.Open();
        }
        if (!this.hud) return;
        const ply = LocalPlayer();
        if (!this.Allowed() || input.IsKeyDown(KEY_ESCAPE) || ply.GetModel() !== this.model || ply.Team() !== this.team) {
            this.Cancel(); return;
        }
        if (this.heldKey !== undefined && !IsBindingDown(this.heldKey)) this.Finish(false);
    }

    Move(command: ZPClientUserCommand): void {
        if (this.IsOpen() || this.consumeCommand) {
            command.ClearButtons(); command.ClearMovement(); command.SetImpulse(0);
            this.consumeCommand = false;
        }
        if (this.consumeClicks) {
            command.RemoveKey(IN_ATTACK); command.RemoveKey(IN_ATTACK2);
            if (!input.IsMouseDown(MOUSE_LEFT) && !input.IsMouseDown(MOUSE_RIGHT)) this.consumeClicks = false;
        }
    }
}
const wheel = new EmoteWheel();
_G.ZPEmoteWheel = wheel;
hook.Add("Think", "ZPEmoteWheel", () => wheel.Tick());
hook.Add("CreateMove", "ZPEmoteWheel", command => wheel.Move(command));
hook.Add("PlayerBindPress", "ZPEmoteWheel", () => { if (wheel.IsOpen()) return true; });
concommand.Add("zp_emotes", () => wheel.OpenFromCommand());
