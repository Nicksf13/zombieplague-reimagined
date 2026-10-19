interface ZPSettingsState {
    readonly Open: boolean;
    readonly Theme: string;
    readonly Themes: readonly { readonly ID: string; readonly Name: string; }[];
    readonly AlwaysRun: boolean;
    readonly Bindings: readonly ZPKeyBinding[];
    readonly Capturing: string;
}
interface ZPSettingsActions {
    UseTheme(this: ZPSettingsActions, id: string): void;
    SetAlwaysRun(this: ZPSettingsActions, enabled: boolean): void;
    BeginBinding(this: ZPSettingsActions, id: string): void;
    CaptureKey(this: ZPSettingsActions, key: number): void;
    ResetBindings(this: ZPSettingsActions): void;
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
interface ZPClientUserCommand {
    AddKey(this: ZPClientUserCommand, button: number): void;
    RemoveKey(this: ZPClientUserCommand, button: number): void;
    GetForwardMove(this: ZPClientUserCommand): number; SetForwardMove(this: ZPClientUserCommand, value: number): void;
    GetSideMove(this: ZPClientUserCommand): number; SetSideMove(this: ZPClientUserCommand, value: number): void;
    GetUpMove(this: ZPClientUserCommand): number; SetUpMove(this: ZPClientUserCommand, value: number): void;
    SetImpulse(this: ZPClientUserCommand, value: number): void;
}
declare const IN_ATTACK: number, IN_ATTACK2: number, IN_JUMP: number, IN_DUCK: number, IN_USE: number,
    IN_WALK: number, IN_ZOOM: number, IN_FORWARD: number, IN_BACK: number, IN_MOVELEFT: number,
    IN_MOVERIGHT: number, IN_SCORE: number, IN_LEFT: number, IN_RIGHT: number;
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
