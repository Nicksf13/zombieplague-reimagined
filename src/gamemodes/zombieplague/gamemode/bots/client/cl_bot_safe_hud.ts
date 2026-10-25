const { wrap } = include("cl_bot_boost_presentation.lua") as typeof import("./cl_bot_boost_presentation");
const { BotToolScreen } = include("cl_bot_tool_screen.lua") as typeof import("./cl_bot_tool_screen");
export const phrase = (key: string): string => language.GetPhrase("zombieplague.bsafe" + key);
export interface SafeMenuItem { Action: number; Text: string; Enabled: boolean; }
export interface SafeViewState {
    Role: ZPBotSafeRole; Selected: number; Pending: boolean; Feedback: string;
    Menu: boolean; PointMenu: boolean; Items: SafeMenuItem[]; Focus: number;
}
interface SafeViewContract { Screen(vm: GLuaBoostViewModel, state: SafeViewState, palette: ZPThemePalette): void; Restore(): void; HUD(state: SafeViewState, palette: ZPThemePalette): void; }
export class BotSafeHUD implements SafeViewContract {
    private screen = new BotToolScreen("ZPBotSafeScreen");
    Restore(): void { this.screen.Restore(); }
    private Text(text: string, y: number, color: GLuaColor, limit = 2): void {
        const lines = wrap(text, 448, "ZPBotSafeScreenText"), start = lines.length > limit ? Math.floor(CurTime() / 2.5) % (lines.length - limit + 1) : 0;
        lines.slice(start, start + limit).forEach((line, index) => draw.DrawText(line, "ZPBotSafeScreenText", 24, y + index * 32, color, TEXT_ALIGN_LEFT));
    }
    Screen(vm: GLuaBoostViewModel, state: SafeViewState, palette: ZPThemePalette): void {
        this.screen.Begin(vm, palette, () => {
            this.Text(phrase("title") + (state.Selected !== 0 ? " #" + state.Selected : ""), 12, palette.Accent, 1);
            this.Text(state.Menu && state.Feedback.length > 0 ? state.Feedback : state.PointMenu ? phrase("delete") + " #" + state.Selected : phrase(state.Role), 52, palette.Text, 2);
            if (state.Menu) {
                const start = Math.max(0, Math.min(state.Focus - 2, state.Items.length - 7));
                state.Items.slice(start, start + 7).forEach((item, index) => {
                    const active = index + start === state.Focus, y = 124 + index * 40;
                    draw.RoundedBox(ZPThemes.GetActiveID() === "cs16" ? 0 : 5, 12, y, 488, 36, active ? palette.Panel : palette.Surface);
                    if (active) draw.RoundedBox(0, 12, y, 6, 36, palette.Accent);
                    this.Text((active ? "▶ " : "") + item.Text, y + 2, !item.Enabled ? palette.Muted : active ? palette.Accent : palette.Text, 1);
                });
            } else {
                this.Text(phrase("toolhint"), 142, palette.Text, 5);
                this.Text(state.Pending ? language.GetPhrase("zombieplague.weaponmenuwaiting") : state.Feedback, 326, palette.Accent, 2);
            }
            this.Text(phrase(state.PointMenu ? "pointhint" : state.Menu ? "menuhint" : "rolehint"), 420, palette.Muted, 2);
        });
    }
    HUD(state: SafeViewState, palette: ZPThemePalette): void {
        const width = Math.min(480, Math.floor(ScrW() * 0.5) - 24), x = ScrW() >= 1000 ? ScrW() - width - 24 : (ScrW() - width) / 2;
        const focused = state.Menu ? state.Items[state.Focus] : undefined;
        const status = state.Pending ? language.GetPhrase("zombieplague.weaponmenuwaiting") : state.Feedback;
        const lines = wrap(phrase(state.PointMenu ? "pointhint" : state.Menu ? "menuhint" : "toolhint") + "\n" +
            (state.PointMenu ? "" : phrase("rolehint") + "\n") +
            (focused ? "▶ " + focused.Text + "\n" : "") + status, width - 20);
        draw.RoundedBox(ZPThemes.GetActiveID() === "cs16" ? 0 : 6, x - 10, 22, width, 66 + lines.length * 16, palette.Surface);
        draw.DrawText(phrase("title") + " · " + phrase(state.Role) + (state.Selected !== 0 ? " #" + state.Selected : ""), "Trebuchet18", x, 32, palette.Accent, TEXT_ALIGN_LEFT);
        lines.forEach((line, index) => draw.DrawText(line, "DermaDefault", x, 62 + index * 16, palette.Text, TEXT_ALIGN_LEFT));
    }
}
