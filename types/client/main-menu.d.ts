interface ZPMainMenuEntry {
    readonly ID: string;
    readonly Label: string;
    readonly Description: string;
}
interface ZPMainMenuOption extends ZPMainMenuEntry {
    readonly Action: ZPAction;
    readonly IsVisible?: (this: void) => boolean;
}
interface ZPMainMenuState {
    readonly Open: boolean;
    readonly Theme: string;
    readonly Entries: readonly ZPMainMenuEntry[];
}
interface ZPMainMenuActions {
    Activate(this: ZPMainMenuActions, id: string): void;
    Close(this: ZPMainMenuActions): void;
}
interface ZPMainMenuPresentation {
    Open(this: ZPMainMenuPresentation, state: ZPMainMenuState, actions: ZPMainMenuActions): void;
    Update(this: ZPMainMenuPresentation, state: ZPMainMenuState): void;
    Destroy(this: ZPMainMenuPresentation): void;
}
type ZPMainMenuPresentationFactory = (this: void) => ZPMainMenuPresentation;
interface ZPMainMenuController extends ZPMainMenuActions {
    RegisterOption(this: ZPMainMenuController, option: ZPMainMenuOption): void;
    GetState(this: ZPMainMenuController): ZPMainMenuState;
    Open(this: ZPMainMenuController): void;
    Toggle(this: ZPMainMenuController): void;
    Rebuild(this: ZPMainMenuController): void;
}
declare const ZPMainMenu: ZPMainMenuController;
declare function ZPCreateMainMenuHUD(this: void, palette: ZPThemePalette, square: boolean): ZPMainMenuPresentation;
interface ZPGlobals {
    ZPMainMenu: ZPMainMenuController;
    ZPCreateMainMenuHUD: typeof ZPCreateMainMenuHUD;
}
