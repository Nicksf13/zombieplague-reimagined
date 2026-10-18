type ZPBotPlaceState = "patrol" | "shelter" | "guard" | "hunt" | "inspect";
type ZPBotPlaceReason = "profile" | "learned" | "clue";
interface ZPBotPlaceTotals { Visits: number; Finds: number; Escapes: number; Deaths: number; Empty: number; Damage: number; Seconds: number; }
interface ZPBotPlaceRecord extends ZPBotPlaceTotals { Value: number; Samples: number; }
interface ZPBotPlaceMemory { Records: Record<string, ZPBotPlaceRecord | undefined>; Totals: ZPBotPlaceTotals; }
interface ZPBotPlaceDiagnostic extends ZPBotPlaceTotals {
    State: ZPBotPlaceState; Reason: ZPBotPlaceReason; Point: number[]; Value: number; Hold: number;
}
interface ZPBotPlaceProtocol {
    Empty(this: void): ZPBotPlaceMemory;
    Memory(this: void, value: unknown): ZPBotPlaceMemory | undefined;
    Diagnostic(this: void, value: unknown): ZPBotPlaceDiagnostic | undefined;
}
declare const ZPBotPlaceProtocol: ZPBotPlaceProtocol;
interface ZPGlobals { ZPBotPlaceProtocol: ZPBotPlaceProtocol; }
