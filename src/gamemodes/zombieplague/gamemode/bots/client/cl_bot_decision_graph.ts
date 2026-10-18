export {};
const actions: readonly ZPBotAction[] = ["attack", "defend", "retreat", "group"];
const influences: readonly ZPBotInfluence[] = ["Profile", "Health", "Threat", "Distance", "Cohesion", "Learned"];
const phrase = (key: string): string => language.GetPhrase("zombieplague." + key);
const label = (key: string): string => phrase("botmetrics" + key);
function tint(color: GLuaColor, alpha: number): GLuaColor { return Color(color.r, color.g, color.b, alpha); }
export function fitted(text: string, width: number, font: string = "DermaDefault"): string {
    surface.SetFont(font);
    if (surface.GetTextSize(text)[0] <= width) return text;
    // Shorten native UTF-8 labels by codepoint; never cut into a translated character.
    let end = text.length;
    while (end > 0) {
        end--;
        while (end > 0 && text.charCodeAt(end) >= 128 && text.charCodeAt(end) < 192) end--;
        const candidate = text.substring(0, end) + "…";
        if (surface.GetTextSize(candidate)[0] <= width) return candidate;
    }
    return "…";
}
function text(value: string, x: number, y: number, width: number, color: GLuaColor, font: string = "DermaDefault"): void {
    draw.DrawText(fitted(value, Math.max(8, width), font), font, x, y, color, TEXT_ALIGN_LEFT);
}
function link(x1: number, y1: number, x2: number, y2: number, value: number, selected: boolean,
    active: boolean, palette: ZPThemePalette, phase: number): void {
    if (Math.abs(value) < 0.00001) return;
    const positive = value > 0, color = positive ? palette.Accent : palette.Muted;
    surface.SetDrawColor(color.r, color.g, color.b, selected && active ? 190 : 45);
    const steps = positive ? 1 : 12, thickness = Math.min(3, 1 + Math.floor(Math.abs(value) * 2));
    for (let step = 0; step < steps; step++) {
        const from = step / steps, to = positive ? 1 : (step + 0.55) / steps;
        for (let offset = 0; offset < thickness; offset++)
            surface.DrawLine(x1 + (x2 - x1) * from, y1 + (y2 - y1) * from + offset,
                x1 + (x2 - x1) * to, y1 + (y2 - y1) * to + offset);
    }
    if (selected && active) {
        const fraction = (CurTime() * 0.7 + phase) % 1;
        draw.RoundedBox(3, x1 + (x2 - x1) * fraction - 3, y1 + (y2 - y1) * fraction - 3, 6, 6, color);
    }
}
/** Paints the server's actual rule contributions. Animation only illustrates those connections. */
export function paint(row: ZPBotDiagnostic, width: number, palette: ZPThemePalette, square: boolean, fresh: boolean): void {
    const decision = row.Decision, active = row.Active && fresh && decision !== undefined;
    const radius = square ? 0 : 14, inputX = 22, actionX = width * 0.48, outputX = width - 64;
    text(phrase("botvisualtitle"), 12, 8, width - 24, palette.Text, "Trebuchet18");
    text(phrase("botvisuallegend"), 12, 34, width - 24, palette.Muted);
    text(phrase("botvisualinputs"), 12, 66, actionX - 30, palette.Muted);
    text(phrase("botvisualactions"), actionX - 16, 66, outputX - actionX - 8, palette.Muted);
    text(phrase("botvisualchosen"), outputX - 30, 66, 88, palette.Muted);
    if (!decision) {
        text(phrase("botvisualidle"), 14, 164, width - 28, palette.Muted, "Trebuchet18");
        return;
    }
    const names = [label("profile"), phrase("classhealth"), phrase("botvisualthreat"), phrase("botvisualdistance"), phrase("botvisualallies"), label("learned")];
    const values = [label(row.Profile), string.format("%.0f%%", decision.Health * 100), string.format("%d / %d", decision.Enemies, decision.Allies),
        string.format("%.0f", decision.Distance), string.format("%d · %s", decision.Allies, phrase("settings" + (decision.HasAlly ? "enabled" : "disabled"))), string.format("%d", row.Samples)];
    // Draw edges first so labels and nodes stay readable above the flow.
    actions.forEach((action, index) => {
        const score = decision.Scores[action], y = 124 + index * 66;
        influences.forEach((influence, signal) => link(inputX, 112 + signal * 45, actionX, y, score[influence], row.Action === action,
            active, palette, signal / 6 + index / 9));
        if (row.Action === action) link(actionX, y, outputX, 220, 1, true, active, palette, 0);
    });
    influences.forEach((influence, index) => {
        const y = 112 + index * 45, value = decision.Scores[row.Action][influence];
        const strength = Math.min(1, Math.abs(value)), size = 16 + strength * 10;
        draw.RoundedBox(square ? 0 : size / 2, inputX - size / 2, y - size / 2, size, size, active && strength > 0 ? tint(palette.Accent, 130 + strength * 125) : palette.Muted);
        text(names[index] ?? "", inputX + 18, y - 15, actionX - inputX - 55, palette.Text);
        text(values[index] ?? "", inputX + 18, y + 2, actionX - inputX - 55, palette.Muted);
    });
    actions.forEach((action, index) => {
        const score = decision.Scores[action], y = 124 + index * 66, selected = row.Action === action;
        const color = !score.Eligible || !active ? palette.Muted : selected ? palette.Accent : palette.Text;
        draw.RoundedBox(radius, actionX - 14, y - 14, 28, 28, color);
        draw.RoundedBox(square ? 0 : 10, actionX - 10, y - 10, 20, 20, palette.Surface);
        if (selected) draw.RoundedBox(square ? 0 : 5, actionX - 5, y - 5, 10, 10, color);
        text(label(action), actionX + 18, y - 17, outputX - actionX - 26, color);
        text(score.Eligible ? string.format("%+.2f", score.Total) : phrase("settingsdisabled"), actionX + 18, y + 1, outputX - actionX - 26, color);
        const barWidth = Math.max(20, outputX - actionX - 30), zero = actionX + 18 + barWidth / 2;
        draw.RoundedBox(0, actionX + 18, y + 20, barWidth, 3, palette.Surface);
        const magnitude = Math.min(1, Math.abs(score.Total) / 2) * barWidth / 2;
        if (score.Eligible) draw.RoundedBox(0, score.Total < 0 ? zero - magnitude : zero, y + 20, magnitude, 3, color);
    });
    const glow = active ? 32 + Math.sin(CurTime() * 4) * 3 : 28;
    draw.RoundedBox(square ? 0 : glow / 2, outputX - glow / 2, 220 - glow / 2, glow, glow, active ? palette.Accent : palette.Muted);
    text(label(row.Action), outputX - 36, 245, 88, active ? palette.Text : palette.Muted);
    text(label(row.Reason), 14, 370, width / 2 - 20, palette.Accent);
    text(!active ? phrase("botvisualidle") : decision.Held ? phrase("botvisualheld") : phrase("botvisualchosen"), width / 2, 370, width / 2 - 14, palette.Muted);
}
