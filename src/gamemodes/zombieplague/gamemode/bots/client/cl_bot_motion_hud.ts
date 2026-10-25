const graph = include("cl_bot_decision_graph.lua") as typeof import("./cl_bot_decision_graph");
const phrase = (key: string): string => language.GetPhrase("zombieplague.botmotion" + key);
function text(value: string, x: number, y: number, width: number, color: GLuaColor): void {
    draw.DrawText(graph.fitted(value, width), "DermaDefault", x, y, color, TEXT_ALIGN_LEFT);
}
function actionName(action: ZPBotMove): string {
    const jump = phrase("jump"), duck = phrase("duck");
    const names: Record<ZPBotMove, string> = { forward: "↑", back: "↓", left: "←", right: "→", diagonalleft: "↖", diagonalright: "↗",
        jump: "↑+" + jump, jumpleft: "↖+" + jump, jumpright: "↗+" + jump, duck: "↑+" + duck, duckleft: "↖+" + duck,
        duckright: "↗+" + duck, sprint: "↑+" + phrase("sprint"), swim: "↑+" + phrase("water"), climb: "↑+" + phrase("ladder"),
        jumpduck: "↑+" + jump + "+" + duck };
    return names[action];
}
export function navigationLines(detail: ZPBotNavigationDiagnostic): string[] {
    const label = (key: string): string => language.GetPhrase("zombieplague.botnav" + key);
    return [string.format(label("connection"), detail.From, detail.To, label("phase" + detail.Phase)),
        label("reason" + detail.Reason), string.format(label("metrics"), detail.Height, detail.Damage)];
}
export function paint(row: ZPBotDiagnostic, width: number, palette: ZPThemePalette, square: boolean, fresh: boolean): void {
    const data = row.Motion;
    const place = row.Place;
    text(phrase("title") + (place ? " · " + language.GetPhrase("zombieplague.botplace" + place.State) : ""), 12, 8, width - 24, palette.Text);
    if (!data) { text(language.GetPhrase("zombieplague.botvisualidle"), 12, 60, width - 24, palette.Muted); return; }
    const active = row.Active && fresh, leftWidth = width * 0.48, rightX = width * 0.54;
    text((active && data.Keys !== 0 ? actionName(data.Action) : language.GetPhrase("zombieplague.botvisualidle")) + " · " + phrase(data.Mode) +
        (place && (place.State === "guard" || place.State === "inspect") ? " · " + string.format(language.GetPhrase("zombieplague.botplacehold"), place.Hold, place.Seconds) : ""),
        12, 28, width - 24, active ? palette.Accent : palette.Muted);
    const points: { X: number; Y: number }[] = [];
    const navigation = data.Navigation, path = navigation && navigation.Path.length > 0 ? navigation.Path : data.Path;
    for (let index = 0; index + 2 < path.length; index += 3) {
        const x = path[index], y = path[index + 1], z = path[index + 2];
        if (x !== undefined && y !== undefined && z !== undefined) points.push({ X: x - y * 0.35, Y: y * 0.55 - z * 0.75 });
    }
    draw.RoundedBox(square ? 0 : 4, 12, 56, leftWidth, 166, palette.Surface);
    if (navigation) navigationLines(navigation).forEach((line, index) => text(line, 20, 64 + index * 17, leftWidth - 16,
        navigation.Reason === "ready" ? palette.Accent : palette.Muted));
    if (points.length > 0) {
        const minX = Math.min(...points.map(point => point.X)), maxX = Math.max(...points.map(point => point.X));
        const minY = Math.min(...points.map(point => point.Y)), maxY = Math.max(...points.map(point => point.Y));
        const scale = Math.min((leftWidth - 32) / Math.max(32, maxX - minX), (navigation ? 72 : (place?.Point.length ?? 0) > 0 ? 110 : 130) / Math.max(32, maxY - minY));
        const screen = points.map(point => ({ X: points.length === 1 ? 12 + leftWidth / 2 : 28 + (point.X - minX) * scale,
            Y: points.length === 1 ? 158 : (navigation ? 122 : 74) + (point.Y - minY) * scale }));
        screen.forEach((point, index) => {
            const next = screen[index + 1], color = index <= 1 ? palette.Accent : palette.Muted;
            if (next) { surface.SetDrawColor(color.r, color.g, color.b, active ? 200 : 70); surface.DrawLine(point.X, point.Y, next.X, next.Y); }
            if (index === screen.length - 1 && (place?.Point.length ?? 0) > 0) {
                draw.RoundedBox(square ? 0 : 8, point.X - 8, point.Y - 8, 16, 16, palette.Accent);
                draw.RoundedBox(square ? 0 : 6, point.X - 6, point.Y - 6, 12, 12, palette.Surface);
            }
            draw.RoundedBox(square || index === screen.length - 1 ? 0 : 5, point.X - 5, point.Y - 5, 10, 10, color);
        });
    }
    if (place && place.Point.length > 0) text(string.format(language.GetPhrase("zombieplague.botplacerecord"), place.Visits, place.Finds, place.Value), 20, 204, leftWidth - 16, palette.Muted);
    const lines = [string.format(phrase("stage"), data.From, data.To),
        string.format(phrase("passage"), data.Passage[1] ?? 0, data.Passage[0] ?? 0, data.Passage[2] ?? 0),
        string.format(phrase("result"), data.Successes, data.Failures, data.Goals),
        string.format(phrase("reward"), data.Samples, data.Reward),
        string.format(phrase("progress"), data.Progress, data.Seconds, data.Stuck),
        string.format(phrase("recovery"), data.Recoveries, data.Water, data.Ladders),
        string.format(phrase("resources"), data.Breath, data.Harm)];
    lines.forEach((line, index) => text(line, rightX, 58 + index * 23, width - rightX - 12, palette.Text));
    const bindings = [{ Text: "W", Bit: 8 }, { Text: "A", Bit: 512 }, { Text: "S", Bit: 16 }, { Text: "D", Bit: 1024 },
        { Text: phrase("space"), Bit: 2 }, { Text: "Ctrl", Bit: 4 }, { Text: "Shift", Bit: 131072 }, { Text: data.Look > 15 ? "↡" : "↟", Bit: 0 }];
    const keyWidth = (width - 31) / bindings.length;
    bindings.forEach((binding, index) => {
        const pressed = active && (binding.Bit === 0 ? Math.abs(data.Look) > 15 : Math.floor(data.Keys / binding.Bit) % 2 === 1);
        const x = 12 + index * (keyWidth + 1);
        draw.RoundedBox(square ? 0 : 4, x, 230, keyWidth, 26, pressed ? palette.Accent : palette.Surface);
        text(binding.Text, x + 5, 236, keyWidth - 8, pressed ? palette.Surface : palette.Muted);
    });
    text(phrase("preferences"), 12, 266, width - 24, palette.Muted);
    const rowHeight = Math.min(20, Math.floor(110 / Math.ceil(ZPBotMotionProtocol.Actions.length / 3)));
    ZPBotMotionProtocol.Actions.forEach((action, index) => {
        const column = index % 3, line = Math.floor(index / 3), cellWidth = (width - 24) / 3;
        const x = 12 + column * cellWidth, y = 288 + line * rowHeight, value = data.Values[index] ?? 0;
        text(actionName(action), x, y, cellWidth - 12, action === data.Action ? palette.Accent : palette.Text);
        draw.RoundedBox(0, x, y + 16, cellWidth - 12, 2, palette.Surface);
        const magnitude = Math.abs(value) * (cellWidth - 12) / 2, center = x + (cellWidth - 12) / 2;
        draw.RoundedBox(0, value >= 0 ? center : center - magnitude, y + 16, magnitude, 2, value >= 0 ? palette.Accent : palette.Muted);
    });
}
