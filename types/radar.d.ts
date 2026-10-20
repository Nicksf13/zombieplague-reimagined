interface ZPRadarPosition { readonly x: number; readonly y: number; readonly z: number; }
interface ZPRadarLayer {
    readonly Material: string;
    readonly MinZ: number;
    readonly MaxZ: number;
}
interface ZPRadarOverview {
    readonly Material: string;
    readonly X: number;
    readonly Y: number;
    readonly Scale: number;
    readonly Size: number;
    readonly Layers?: readonly ZPRadarLayer[];
}
type ZPRadarSpecialRole = "nemesis" | "survivor";
interface ZPRadarContact {
    readonly Role?: ZPRadarSpecialRole;
    readonly Special?: boolean;
    readonly ID: number;
    readonly Position: ZPRadarPosition;
    readonly Source: "attack" | "scan" | "ally";
    readonly Created: number;
    readonly Expires: number;
}
interface ZPRadarSnapshot {
    readonly Version: 1;
    readonly Team: number;
    readonly Enabled: boolean;
    readonly ScanUntil: number;
    readonly Contacts: readonly ZPRadarContact[];
}
interface ZPRadarRulesContract {
    readonly MaxLayers: number;
    Record(this: void, value: unknown): Record<string, unknown> | undefined;
    Finite(this: void, value: unknown, min: number, max: number): value is number;
    Overview(this: void, value: unknown): ZPRadarOverview | undefined;
    Snapshot(this: void, value: unknown, now: number): ZPRadarSnapshot | undefined;
    Lifetime(this: void, distance: number, range: number, minimum: number, maximum: number): number | undefined;
    Point(this: void, overview: ZPRadarOverview, position: ZPRadarPosition): { x: number; y: number };
    Layer(this: void, overview: ZPRadarOverview, height: number, previous?: number): number | undefined;
    Elevation(this: void, layer: ZPRadarLayer | undefined, height: number, viewerHeight?: number): -1 | 0 | 1;
}
declare const ZPRadarRules: ZPRadarRulesContract;
interface ZPGlobals { ZPRadarRules: ZPRadarRulesContract; }
/** @noSelf */
declare namespace util { function KeyValuesToTable(text: string): unknown; }
