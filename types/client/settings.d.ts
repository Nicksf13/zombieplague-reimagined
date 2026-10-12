interface ZPSettingsState {
    readonly Open: boolean;
    readonly Theme: string;
    readonly Themes: readonly { readonly ID: string; readonly Name: string; }[];
    readonly AlwaysRun: boolean;
}
interface ZPSettingsActions {
    UseTheme(this: ZPSettingsActions, id: string): void;
    SetAlwaysRun(this: ZPSettingsActions, enabled: boolean): void;
    Close(this: ZPSettingsActions): void;
    Back(this: ZPSettingsActions): void;
}
interface ZPSettingsPresentation {
    Open(this: ZPSettingsPresentation, state: ZPSettingsState, actions: ZPSettingsActions): void;
    Update(this: ZPSettingsPresentation, state: ZPSettingsState): void;
    Destroy(this: ZPSettingsPresentation): void;
}
type ZPSettingsPresentationFactory = (this: void) => ZPSettingsPresentation;
interface ZPSettingsController extends ZPSettingsActions {
    GetState(this: ZPSettingsController): ZPSettingsState;
    Open(this: ZPSettingsController): void;
    Rebuild(this: ZPSettingsController): void;
}
interface ZPClientPreference {
    GetBool(this: ZPClientPreference): boolean;
    SetBool(this: ZPClientPreference, enabled: boolean): void;
}
declare function CreateClientConVar(this: void, name: string, value: string, archive: boolean,
    userinfo: boolean, help: string): ZPClientPreference;
interface ZPClientUserCommand { AddKey(this: ZPClientUserCommand, button: number): void; }
declare const IN_SPEED: number;
/** @noSelf */
declare namespace hook {
    function Add(name: "CreateMove", id: string, callback: (this: void, command: ZPClientUserCommand) => void): void;
}
declare const ZPSettings: ZPSettingsController;
declare function ZPCreateSettingsHUD(this: void, palette: ZPThemePalette, square: boolean): ZPSettingsPresentation;
interface ZPGlobals {
    ZPSettings: ZPSettingsController;
    ZPCreateSettingsHUD: typeof ZPCreateSettingsHUD;
}
