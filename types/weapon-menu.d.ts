// Wire data has no Player, weapon instance, callback or presentation information.
type ZPWeaponMenuCategory = "primary" | "secondary" | "melee";
interface ZPWeaponMenuEntry {
    readonly ID: string;
    readonly Name: string;
    readonly Kind: ZPWeaponMenuCategory;
    readonly Order: number;
}
interface ZPWeaponMenuSnapshot {
    readonly Entries: readonly ZPWeaponMenuEntry[];
    readonly Selected: Readonly<Record<ZPWeaponMenuCategory, string>>;
    readonly CanReceive: Readonly<Record<ZPWeaponMenuCategory, boolean>>;
    readonly Truncated: boolean;
}
interface ZPWeaponMenuRequest {
    readonly Version: 1;
    readonly RequestID: number;
    readonly Kind: ZPWeaponMenuCategory;
    readonly ID: string;
}
type ZPWeaponMenuReplyCode = "catalog" | "saved" | "issued" | "invalid_weapon" | "rate_limited";
interface ZPWeaponMenuReply {
    readonly Version: 1;
    readonly RequestID: number;
    readonly Code: ZPWeaponMenuReplyCode;
    readonly Snapshot?: ZPWeaponMenuSnapshot;
}
interface ZPWeaponMenuProtocol {
    Category(this: void, value: unknown): value is ZPWeaponMenuCategory;
    RequestID(this: void, value: unknown): value is number;
    Selection(this: void, value: unknown): ZPWeaponMenuRequest | undefined;
    Reply(this: void, value: unknown): ZPWeaponMenuReply | undefined;
}
declare const ZPWeaponMenuProtocol: ZPWeaponMenuProtocol;
interface ZPGlobals { ZPWeaponMenuProtocol: ZPWeaponMenuProtocol; }
