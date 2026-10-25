import type { BotMetricsView as MetricsViewType } from "../../bots/client/cl_bot_metrics_hud";
import type { BotPopulationHUD as PopulationViewType } from "../../bots/client/cl_bot_population_hud";
import type { ServerCvarsHUD as CvarsViewType } from "./cl_server_cvars_hud";
import type { AdminRoundsHUD as RoundsViewType } from "./cl_admin_rounds_hud";
const { BotMetricsView } = include("cl_bot_metrics_hud.lua") as typeof import("../../bots/client/cl_bot_metrics_hud");
const { BotPopulationHUD } = include("cl_bot_population_hud.lua") as typeof import("../../bots/client/cl_bot_population_hud");
const { ServerCvarsHUD } = include("cl_server_cvars_hud.lua") as typeof import("./cl_server_cvars_hud");
const { AdminRoundsHUD } = include("cl_admin_rounds_hud.lua") as typeof import("./cl_admin_rounds_hud");
export class AdminMenuHUD implements ZPAdminPresentation {
    private metrics: MetricsViewType | undefined;
    private populationView: PopulationViewType | undefined;
    private cvarsView: CvarsViewType | undefined;
    private roundsView: RoundsViewType | undefined;
    private roundsRefresh: GLuaPanel | undefined;
    private populationButton: GLuaPanel | undefined;
    private addAI: GLuaPanel | undefined;
    private frame: GLuaPanel | undefined;
    private state: ZPAdminState | undefined;
    private controls: { Index: number; Panel: GLuaPanel; Input?: ZPAdminTextEntry; }[] = [];
    private save: GLuaPanel | undefined;
    private refresh: GLuaPanel | undefined;
    private reload: GLuaPanel | undefined;
    private feedback: GLuaPanel | undefined;
    private botCount: ZPMenuComboBox<number> | undefined;
    private recordingStart: GLuaPanel | undefined;
    private recordingStop: GLuaPanel | undefined;
    private recordingSave: GLuaPanel | undefined;
    private recordingStatus: GLuaPanel | undefined;
    private recordingFeedback: GLuaPanel | undefined;
    constructor(private palette: ZPThemePalette, private square: boolean) {}

