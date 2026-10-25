const { BotToolScreen } = include("cl_bot_tool_screen.lua") as typeof import("./cl_bot_tool_screen");
import type { BoostViewState } from "./cl_bot_boost_presentation";
const ui = include("cl_bot_boost_presentation.lua") as typeof import("./cl_bot_boost_presentation");
export interface ScreenContract { Begin(vm: GLuaBoostViewModel, state: BoostViewState, palette: ZPThemePalette): void; Restore(): void; }
class BotBoostScreen implements ScreenContract {
    private surface = new BotToolScreen("ZPBotBoostScreen");
    Restore(): void { this.surface.Restore(); }
    Begin(vm: GLuaBoostViewModel, state: BoostViewState, palette: ZPThemePalette): void {
        this.surface.Begin(vm, palette, () => this.Paint(state, palette));
    }

    private Text(text: string, y: number, color: GLuaColor, lines = 2): void {
        const wrapped = ui.wrap(text, 448, "ZPBotBoostScreenText");
        const page = wrapped.length > lines ? Math.floor(CurTime() / 2.5) % (wrapped.length - lines + 1) : 0;
        wrapped.slice(page, page + lines).forEach((line, index) => draw.DrawText(line, "ZPBotBoostScreenText", 24, y + index * 32, color, TEXT_ALIGN_LEFT));
    }

    private Paint(state: BoostViewState, palette: ZPThemePalette): void {
        draw.RoundedBox(0, 0, 0, 512, 512, palette.Surface);
        if (state.Menu) { this.Menu(state, palette); return; }
        this.Text(ui.phrase(state.Slot !== 0 ? "editing" : "selectmode"), 16, palette.Text);
        const id = state.Selected || state.Hovered;
        this.Text(id !== 0 ? "#" + id : ui.phrase("new"), 80, palette.Accent, 1);
        const data = state.Data;
        const point = data?.Editing ? data.Draft : data?.Points.find(item => item.ID === id);
        const positions = point ? [point.Base, point.Approach, point.Exit] : [];
        const colors = [Color(80, 160, 255), Color(255, 210, 64), Color(95, 220, 120)];
        for (let index = 0; index < 3; index++) {
            const active = state.Slot === index + 2, color = colors[index] ?? palette.Accent, y = 124 + index * 86;
            draw.RoundedBox(ZPThemes.GetActiveID() === "cs16" ? 0 : 6, 12, y, 488, 78, active ? palette.Panel : palette.Surface);
            draw.RoundedBox(0, 12, y, active ? 8 : 3, 78, color);
            this.Text((active ? "▶ " : "") + (positions[index]?.length === 3 ? "✓ " : "○ ") + ui.role(index + 2), y + 6, active ? color : palette.Muted);
        }
        const draft = data?.Dirty || (data?.Editing && data.Draft.ID === 0);
        this.Text(draft ? ui.phrase("draft") : id !== 0 ? ui.phrase("saved") : "", 388, palette.Accent, 1);
        const status = state.Pending ? language.GetPhrase("zombieplague.weaponmenuwaiting") : data?.Dirty && !data.Issue ? ui.phrase("complete") : state.Status;
        this.Text(status, 432, palette.Text, 2);
    }

    private Menu(state: BoostViewState, palette: ZPThemePalette): void {
        const menu = state.Menu; if (!menu) return;
        this.Text(menu.Title + (state.Selected !== 0 ? " #" + state.Selected : ""), 12, palette.Accent, 1);
        const message = menu.Message || (state.Pending ? language.GetPhrase("zombieplague.weaponmenuwaiting") : state.Status);
        this.Text(message, 48, palette.Text, 2);
        // A moving window keeps every saved ID reachable without shrinking the rows.
        const start = Math.max(0, Math.min(menu.Active - 2, menu.Items.length - 7));
        menu.Items.slice(start, start + 7).forEach((item, offset) => {
            const active = start + offset === menu.Active, y = 124 + offset * 40;
            draw.RoundedBox(ZPThemes.GetActiveID() === "cs16" ? 0 : 5, 12, y, 488, 36, active ? palette.Panel : palette.Surface);
            if (active) draw.RoundedBox(0, 12, y, 6, 36, palette.Accent);
            this.Text((active ? "▶ " : "") + item.Text, y + 2, !item.Enabled ? palette.Muted : active ? palette.Accent : palette.Text, 1);
        });
        this.Text(ui.phrase("menuhint"), 414, palette.Muted, 3);
    }
}
export const screen: ScreenContract = new BotBoostScreen();
