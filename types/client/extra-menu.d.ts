interface ZPExtraMenuState {
    readonly Open: boolean;
    readonly Kind: ZPExtraMenuSnapshot["Team"];
    readonly Pending: boolean;
    readonly Feedback: string;
    readonly Snapshot?: ZPExtraMenuSnapshot;
}
interface ZPExtraMenuController {
    GetState(this: ZPExtraMenuController): ZPExtraMenuState;
    Open(this: ZPExtraMenuController): void;
    Close(this: ZPExtraMenuController): void;
    Rebuild(this: ZPExtraMenuController): void;
    SetKind(this: ZPExtraMenuController, kind: ZPExtraMenuKind): void;
    Buy(this: ZPExtraMenuController, id: string): void;
    Refresh(this: ZPExtraMenuController): void;
}
interface ZPExtraMenuPresentation {
    Open(this: ZPExtraMenuPresentation, state: ZPExtraMenuState, actions: ZPExtraMenuController): void;
    Update(this: ZPExtraMenuPresentation, state: ZPExtraMenuState): void;
    Destroy(this: ZPExtraMenuPresentation): void;
}
type ZPExtraMenuPresentationFactory = (this: void) => ZPExtraMenuPresentation;
declare const ZPExtraMenu: ZPExtraMenuController;
declare function ZPCreateExtraMenuHUD(this: void, palette: ZPThemePalette, square: boolean): ZPExtraMenuPresentation;
interface ZPGlobals { ZPExtraMenu?: ZPExtraMenuController; ZPCreateExtraMenuHUD: typeof ZPCreateExtraMenuHUD; }
