export {};
const record = (value: unknown): Record<string, unknown> | undefined => typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
const integer = (value: unknown, max = 2147483647): value is number => typeof value === "number" && value >= 0 && value <= max && value % 1 === 0;
function points(value: unknown): ZPBotSafePoint[] | undefined {
    const data = record(value); if (!data || Object.keys(data).length > 32) return;
    const result: ZPBotSafePoint[] = [];
    for (let index = 1; index <= Object.keys(data).length; index++) {
        const point = record(data[index]), position = record(point?.Position);
        if (!point || !integer(point.ID, 65535) || point.ID < 1 || !["human", "zombie", "both"].some(role => role === point.Role) ||
            !position || Object.keys(position).length !== 3 || result.some(other => other.ID === point.ID)) return;
        const coordinates: number[] = [];
        for (let axis = 1; axis <= 3; axis++) {
            const coordinate = position[axis];
            if (typeof coordinate !== "number" || !(coordinate >= -32768 && coordinate <= 32768)) return;
            coordinates.push(coordinate);
        }
        result.push({ ID: point.ID, Role: point.Role as ZPBotSafeRole, Position: coordinates });
    }
    return result;
}
function snapshot(value: unknown): ZPBotSafeSnapshot | undefined {
    const data = record(value), list = points(data?.Points);
    if (!data || !list || typeof data.Equipped !== "boolean" || !integer(data.Request) || data.Request < 1 || !integer(data.Revision) || data.Revision < 1 ||
        !["ready", "saved", "invalid", "capacity", "error", "stale"].some(code => code === data.Feedback)) return;
    return { Request: data.Request, Revision: data.Revision, Points: list, Feedback: data.Feedback as ZPBotSafeFeedback, Equipped: data.Equipped };
}
_G.ZPBotSafeProtocol = { Points: points, Snapshot: snapshot };
