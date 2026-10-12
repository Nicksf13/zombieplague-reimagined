interface ZPThemePalette {
    readonly Accent: GLuaColor;
    readonly Surface: GLuaColor;
    readonly Panel: GLuaColor;
    readonly Text: GLuaColor;
    readonly Muted: GLuaColor;
}
interface ZPPlayerHUDEntry {
    readonly ID: string;
    readonly Label: string;
    readonly Value: string | number;
}
interface ZPPlayerHUDAmmoChannel {
    readonly Clip: number;
    readonly Reserve: number;
}
interface ZPPlayerHUDAmmo {
    readonly Primary?: ZPPlayerHUDAmmoChannel;
    readonly Secondary?: ZPPlayerHUDAmmoChannel;
}
interface ZPPlayerHUDState {
    readonly Width: number;
    readonly Height: number;
    readonly Timer: string;
    readonly Spectating: boolean;
    readonly Entries: readonly ZPPlayerHUDEntry[];
    readonly Ammo?: ZPPlayerHUDAmmo;
}
interface ZPThemeDefinition {
    readonly Name: string;
    readonly Palette: ZPThemePalette;
    readonly CreateWeaponMenu: ZPWeaponMenuPresentationFactory;
    readonly CreateMainMenu?: ZPMainMenuPresentationFactory;
    readonly CreateScoreboard?: ZPScoreboardPresentationFactory;
    readonly PaintPlayerHUD: (this: void, state: ZPPlayerHUDState, palette: ZPThemePalette) => void;
}
interface ZPThemeManager {
    RegisterTheme(this: ZPThemeManager, id: string, theme: ZPThemeDefinition): void;
    UseTheme(this: ZPThemeManager, id: string): boolean;
    GetActiveID(this: ZPThemeManager): string;
    GetTheme(this: ZPThemeManager): ZPThemeDefinition | undefined;
    GetThemes(this: ZPThemeManager): { ID: string; Name: string; }[];
}
interface ZPPlayerHUDRenderer {
    PaintClassic(this: ZPPlayerHUDRenderer, state: ZPPlayerHUDState, palette: ZPThemePalette): void;
    PaintHL2(this: ZPPlayerHUDRenderer, state: ZPPlayerHUDState, palette: ZPThemePalette): void;
    PaintCS16(this: ZPPlayerHUDRenderer, state: ZPPlayerHUDState, palette: ZPThemePalette): void;
}
interface ZPPlayerHUDController {
    GetState(this: ZPPlayerHUDController): ZPPlayerHUDState;
    Paint(this: ZPPlayerHUDController): void;
    ShouldHide(this: ZPPlayerHUDController, name: string): boolean | undefined;
}
declare const ZPThemes: ZPThemeManager;
declare const ZPPlayerHUDRenderer: ZPPlayerHUDRenderer;
declare const ZPPlayerHUD: ZPPlayerHUDController;
interface ZPGlobals {
    ZPThemes: ZPThemeManager;
    ZPPlayerHUDRenderer: ZPPlayerHUDRenderer;
    ZPPlayerHUD: ZPPlayerHUDController;
}
interface ZPClientHUDWeapon {
    Clip1(this: ZPClientHUDWeapon): number;
    Clip2(this: ZPClientHUDWeapon): number;
    GetPrimaryAmmoType(this: ZPClientHUDWeapon): number;
    GetSecondaryAmmoType(this: ZPClientHUDWeapon): number;
}
/** @noSelf */
declare namespace concommand {
    function Add(name: string, callback: (this: void, ply: ZPClientPlayer, command: string, args: string[], argumentString: string) => void): void;
}
interface ZPClientPlayer {
    IsPlayer(this: ZPClientPlayer): boolean;
    GetActiveWeapon(this: ZPClientPlayer): ZPClientHUDWeapon;
    GetAmmoCount(this: ZPClientPlayer, ammo: number): number;
}
