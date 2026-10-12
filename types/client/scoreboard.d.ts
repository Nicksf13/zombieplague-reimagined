interface ZPGameMode { ScoreboardShow(this: ZPGameMode): void; ScoreboardHide(this: ZPGameMode): void; }
interface ZPClientPlayer {
    Deaths(this: ZPClientPlayer): number; Ping(this: ZPClientPlayer): number;
    IsMuted(this: ZPClientPlayer): boolean; SetMuted(this: ZPClientPlayer, muted: boolean): void;
    UserID(this: ZPClientPlayer): number;
    IsBot(this: ZPClientPlayer): boolean;
    ShowProfile(this: ZPClientPlayer): void;
}
interface ZPScoreboardDropdown extends GLuaPanel {
    AddOption(this: ZPScoreboardDropdown, label: string, action: ZPAction): GLuaPanel;
    Open(this: ZPScoreboardDropdown): void;
}
declare function DermaMenu(this: void): ZPScoreboardDropdown;
interface GLuaPanel {
    SetEnabled(this: GLuaPanel, enabled: boolean): void;
    SetImage(this: GLuaPanel, path: string): void;
    SetDraggable(this: GLuaPanel, value: boolean): void;
    SetDeleteOnClose(this: GLuaPanel, value: boolean): void;
    ShowCloseButton(this: GLuaPanel, value: boolean): void;
    SetTitle(this: GLuaPanel, text: string): void;
    Center(this: GLuaPanel): void;
    Paint?(this: GLuaPanel, width: number, height: number): void;
    DoClick?(this: GLuaPanel): void;
    Clear(this: GLuaPanel): void;
    Close(this: GLuaPanel): void;
    Add(this: GLuaPanel, item: string | GLuaPanel): GLuaPanel;
    MakePopup(this: GLuaPanel): void;
    GetSize(this: GLuaPanel): LuaMultiReturn<[number, number]>;
}
/** @noSelf */
declare namespace team { function GetColor(id: number): GLuaColor; }
/** @noSelf */
declare namespace player { function GetAll(): ZPClientPlayer[]; }
/** @noSelf */
declare namespace timer { function Create(id: string, delay: number, repeats: number, action: ZPAction): void; function Destroy(id: string): void; }
declare function tostring(this: void, value: unknown): string;

interface ZPScoreboardPlayer {
    readonly ID: number;
    readonly Name: string;
    readonly Points: number;
    readonly Deaths: number;
    readonly Ping: number;
    readonly Status: "alive" | "dead" | "spectating";
    readonly Local: boolean;
    readonly CanMute: boolean;
    readonly Muted: boolean;
    readonly CanViewProfile: boolean;
}
interface ZPScoreboardTeam {
    readonly ID: number;
    readonly Label: string;
    readonly Players: readonly ZPScoreboardPlayer[];
}
interface ZPScoreboardState {
    readonly Open: boolean;
    readonly Theme: string;
    readonly Width: number;
    readonly Height: number;
    readonly Teams: readonly ZPScoreboardTeam[];
}
interface ZPScoreboardActions {
    ToggleMute(this: ZPScoreboardActions, id: number): void;
    ViewProfile(this: ZPScoreboardActions, id: number): void;
}
interface ZPScoreboardPresentation {
    Open(this: ZPScoreboardPresentation, state: ZPScoreboardState, actions: ZPScoreboardActions): void;
    Update(this: ZPScoreboardPresentation, state: ZPScoreboardState): void;
    Destroy(this: ZPScoreboardPresentation): void;
}
type ZPScoreboardPresentationFactory = (this: void) => ZPScoreboardPresentation;
type ZPScoreboardStyle = "classic" | "hl2" | "cs16";
interface ZPScoreboardController extends ZPScoreboardActions {
    GetState(this: ZPScoreboardController): ZPScoreboardState;
    Show(this: ZPScoreboardController): void;
    Hide(this: ZPScoreboardController): void;
    Rebuild(this: ZPScoreboardController): void;
    Refresh(this: ZPScoreboardController): void;
}
declare const ZPScoreboard: ZPScoreboardController;
declare function ZPCreateScoreboardHUD(this: void, palette: ZPThemePalette, style: ZPScoreboardStyle): ZPScoreboardPresentation;
interface ZPGlobals {
    ZPScoreboard: ZPScoreboardController;
    ZPCreateScoreboardHUD: typeof ZPCreateScoreboardHUD;
}
interface GLuaPanel { SetTooltip(this: GLuaPanel, text: string): void; }
