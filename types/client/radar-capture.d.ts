interface GLuaBrushSurface {
    GetVertices(this: GLuaBrushSurface): GLuaVector[];
    IsSky(this: GLuaBrushSurface): boolean;
    IsNoDraw(this: GLuaBrushSurface): boolean;
}
interface GLuaConVar { GetString(this: GLuaConVar): string; }
interface GLuaMapFile { ReadFloat(this: GLuaMapFile): number; }
interface ZPRadarCaptureBounds { MinX: number; MaxX: number; MinY: number; MaxY: number; }
interface ZPRadarCaptureHeightRange { MinZ: number; MaxZ: number; }
interface ZPRadarCaptureSample { x: number; y: number; z: number; area: number; }
interface ZPRadarCaptureAnalysisDiagnostics {
    Surfaces: number; Processed: number; Candidates: number; FloorHits: number; ClearSamples: number;
    SkyboxSamples: number; SkyboxFilter: boolean;
}
interface ZPRadarCapturePlanDiagnostics {
    Code?: string; Samples?: number; HeightCount?: number; Heights?: number[];
    CandidateHeightCount?: number; ExcludedSamples?: number; HeightRange?: ZPRadarCaptureHeightRange;
}
interface ZPRadarCapturePlan {
    Map: string; Overview: ZPRadarOverview; Heights: number[]; Cuts: number[];
}
interface ZPRadarCaptureOptions {
    Heights?: number[]; Cuts?: number[]; Bounds?: ZPRadarCaptureBounds; HeightRange?: ZPRadarCaptureHeightRange;
}
interface ZPRadarCaptureManager {
    Start(this: ZPRadarCaptureManager): void;
    Cancel(this: ZPRadarCaptureManager): void;
}
interface ZPRadarCaptureTrace {
    start: GLuaVector; endpos: GLuaVector; mask: number; filter: ZPClientPlayer;
    mins?: GLuaVector; maxs?: GLuaVector;
}
interface ZPRadarCaptureHit { Hit: boolean; StartSolid: boolean; HitSky: boolean; HitPos: GLuaVector; HitNormal: GLuaVector; }
interface ZPRadarNativeView {
    origin: GLuaVector; angles: GLuaAngle; width: number; height: number;
    ortho?: { left: number; right: number; top: number; bottom: number };
}
interface ZPRadarRenderView {
    origin: GLuaVector; angles: GLuaAngle; x: number; y: number; w: number; h: number;
    ortho: { left: number; right: number; top: number; bottom: number };
    znear: number; zfar: number; drawhud: boolean; drawviewmodel: boolean; drawviewer: boolean;
}
/** @noSelf */
declare namespace util {
    function TraceLine(options: ZPRadarCaptureTrace): ZPRadarCaptureHit;
    function TraceHull(options: ZPRadarCaptureTrace): ZPRadarCaptureHit;
}
declare const MASK_PLAYERSOLID: number;
/** @noSelf */
declare namespace render {
    function GetViewSetup(noPlayer: boolean): ZPRadarNativeView;
    function RenderView(view: ZPRadarRenderView): void;
    function Capture(options: { format: "png"; x: number; y: number; w: number; h: number; alpha: false }): string | undefined;
    function EnableClipping(enabled: boolean): boolean;
    function PushCustomClipPlane(normal: GLuaVector, distance: number): void;
    function PopCustomClipPlane(): void;
    function Clear(r: number, g: number, b: number, a: number, depth: boolean, stencil: boolean): void;
}
/** @noSelf */
declare namespace file {
    function Write(path: string, value: string): boolean;
    function Read(path: string, realm: "GAME"): string | undefined;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "ZPResetRadarCapture", id: string, callback: (this: void) => void): void;
    function Run(name: "ZPResetRadarCapture"): void;
    function Add(name: "ZPRadarCaptureLighting", id: string, callback: (this: void) => boolean | undefined): void;
    function Add(name: "PrePlayerDraw", id: string, callback: (this: void, ply: ZPClientPlayer) => boolean | undefined): void;
    function Add(name: "PreDrawSkyBox" | "PreDraw2DSkyBox", id: string, callback: (this: void) => boolean | undefined): void;
}
/** @noSelf */
declare namespace string { function gmatch(text: string, pattern: "%S+"): LuaIterable<string>; }
