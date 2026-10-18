export const codes: ZPBotBoostIssueCode[] = ["surface", "floor", "range", "nav", "distance", "level", "rise", "reach", "incomplete", "stale", "selection", "capacity", "storage", "alive", "tool", "disabled", "round", "frozen", "bots", "busy", "path", "physics", "obstacle", "unsaved"];
export const issue = (Code: ZPBotBoostIssueCode, Slot = 0, Actual = 0, Min = 0, Max = 0): ZPBotBoostIssue => ({ Code, Slot, Actual, Min, Max });
export const empty = (): ZPBotBoostPoint => ({ ID: 0, Base: [], Approach: [], Exit: [] });
export const copy = (point: ZPBotBoostPoint): ZPBotBoostPoint => ({ ID: point.ID, Base: [...point.Base], Approach: [...point.Approach], Exit: [...point.Exit] });
export const positions = (point: ZPBotBoostPoint): number[][] => [point.Base, point.Approach, point.Exit];
export const complete = (point: ZPBotBoostPoint): boolean => positions(point).every(position => position.length === 3);
export function dimensions(point: ZPBotBoostPoint): ZPBotBoostIssue | undefined {
    const [bx, by, bz] = point.Base, [ax, ay, az] = point.Approach, [ex, ey, ez] = point.Exit;
    if (bx === undefined || by === undefined || bz === undefined) return;
    if (ax !== undefined && ay !== undefined && az !== undefined) {
        const distance = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2), level = Math.abs(az - bz);
        if (distance < 40 || distance > 128) return issue("distance", 3, distance, 40, 128);
        if (level > 18) return issue("level", 3, level, 0, 18);
    }
    if (ex !== undefined && ey !== undefined && ez !== undefined) {
        const rise = ez - bz, distance = Math.sqrt((ex - bx) ** 2 + (ey - by) ** 2);
        if (rise < 24 || rise > 192) return issue("rise", 4, rise, 24, 192);
        if (distance > 192) return issue("reach", 4, distance, 0, 192);
    }
}
