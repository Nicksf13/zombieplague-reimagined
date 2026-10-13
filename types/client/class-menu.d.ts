interface ZPClassMenuState {
    readonly Open: boolean;
    readonly Automatic: boolean;
    readonly Kind: ZPClassMenuKind;
    readonly Preview: string;
    readonly Pending: boolean;
    readonly Feedback: string;
    readonly Snapshot?: ZPClassMenuSnapshot;
}
interface ZPClassMenuController {
    Open(this: ZPClassMenuController, kind?: ZPClassMenuKind, automatic?: boolean): void;
    Close(this: ZPClassMenuController): void;
    Rebuild(this: ZPClassMenuController): void;
    SetKind(this: ZPClassMenuController, kind: ZPClassMenuKind): void;
    Preview(this: ZPClassMenuController, id: string): void;
    Select(this: ZPClassMenuController, id: string): void;
    Confirm(this: ZPClassMenuController): void;
    Refresh(this: ZPClassMenuController): void;
    GetState(this: ZPClassMenuController): ZPClassMenuState;
}
interface ZPClassMenuPresentation {
    Open(this: ZPClassMenuPresentation, state: ZPClassMenuState, actions: ZPClassMenuController): void;
    Update(this: ZPClassMenuPresentation, state: ZPClassMenuState): void;
    Destroy(this: ZPClassMenuPresentation): void;
}
type ZPClassMenuPresentationFactory = (this: void) => ZPClassMenuPresentation;
declare const ZPClassMenu: ZPClassMenuController;
declare function ZPCreateClassMenuHUD(this: void, palette: ZPThemePalette, square: boolean): ZPClassMenuPresentation;
interface ZPGlobals {
    ZPClassMenu?: ZPClassMenuController;
    ZPCreateClassMenuHUD: typeof ZPCreateClassMenuHUD;
}
