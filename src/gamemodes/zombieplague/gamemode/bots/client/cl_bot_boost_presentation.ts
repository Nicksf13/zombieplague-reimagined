import type { BoostMenuContext, BoostMenuView } from "./cl_bot_boost_hud";
export const phrase = (key: string): string => language.GetPhrase("zombieplague.botboost" + key);
export const role = (slot: number): string => phrase(slot === 2 ? "base" : slot === 3 ? "approach" : "exit");
export function issueText(issue: ZPBotBoostIssue | undefined): string {
    if (!issue) return "";
    const keys: Record<ZPBotBoostIssueCode, string> = {
        surface: "botboostsurface", floor: "botnavreasonground", range: "botboostrange", nav: "botnavreasonmissing",
        distance: "botboostdistance", level: "botboostlevel", rise: "botboostrise", reach: "botboostreach", incomplete: "botboostincomplete",
        stale: "botbooststale", selection: "botboostselecthint", capacity: "botboostcapacity", storage: "botbooststorage", alive: "botboostalive",
        tool: "botboosttool", disabled: "botboostdisabled", round: "botboostround", frozen: "botboostfrozen", bots: "botboostbots",
        busy: "botboostretry", path: "botnavreasonconnection", physics: "botnavreasonheight", obstacle: "botnavreasonobstacle", unsaved: "botboostunsaved"
    };
    const text = (issue.Slot === 0 ? "" : role(issue.Slot) + ": ") + language.GetPhrase("zombieplague." + keys[issue.Code]);
    return text + (issue.Max > issue.Min ? "\n" + string.format(phrase("measure"), issue.Actual, issue.Min, issue.Max) : "");
}
export interface BoostViewState extends BoostMenuContext {
    Hovered: number; Slot: number; Status: string; Menu: BoostMenuView | undefined;
}
export function summary(state: BoostViewState): string {
    const draft = state.Data?.Draft, editing = state.Slot !== 0;
    const title = phrase(editing ? "editing" : "selectmode") + (state.Selected !== 0 ? " #" + state.Selected : "");
    const status = state.Data?.Dirty ? phrase("unsaved") : state.Selected !== 0 ? phrase("saved") : phrase("selecthint");
    const points = draft ? [draft.Base, draft.Approach, draft.Exit] : [];
    const result = state.Data?.Results.find(item => item.Point === state.Selected), session = state.Data?.Sessions.find(item => item.Point === state.Selected);
    const phases: Record<ZPBotBoostPhase, string> = { assemble: "botnavphasealign", mount: "botboostmount", jump: "botmotionjump", land: "botnavphaseland" };
    const progress = session ? "\n" + language.GetPhrase("zombieplague." + phases[session.Phase]) + " · #" + session.Support + " → #" + session.Climber : "";
    const outcome = result ? "\n" + string.format(phrase("results"), result.Successes, result.Failures) : "";
    return title + "\n" + status + (editing ? "\n" + points.map((position, index) => (position.length === 3 ? "✓ " : "○ ") + role(index + 2)).join("\n") : "") + progress + outcome;
}
export function hud(state: BoostViewState, palette: ZPThemePalette): void {
    const width = Math.min(480, Math.floor(ScrW() * 0.5) - 24);
    // Compact themes put ammo packs at the top right; keep their card outside this panel.
    const x = ScrW() >= 1000 ? ScrW() - width - 24 : (ScrW() - width) / 2;
    const focused = state.Menu?.Items[state.Menu.Active];
    const title = state.Menu ? state.Menu.Title : state.Slot !== 0 ? role(state.Slot) : phrase("selectmode") + (state.Hovered !== 0 ? " #" + state.Hovered : state.Selected !== 0 ? " #" + state.Selected : "");
    const draft = state.Data?.Draft;
    const ready = state.Data?.Editing && draft && [draft.Base, draft.Approach, draft.Exit].every(point => point.length === 3) && !state.Data.Issue;
    const instructions = wrap(phrase(state.Menu ? "menuhint" : state.Slot !== 0 ? "capture" : "selecthint"), width - 20);
    const saved = wrap(state.Data?.Dirty ? phrase(ready ? "complete" : "draft") : state.Selected !== 0 ? phrase("saved") : "", width - 20);
    const status = wrap((focused ? "▶ " + focused.Text + "\n" : "") + (state.Menu?.Message ? state.Menu.Message + "\n" : "") +
        (state.Pending ? language.GetPhrase("zombieplague.weaponmenuwaiting") : state.Status), width - 20);
    const height = 68 + (instructions.length + saved.length + status.length) * 16, y = 32;
    draw.RoundedBox(ZPThemes.GetActiveID() === "cs16" ? 0 : 6, x - 10, y - 10, width, height + 10, palette.Surface);
    draw.DrawText(title, "Trebuchet18", x, y, palette.Accent, TEXT_ALIGN_LEFT);
    let lineY = y + 28;
    for (const [lines, color] of [[instructions, palette.Text], [saved, palette.Text], [status, palette.Muted]] as const) {
        for (const line of lines) { draw.DrawText(line, "DermaDefault", x, lineY, color, TEXT_ALIGN_LEFT); lineY += 16; }
        lineY += 8;
    }
}
// TSTL strings contain UTF-8 bytes. Split only at codepoint boundaries, including text without spaces.
export function wrap(text: string, width: number, font = "DermaDefault"): string[] {
    const lines: string[] = []; let line = ""; surface.SetFont(font);
    for (let offset = 0; offset < text.length;) {
        const byte = text.charCodeAt(offset), size = byte < 128 ? 1 : byte < 224 ? 2 : byte < 240 ? 3 : 4;
        const character = text.substring(offset, offset + size); offset += size;
        if (character === "\n") { lines.push(line); line = ""; continue; }
        const [measured] = surface.GetTextSize(line + character);
        if (measured > width && line !== "") { lines.push(line); line = ""; }
        line += character;
    }
    if (line !== "") lines.push(line);
    return lines;
}