    private Label(parent: GLuaPanel, key: string, y: number, width: number, height: number): GLuaPanel {
        const label = vgui.Create("DLabel", parent);
        label.SetPos(0, y); label.SetSize(width, height);
        label.SetFont("DermaDefault"); label.SetColor(this.palette.Text);
        label.SetWrap(true); label.SetText(language.GetPhrase(key));
        return label;
    }
    private Button(parent: GLuaPanel, key: string, x: number, y: number, width: number,
        action: ZPAction, centered: boolean = false): GLuaPanel {
        const button = parent.Add("DButton");
        button.SetPos(x, y); button.SetSize(width, 36); button.SetText("");
        button.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
            const text = language.GetPhrase(key);
            let textX = 10, textY = 10;
            if (centered) {
                surface.SetFont("DermaDefault");
                const [textWidth, textHeight] = surface.GetTextSize(text);
                textX = (w - textWidth) / 2;
                textY = (h - textHeight) / 2;
            }
            draw.DrawText(text, "DermaDefault", textX, textY,
                !button.IsEnabled() ? this.palette.Muted : button.IsHovered() ? this.palette.Accent : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        button.DoClick = () => { if (button.IsEnabled()) action(); };
        return button;
    }
    Open(state: ZPAdminState, actions: ZPAdminActions): void {
        this.state = state;
        const frame = vgui.Create("DFrame"); this.frame = frame;
        frame.SetTitle(""); frame.ShowCloseButton(false);
        frame.SetDraggable(false); frame.SetDeleteOnClose(true);
        const width = Math.min(760, ScrW() - 32), height = Math.min(720, ScrH() - 48);
        frame.SetSize(width, height); frame.Center();
        frame.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 8, 0, 0, w, h, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, w, 3, this.palette.Accent);
        };
        const title = this.Label(frame, state.Page === "admin" ? "zombieplague.admintitle" :
            state.Page === "tools" ? "zombieplague.admintools" :
            state.Page === "recording" ? "zombieplague.brectitle" :
            state.Page === "settings" ? "zombieplague.adminmapsettings" :
            state.Page === "rounds" ? "zombieplague.adminroundtitle" :
            state.Page === "cvars" ? ZPServerCvars.Categories[state.Cvars.Category]?.Label ?? "zombieplague.adminmapsettings" :
            state.Page === "population" ? "zombieplague.botfilltitle" :
            state.Page === "botadd" ? "zombieplague.botmetricsadd" :
            state.Page === "bots" ? "zombieplague.adminbots" : "zombieplague.adminenvironment", 20, width - 100, 66);
        title.SetPos(24, 16); title.SetFont("Trebuchet24");
        this.Button(frame, "X", width - 62, 22, 38, () => actions.Close(), true);
        const content = vgui.Create("DScrollPanel", frame);
        content.SetPos(24, 96); content.SetSize(width - 48, height - 210);
        const rowWidth = width - 68;
        if (state.Page === "admin") {
            this.Button(content, "zombieplague.adminmapsettings", 0, 0, rowWidth, () => actions.Navigate("settings"));
            this.Button(content, "zombieplague.adminbots", 0, 48, rowWidth, () => actions.Navigate("bots"));
            this.Button(content, "zombieplague.adminroundtitle", 0, 96, rowWidth, () => actions.Navigate("rounds"));
        }
        else if (state.Page === "rounds") {
            ZPMenuControls.ScrollPanel(content, this.palette, this.square);
            this.roundsView = new AdminRoundsHUD(content, rowWidth, this.palette, this.square, actions);
            this.roundsRefresh = this.Button(frame, "zombieplague.adminroundrefresh", 150, height - 52, width - 174, () => actions.RefreshRounds());
        }
        else if (state.Page === "settings") {
            ZPMenuControls.ScrollPanel(content, this.palette, this.square);
            ZPServerCvars.Categories.forEach((category, index) =>
                this.Button(content, category.Label, 0, index * 48, rowWidth, () => actions.OpenCvars(index)));
        }
        else if (state.Page === "bots") {
            this.Button(content, "zombieplague.botmetricsadd", 0, 0, rowWidth, () => actions.Navigate("botadd"));
            this.Button(content, "zombieplague.admintools", 0, 48, rowWidth, () => actions.Navigate("tools"));
            this.Button(content, "zombieplague.botstatstitle", 0, 96, rowWidth, () => { actions.Close(); RunConsoleCommand("zp_bot_statistics"); });
            if (LocalPlayer().IsSuperAdmin()) this.Button(content, "zombieplague.brectitle", 0, 144, rowWidth, () => actions.Navigate("recording"));
        }
        else if (state.Page === "tools") {
            this.Button(content, "zombieplague.botboostequip", 0, 0, rowWidth, () => { actions.Close(); ZPBotBoostEditor.Open(); });
            this.Button(content, "zombieplague.bsafeequip", 0, 48, rowWidth, () => { actions.Close(); ZPBotSafeEditor.Open(); });
        }
        else if (state.Page === "recording") {
            ZPMenuControls.ScrollPanel(content, this.palette, this.square);
            this.Label(content, "zombieplague.brechelp", 0, rowWidth, 96);
            this.recordingStatus = this.Label(content, "", 100, rowWidth, 56);
            this.recordingStart = this.Button(content, "zombieplague.brecstart", 0, 168, rowWidth, () => actions.RecordingAction(1));
            this.recordingStop = this.Button(content, "zombieplague.brecstop", 0, 216, rowWidth, () => actions.RecordingAction(2));
            this.recordingSave = this.Button(content, "zombieplague.brecsave", 0, 264, rowWidth, () => actions.RecordingAction(3));
            this.recordingFeedback = this.Label(content, "", 312, rowWidth, 120);
        }
        else if (state.Page === "botadd") {
            this.Label(content, "zombieplague.adminbotshelp", 0, rowWidth, 90);
            const quantity = content.Add("DPanel"); quantity.SetPos(0, 102); quantity.SetSize(rowWidth, 36); quantity.Paint = () => {};
            this.Label(quantity, "zombieplague.botmetricscount", 0, rowWidth - 92, 36);
            const count = vgui.Create<number>("DComboBox", quantity); this.botCount = count;
            ZPMenuControls.ComboBox(count, this.palette, this.square);
            count.SetPos(rowWidth - 80, 0); count.SetSize(80, 36); count.SetSortItems(false);
            for (let value = 1; value <= 16; value++) count.AddChoice(tostring(value), value);
            count.SetValue(tostring(state.BotCount));
            count.OnSelect = (_index, _text, value) => actions.SetBotCount(value);
            this.addAI = this.Button(content, "zombieplague.botmetricsadd", 0, 150, rowWidth, () => actions.AddBot());
            this.metrics = new BotMetricsView(content, rowWidth, this.palette, this.square, actions, 246);
            this.populationButton = this.Button(content, "zombieplague.botfilltitle", 0, 198, rowWidth, () => actions.Navigate("population"));
        }
        else if (state.Page === "population") this.populationView = new BotPopulationHUD(content, rowWidth, this.palette, this.square, actions);
        else if (state.Page === "cvars") {
            this.cvarsView = new ServerCvarsHUD(content, rowWidth, state.Cvars, this.palette, this.square, actions);
            const category = ZPServerCvars.Categories[state.Cvars.Category];
            if (category && ZPServerCvars.ForCategory(category.ID).some(entry => entry.Apply === "map"))
                this.reload = this.Button(frame, "zombieplague.adminreload", 24, height - 100, width - 48, () => actions.ConfirmReload());
            const actionWidth = (width - 174) / 2;
            this.refresh = this.Button(frame, "zombieplague.adminrefresh", 150, height - 52, actionWidth, () => actions.RefreshCvars());
            this.refresh.SetTooltip(language.GetPhrase("zombieplague.adminrefreshhelp"));
            this.save = this.Button(frame, "zombieplague.adminsave", 162 + actionWidth, height - 52, actionWidth - 12, () => actions.SaveCvars());
        }
        else {
            ZPMenuControls.ScrollPanel(content, this.palette, this.square);
            this.feedback = this.Label(content, "", 0, rowWidth, 48);
            this.Label(content, "zombieplague.adminhelp", 48, rowWidth, 60);
            ZPAdminConfig.Entries.forEach((entry, index) => {
                const y = 120 + index * 106;
                this.Label(content, entry.Label, y, rowWidth, 44).SetText(language.GetPhrase(entry.Label) + " (" + entry.Name + ")");
                this.Label(content, entry.RequiresReload ? "zombieplague.scapplymap" : "zombieplague.scapplylive", y + 84, rowWidth, 20);
                if (entry.Kind === "toggle") {
                    const button = this.Button(content, "", 0, y + 46, rowWidth, () =>
                        actions.SetValue(index, this.state?.Values[index] === "1" ? "0" : "1"));
                    button.Paint = (w, h) => {
                        draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
                        draw.DrawText(language.GetPhrase(this.state?.Values[index] === "1" ?
                            "zombieplague.settingsenabled" : "zombieplague.settingsdisabled"),
                        "Trebuchet18", 12, 8, this.palette.Accent, TEXT_ALIGN_LEFT);
                    };
                    this.controls.push({ Index: index, Panel: button });
                } else {
                    const input = vgui.Create("DTextEntry", content);
                    ZPMenuControls.TextEntry(input, this.palette, this.square);
                    input.SetPos(0, y + 46); input.SetSize(rowWidth, 36);
                    input.SetText(state.Values[index] ?? entry.Default);
                    input.OnChange = () => actions.SetValue(index, input.GetValue());
                    this.controls.push({ Index: index, Panel: input, Input: input });
                }
            });
            this.reload = this.Button(frame, "zombieplague.adminreload", 24, height - 100, width - 48, () => actions.ConfirmReload());
            const actionWidth = (width - 174) / 2;
            this.refresh = this.Button(frame, "zombieplague.adminrefresh", 150, height - 52, actionWidth, () => actions.Refresh());
            this.refresh.SetTooltip(language.GetPhrase("zombieplague.adminrefreshhelp"));
            this.save = this.Button(frame, "zombieplague.adminsave", 162 + actionWidth, height - 52, actionWidth - 12, () => actions.Save());
        }
        this.Button(frame, "zombieplague.settingsback", 24, height - 52, 114, () => actions.Back());
        frame.MakePopup();
        // Text fields need keyboard focus; ESC remains handled by the controller.
        this.Update(state);
    }
    Update(state: ZPAdminState): void {
        this.state = state;
        const recording = state.Recording;
        if (recording !== undefined) {
            this.recordingStart?.SetEnabled(recording.Ready && !recording.Pending && !recording.Enabled);
            this.recordingStop?.SetEnabled(recording.Ready && !recording.Pending && recording.Enabled);
            this.recordingSave?.SetEnabled(recording.Ready && !recording.Pending);
            this.recordingStatus?.SetText(language.GetPhrase(recording.Enabled ? "zombieplague.settingsenabled" : "zombieplague.settingsdisabled") +
                "\n" + string.format(language.GetPhrase("zombieplague.brechistory"), tostring(recording.Seconds)));
            this.recordingFeedback?.SetText((recording.Feedback.length > 0 ? language.GetPhrase(recording.Feedback) : "") +
                (recording.Path.length > 0 ? "\n" + recording.Path : ""));
        }
        this.botCount?.SetEnabled(state.CanAddBot);
        if (this.botCount && this.botCount.GetText() !== tostring(state.BotCount)) this.botCount.SetValue(tostring(state.BotCount));
        this.addAI?.SetEnabled(state.CanAddBot);
        this.metrics?.Update(state);
        this.populationButton?.SetEnabled(state.CanAddBot);
        this.populationView?.Update(state);
        this.cvarsView?.Update(state.Cvars);
        this.roundsView?.Update(state.Rounds);
        this.roundsRefresh?.SetEnabled(!state.Rounds.Pending);
        for (const control of this.controls) {
            control.Panel.SetEnabled(state.Ready && !state.Pending);
            const value = state.Values[control.Index];
            if (control.Input && value !== undefined && control.Input.GetValue() !== value)
                control.Input.SetText(value);
        }
        const form = state.Page === "cvars" ? state.Cvars : state;
        this.save?.SetEnabled(form.Ready && form.Dirty && !form.Pending && (state.Page !== "cvars" || state.Cvars.CanEdit));
        this.refresh?.SetEnabled(!form.Pending);
        this.reload?.SetEnabled(form.Ready && form.CanReload && form.ReloadRequired && !form.Dirty && !form.Pending && (state.Page !== "cvars" || state.Cvars.CanEdit));
        const feedback = state.Feedback.length > 0 ? language.GetPhrase(state.Feedback) : "";
        this.feedback?.SetText(feedback + (state.ReloadRequired ? "\n" + language.GetPhrase("zombieplague.adminreloadpending") : ""));
    }
    ConfirmReload(action: ZPAction): GLuaPanel {
        const dialog = vgui.Create("DFrame");
        const width = Math.min(600, ScrW() - 32), height = Math.min(320, ScrH() - 32);
        dialog.SetTitle(""); dialog.ShowCloseButton(false); dialog.SetDraggable(false);
        dialog.SetDeleteOnClose(true); dialog.SetSize(width, height); dialog.Center();
        dialog.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 8, 0, 0, w, h, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, w, 3, this.palette.Accent);
        };
        const title = this.Label(dialog, "zombieplague.adminreload", 0, width - 48, 60);
        title.SetPos(24, 18); title.SetFont("Trebuchet24");
        const warning = this.Label(dialog, "zombieplague.adminreloadwarning", 0, width - 48, height - 150);
        warning.SetPos(24, 82);
        // Removing the modal releases input. A stale callback cannot confirm twice.
        const dismiss = (): boolean => {
            if (!IsValid(dialog)) return false;
            dialog.Remove();
            return true;
        };
        const buttonWidth = (width - 60) / 2;
        this.Button(dialog, "zombieplague.admincancel", 24, height - 56, buttonWidth, () => { dismiss(); });
        this.Button(dialog, "zombieplague.adminconfirm", 36 + buttonWidth, height - 56, buttonWidth, () => {
            if (dismiss()) action();
        });
        dialog.MakePopup(); dialog.DoModal();
        return dialog;
    }
    Destroy(): void {
        this.recordingStart = undefined; this.recordingStop = undefined; this.recordingSave = undefined;
        this.recordingStatus = undefined; this.recordingFeedback = undefined;
        this.metrics?.Destroy(); this.metrics = undefined; this.addAI = undefined;
        this.populationView = undefined; this.populationButton = undefined;
        this.cvarsView = undefined;
        this.roundsView = undefined; this.roundsRefresh = undefined;
        this.frame?.Remove(); this.frame = undefined;
        this.controls = []; this.state = undefined;
        this.botCount = undefined;
        this.save = undefined; this.refresh = undefined; this.reload = undefined; this.feedback = undefined;
    }
}
_G.ZPCreateAdminHUD = (palette, square) => new AdminMenuHUD(palette, square);
