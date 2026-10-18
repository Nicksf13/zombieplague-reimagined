type ZPAdminPage = "admin" | "settings" | "environment" | "bots" | "botadd" | "population";
interface ZPBotPopulationState {
    readonly Snapshot?: ZPBotPopulationSnapshot;
    readonly Enabled: boolean;
    readonly Target: number;
    readonly Pending: boolean;
    readonly Dirty: boolean;
    readonly Feedback: string;
}
interface ZPAdminState {
    readonly Page: ZPAdminPage;
    readonly Values: readonly string[];
    readonly Pending: boolean;
    readonly Ready: boolean;
    readonly Dirty: boolean;
    readonly ReloadRequired: boolean;
    readonly CanReload: boolean;
    readonly Feedback: string;
    readonly CanAddBot: boolean;
    readonly BotCount: number;
    readonly BotMetrics?: ZPBotMetricsSnapshot;
    readonly BotMetricsLoading: boolean;
    readonly BotPopulation: ZPBotPopulationState;
}
interface ZPAdminActions {
    AddBot(this: ZPAdminActions): void;
    SetBotCount(this: ZPAdminActions, count: number): void;
    BotPage(this: ZPAdminActions, direction: number): void;
    ToggleBotPopulation(this: ZPAdminActions): void;
    SetBotPopulationTarget(this: ZPAdminActions, target: number): void;
    SaveBotPopulation(this: ZPAdminActions): void;
    Navigate(this: ZPAdminActions, page: ZPAdminPage): void;
    SetValue(this: ZPAdminActions, index: number, value: string): void;
    Save(this: ZPAdminActions): void;
    Refresh(this: ZPAdminActions): void;
    ConfirmReload(this: ZPAdminActions): void;
    Back(this: ZPAdminActions): void;
    Close(this: ZPAdminActions): void;
}
interface ZPAdminPresentation {
    ConfirmReload(this: ZPAdminPresentation, action: ZPAction): GLuaPanel;
    Open(this: ZPAdminPresentation, state: ZPAdminState, actions: ZPAdminActions): void;
    Update(this: ZPAdminPresentation, state: ZPAdminState): void;
    Destroy(this: ZPAdminPresentation): void;
}
interface ZPAdminController extends ZPAdminActions {
    Open(this: ZPAdminController): void;
    Rebuild(this: ZPAdminController): void;
    GetState(this: ZPAdminController): ZPAdminState;
}
declare const ZPAdminMenu: ZPAdminController;
declare function ZPCreateAdminHUD(this: void, palette: ZPThemePalette, square: boolean): ZPAdminPresentation;
interface ZPGlobals {
    ZPAdminMenu: ZPAdminController;
    ZPCreateAdminHUD: typeof ZPCreateAdminHUD;
}
interface ZPClientPlayer {
    IsAdmin(this: ZPClientPlayer): boolean;
    IsSuperAdmin(this: ZPClientPlayer): boolean;
}
declare function RunConsoleCommand(this: void, name: string, ...args: string[]): void;
/** @noSelf */
declare namespace game { function SinglePlayer(): boolean; }
type ZPAdminTextEntry = ZPTextEntry;
interface ZPAdminLabel extends GLuaPanel { SetWrap(this: ZPAdminLabel, wrap: boolean): void; }
/** @noSelf */
declare namespace vgui {
    function Create(name: "DLabel", parent?: GLuaPanel): ZPAdminLabel;
}
interface GLuaPanel {
    DoModal(this: GLuaPanel): void;
    IsEnabled(this: GLuaPanel): boolean;
}
/** @noSelf */
declare namespace net { function ReadUInt(bits: number): number; }
/** @noSelf */
declare namespace hook {
    function Add(name: "OnReloaded" | "ShutDown", id: string, callback: (this: void) => void): void;
}
