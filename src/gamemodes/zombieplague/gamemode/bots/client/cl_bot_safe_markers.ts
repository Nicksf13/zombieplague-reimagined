const { phrase } = include("cl_bot_safe_hud.lua") as typeof import("./cl_bot_safe_hud");
const vector = (point: ZPBotSafePoint, height = 4): GLuaVector => Vector(point.Position[0] ?? 0, point.Position[1] ?? 0, (point.Position[2] ?? 0) + height);
export function pick(points: ZPBotSafePoint[]): number {
    let id = 0, distance = 28 ** 2;
    for (const point of points) {
        const base = vector(point).ToScreen(), top = vector(point, 52).ToScreen();
        if (!base.visible && !top.visible) continue;
        const start = base.visible ? base : top, end = top.visible ? top : start;
        // Match the rendered sphere and stem, including their perspective at close range.
        const dx = end.x - start.x, dy = end.y - start.y, length = dx * dx + dy * dy;
        const along = length > 0 ? Math.max(0, Math.min(1, ((ScrW() / 2 - start.x) * dx + (ScrH() / 2 - start.y) * dy) / length)) : 0;
        const candidate = (start.x + dx * along - ScrW() / 2) ** 2 + (start.y + dy * along - ScrH() / 2) ** 2;
        if (candidate < distance || (candidate === distance && (id === 0 || point.ID < id))) { id = point.ID; distance = candidate; }
    }
    return id;
}
export function markers(points: ZPBotSafePoint[], selected: number, hovered: number, palette: ZPThemePalette): void {
    for (const point of points) {
        const position = vector(point), active = point.ID === selected || point.ID === hovered;
        const color = active ? palette.Accent : palette.Muted;
        render.DrawWireframeSphere(position, active ? 14 : 8, 12, 8, color, false);
        render.DrawLine(position, vector(point, 52), color, false);
        for (const axis of [-1, 1]) render.DrawLine(Vector(position.x - 16, position.y + axis * 16, position.z),
            Vector(position.x + 16, position.y + axis * 16, position.z), color, false);
    }
}
export function labels(points: ZPBotSafePoint[], selected: number, hovered: number, palette: ZPThemePalette): void {
    const origin = LocalPlayer().EyePos();
    for (const point of points) {
        const position = vector(point, 20), screen = position.ToScreen(); if (!screen.visible) continue;
        const distance = Math.sqrt((origin.x - position.x) ** 2 + (origin.y - position.y) ** 2 + (origin.z - position.z) ** 2);
        draw.DrawText(string.format(phrase("point"), point.ID, phrase(point.Role), distance), "DermaDefault", screen.x, screen.y,
            point.ID === selected || point.ID === hovered ? palette.Accent : palette.Text, TEXT_ALIGN_LEFT);
    }
}
export function preview(palette: ZPThemePalette): void {
    const trace = LocalPlayer().GetEyeTrace();
    if (!trace.Hit || trace.HitSky || !trace.HitNormal || trace.HitNormal.z < 0.7) return;
    // The server independently validates navmesh, floor, distance and hull clearance.
    render.DrawWireframeSphere(Vector(trace.HitPos.x, trace.HitPos.y, trace.HitPos.z + 4), 16, 12, 8, palette.Accent, true);
}
