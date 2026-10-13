type ZPClassMenuKind = "human" | "zombie";
interface ZPClassMenuEntry {
    readonly ID: string;
    readonly Kind: ZPClassMenuKind;
    readonly Name: string;
    readonly Description: string;
    readonly Order: number;
    readonly Health: number;
    readonly Armor: number;
    readonly Speed: number;
    readonly RunSpeed: number;
    readonly Gravity: number;
    readonly Jump: number;
    readonly Damage: number;
    readonly Ability: number;
    readonly CrouchSpeed: number;
    readonly Battery: number;
    readonly Breath: number;
    readonly Scale: number;
    readonly Footstep: boolean;
    readonly FallDamage: boolean;
    readonly AbilityCost: number;
    readonly AbilityOnActivation: boolean;
}
interface ZPClassMenuSnapshot {
    readonly Entries: readonly ZPClassMenuEntry[];
    readonly Selected: Readonly<Record<ZPClassMenuKind, string>>;
    readonly First: Readonly<Record<ZPClassMenuKind, boolean>>;
}
interface ZPClassMenuRequest {
    readonly Version: 1;
    readonly RequestID: number;
    readonly Kind: ZPClassMenuKind;
    readonly ID: string;
}
type ZPClassMenuReplyCode = "catalog" | "applied" | "saved" | "invalid" | "rate_limited";
interface ZPClassMenuReply {
    readonly Version: 1;
    readonly RequestID: number;
    readonly Code: ZPClassMenuReplyCode;
    readonly Snapshot?: ZPClassMenuSnapshot;
}
interface ZPClassMenuProtocol {
    Kind(this: void, value: unknown): value is ZPClassMenuKind;
    RequestID(this: void, value: unknown): value is number;
    Selection(this: void, value: unknown): ZPClassMenuRequest | undefined;
    Reply(this: void, value: unknown): ZPClassMenuReply | undefined;
}
declare const ZPClassMenuProtocol: ZPClassMenuProtocol;
interface ZPGlobals { ZPClassMenuProtocol: ZPClassMenuProtocol; }
