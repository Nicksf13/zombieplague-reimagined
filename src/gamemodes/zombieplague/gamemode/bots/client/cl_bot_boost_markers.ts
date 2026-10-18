const ui = include("cl_bot_boost_presentation.lua") as typeof import("./cl_bot_boost_presentation");
const tint = (slot: number): GLuaColor => slot === 2 ? Color(80, 160, 255) : slot === 3 ? Color(255, 210, 64) : Color(95, 220, 120);
const vector = (position: number[], height = 4): GLuaVector => Vector(position[0] ?? 0, position[1] ?? 0, (position[2] ?? 0) + height);
export function pick(snapshot: ZPBotBoostSnapshot | undefined): number {
    let selected = 0, distance = 28 ** 2;
    for (const point of snapshot?.Points ?? []) for (const position of [point.Base, point.Approach, point.Exit]) {
        const screen = vector(position).ToScreen(); if (!screen.visible) continue;
        const candidate = (screen.x - ScrW() / 2) ** 2 + (screen.y - ScrH() / 2) ** 2;
        if (candidate < distance || (candidate === distance && (selected === 0 || point.ID < selected))) { distance = candidate; selected = point.ID; }
    }
    return selected;
}
function points(snapshot: ZPBotBoostSnapshot | undefined): ZPBotBoostPoint[] {
    if (!snapshot) return [];
    return snapshot.Editing ? [...snapshot.Points.filter(point => point.ID !== snapshot.Draft.ID), snapshot.Draft] : snapshot.Points;
}
export function markers(snapshot: ZPBotBoostSnapshot | undefined, selected: number, hovered: number, slot: number, palette: ZPThemePalette): void {
    for (const data of points(snapshot)) {
        const editing = snapshot?.Editing && data === snapshot.Draft, active = editing || data.ID === selected || data.ID === hovered;
        const errorSlot = (editing || data.ID === selected) && snapshot?.Issue?.Code !== "incomplete" ? snapshot?.Issue?.Slot : 0;
        [data.Base, data.Approach, data.Exit].forEach((position, index) => {
            if (position.length !== 3) return;
            const color = errorSlot === index + 2 ? Color(240, 80, 80) : tint(index + 2);
            if (!active) color.a = 100;
            render.DrawWireframeSphere(vector(position), active ? slot === index + 2 ? 16 : 12 : 7, active ? 12 : 6, active ? 8 : 4, color, false);
        });
        for (const [from, to] of [[data.Approach, data.Base], [data.Base, data.Exit]]) {
            if (!from || !to || from.length !== 3 || to.length !== 3) continue;
            const start = vector(from), end = vector(to), color = active ? palette.Accent : palette.Muted;
            render.DrawLine(start, end, color, false);
            const dx = end.x - start.x, dy = end.y - start.y, dz = end.z - start.z, length = Math.max(1, Math.sqrt(dx * dx + dy * dy + dz * dz));
            const horizontal = Math.max(1, Math.sqrt(dx * dx + dy * dy)), size = Math.min(12, length * 0.3);
            for (const side of [-1, 1]) render.DrawLine(end, Vector(end.x - dx / length * size - dy / horizontal * size * side * 0.5,
                end.y - dy / length * size + dx / horizontal * size * side * 0.5, end.z - dz / length * size), color, false);
        }
    }
}
export function labels(snapshot: ZPBotBoostSnapshot | undefined, selected: number, hovered: number, palette: ZPThemePalette): void {
    for (const data of points(snapshot)) {
        const editing = snapshot?.Editing && data === snapshot.Draft, active = editing || data.ID === selected || data.ID === hovered;
        [data.Base, data.Approach, data.Exit].forEach((position, index) => {
            if (position.length !== 3 || (!active && index !== 0)) return;
            const screen = vector(position, 20).ToScreen(); if (!screen.visible) return;
            const text = (data.ID !== 0 ? "#" + data.ID : ui.phrase("new")) + (active ? " · " + ui.role(index + 2) : "");
            draw.DrawText(text, "DermaDefault", screen.x, screen.y, active ? palette.Text : palette.Muted, TEXT_ALIGN_LEFT);
        });
    }
}
