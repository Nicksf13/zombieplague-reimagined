interface ZPSpectatorContact {
    readonly ID: number;
    readonly Name: string;
    readonly Team: number;
    readonly Position: ZPRadarPosition;
    readonly Yaw: number;
    readonly Role?: ZPRadarSpecialRole;
}
interface ZPSpectatorSnapshot {
    readonly Version: 1;
    readonly Team: number;
    readonly Restricted: boolean;
    readonly Active: boolean;
    readonly Contacts: readonly ZPSpectatorContact[];
}
interface ZPSpectatorProtocolContract {
    Snapshot(this: void, value: unknown): ZPSpectatorSnapshot | undefined;
}
declare const ZPSpectatorProtocol: ZPSpectatorProtocolContract;
interface ZPGlobals { ZPSpectatorProtocol: ZPSpectatorProtocolContract; }
