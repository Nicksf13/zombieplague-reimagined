type ZPBotSafeRole = "human" | "zombie" | "both";
interface ZPBotSafePoint { ID: number; Role: ZPBotSafeRole; Position: number[]; }
type ZPBotSafeFeedback = "ready" | "saved" | "invalid" | "capacity" | "error" | "stale";
interface ZPBotSafeSnapshot { Request: number; Revision: number; Points: ZPBotSafePoint[]; Feedback: ZPBotSafeFeedback; Equipped: boolean; }
interface ZPBotSafeProtocol {
    Points(this: void, value: unknown): ZPBotSafePoint[] | undefined;
    Snapshot(this: void, value: unknown): ZPBotSafeSnapshot | undefined;
}
declare const ZPBotSafeProtocol: ZPBotSafeProtocol;
interface ZPGlobals { ZPBotSafeProtocol: ZPBotSafeProtocol; }
