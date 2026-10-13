type ZPExtraMenuKind = "human" | "zombie";
type ZPExtraMenuAvailability = "available" | "wrong_team" | "not_alive" | "restricted" | "insufficient";
interface ZPExtraMenuEntry {
    readonly ID: string;
    readonly Kind: ZPExtraMenuKind;
    readonly Name: string;
    readonly Price: number;
    readonly Order: number;
    readonly Availability: ZPExtraMenuAvailability;
}
interface ZPExtraMenuSnapshot {
    readonly Entries: readonly ZPExtraMenuEntry[];
    readonly Balance: number;
    readonly Team: ZPExtraMenuKind | "spectator";
    readonly Alive: boolean;
    readonly Truncated: boolean;
}
interface ZPExtraMenuRequest {
    readonly Version: 1;
    readonly RequestID: number;
    readonly Kind: ZPExtraMenuKind;
    readonly ID: string;
}
type ZPExtraItemPurchaseCode = "bought" | "invalid_item" | "restricted" | "insufficient";
type ZPExtraMenuReplyCode = "catalog" | ZPExtraItemPurchaseCode | "rate_limited";
interface ZPExtraMenuReply {
    readonly Version: 1;
    readonly RequestID: number;
    readonly Code: ZPExtraMenuReplyCode;
    readonly Snapshot?: ZPExtraMenuSnapshot;
}
interface ZPExtraMenuProtocol {
    Kind(this: void, value: unknown): value is ZPExtraMenuKind;
    Amount(this: void, value: unknown): value is number;
    RequestID(this: void, value: unknown): value is number;
    Purchase(this: void, value: unknown): ZPExtraMenuRequest | undefined;
    Reply(this: void, value: unknown): ZPExtraMenuReply | undefined;
}
declare const ZPExtraMenuProtocol: ZPExtraMenuProtocol;
interface ZPGlobals { ZPExtraMenuProtocol: ZPExtraMenuProtocol; }
