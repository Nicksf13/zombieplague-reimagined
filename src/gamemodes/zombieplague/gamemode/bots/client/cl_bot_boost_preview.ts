const rules = include("sh_bot_boost_rules.lua") as typeof import("../shared/sh_bot_boost_rules");
export const color = (slot: number): GLuaColor => slot === 2 ? Color(80, 160, 255) : slot === 3 ? Color(255, 210, 64) : Color(95, 220, 120);
export function capture(draft?: ZPBotBoostPoint, slot = 2): { Position: GLuaVector; Valid: boolean; Hit: boolean; Issue: ZPBotBoostIssue | undefined } {
    const ply = LocalPlayer(), trace = ply.GetEyeTrace(), point = trace.HitPos, eye = ply.EyePos();
    const distance = (point.x - eye.x) ** 2 + (point.y - eye.y) ** 2 + (point.z - eye.z) ** 2;
    const valid = trace.Hit && !trace.HitSky && trace.HitNormal !== undefined && trace.HitNormal.z >= 0.7 && ["worldspawn", "prop_static"].includes(trace.Entity.GetClass());
    const candidate = rules.copy(draft ?? rules.empty()), position = [point.x, point.y, point.z];
    if (slot === 2) candidate.Base = position; else if (slot === 3) candidate.Approach = position; else candidate.Exit = position;
    const issue = !valid ? rules.issue("surface", slot) : distance > 4096 ** 2 ? rules.issue("range", slot, Math.sqrt(distance), 0, 4096) : rules.dimensions(candidate);
    return { Position: point, Hit: trace.Hit, Valid: valid && distance <= 4096 ** 2, Issue: issue };
}
export function paint(snapshot: ZPBotBoostSnapshot | undefined, selected: number, slot: number, palette: ZPThemePalette): void {
    const target = capture(snapshot?.Draft, slot); if (!target.Hit) return;
    const tint = target.Issue ? Color(240, 80, 80) : color(slot), position = target.Position;
    // Crouched support and standing approach/destination make the occupied footprint visible.
    const top = slot === 2 ? 36 : 72;
    const corners: GLuaVector[] = [];
    for (const height of [2, top]) for (const [x, y] of [[-16, -16], [16, -16], [16, 16], [-16, 16]] as const)
        corners.push(Vector(position.x + x, position.y + y, position.z + height));
    for (const [from, to] of [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]] as const) {
        const start = corners[from], end = corners[to]; if (start && end) render.DrawLine(start, end, tint, true);
    }
    render.DrawWireframeSphere(Vector(position.x, position.y, position.z + 4), 8, 12, 8, tint, true);
    const draft = snapshot?.Draft, saved = snapshot?.Points.find(point => point.ID === selected);
    const data = draft && [draft.Base, draft.Approach, draft.Exit].some(point => point.length === 3) ? draft : saved;
    if (!data) return;
    const candidate = [position.x, position.y, position.z];
    const base = slot === 2 ? candidate : data.Base, approach = slot === 3 ? candidate : data.Approach, exit = slot === 4 ? candidate : data.Exit;
    for (const [from, to] of [[approach, base], [base, exit]]) {
        if (!from || !to || from.length !== 3 || to.length !== 3) continue;
        render.DrawLine(Vector(from[0] ?? 0, from[1] ?? 0, (from[2] ?? 0) + 4), Vector(to[0] ?? 0, to[1] ?? 0, (to[2] ?? 0) + 4), palette.Accent, true);
    }
}
