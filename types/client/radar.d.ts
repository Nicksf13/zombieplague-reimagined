interface ZPRadarClient {
    IsVisible(this: ZPRadarClient): boolean;
    SetVisible(this: ZPRadarClient, visible: boolean): void;
    Paint(this: ZPRadarClient): void;
}
declare const ZPRadar: ZPRadarClient;
interface ZPGlobals { ZPRadar: ZPRadarClient; }
declare function Material(this: void, path: string, parameters: string): GLuaMaterial;
interface ZPClientPlayer {
    OnGround(this: ZPClientPlayer): boolean;
    WaterLevel(this: ZPClientPlayer): number;
    GetMoveType(this: ZPClientPlayer): number;
}
declare const MOVETYPE_LADDER: number, MOVETYPE_NOCLIP: number;
