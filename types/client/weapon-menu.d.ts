interface ZPWeaponMenuState {
    readonly Open: boolean;
    readonly Category: ZPWeaponMenuCategory;
    readonly Presentation: string;
    readonly Snapshot?: ZPWeaponMenuSnapshot;
    readonly Pending: boolean;
    readonly Feedback: string;
    readonly Search: string;
    readonly Family: ZPWeaponFamilyFilter;
}
interface ZPWeaponMenuActions {
    SetSearch(this: ZPWeaponMenuActions, text: string): void;
    SetFamily(this: ZPWeaponMenuActions, family: ZPWeaponFamilyFilter): void;
    SetRemember(this: ZPWeaponMenuActions, remember: boolean): void;
    SetCategory(this: ZPWeaponMenuActions, kind: ZPWeaponMenuCategory): void;
    Select(this: ZPWeaponMenuActions, id: string): void;
    Refresh(this: ZPWeaponMenuActions): void;
    Close(this: ZPWeaponMenuActions): void;
    UsePresentation(this: ZPWeaponMenuActions, id: string): void;
}
interface ZPWeaponMenuPresentation {
    Open(this: ZPWeaponMenuPresentation, state: ZPWeaponMenuState, actions: ZPWeaponMenuActions): void;
    Update(this: ZPWeaponMenuPresentation, state: ZPWeaponMenuState): void;
    Destroy(this: ZPWeaponMenuPresentation): void;
}
type ZPWeaponMenuPresentationFactory = (this: void) => ZPWeaponMenuPresentation;
interface ZPWeaponMenuController extends ZPWeaponMenuActions {
    RegisterPresentation(this: ZPWeaponMenuController, id: string, factory: ZPWeaponMenuPresentationFactory): void;
    GetState(this: ZPWeaponMenuController): ZPWeaponMenuState;
    Open(this: ZPWeaponMenuController): void;
    OpenMissing(this: ZPWeaponMenuController, kind: ZPWeaponMenuCategory): void;
    Toggle(this: ZPWeaponMenuController): void;
}
declare const ZPWeaponMenu: ZPWeaponMenuController;
interface ZPGlobals { ZPWeaponMenu: ZPWeaponMenuController; }
interface GLuaPanel {
    Remove(this: GLuaPanel): void;
    IsHovered(this: GLuaPanel): boolean;
    SetKeyboardInputEnabled(this: GLuaPanel, enabled: boolean): void;
}
declare const KEY_F4: number, KEY_ESCAPE: number;
/** @noSelf */
declare namespace net {
    function WriteTable(value: object): void;
    function WriteUInt(value: number, bits: number): void;
}
type ZPWeaponSearchEntry = ZPTextEntry;
interface ZPWeaponFamilyCombo extends ZPThemedComboBox {
    Clear(this: ZPWeaponFamilyCombo): void;
    AddChoice(this: ZPWeaponFamilyCombo, text: string, data: ZPWeaponFamilyFilter): number;
    SetValue(this: ZPWeaponFamilyCombo, text: string): void;
    SetSortItems(this: ZPWeaponFamilyCombo, enabled: boolean): void;
    OnSelect?: (this: ZPWeaponFamilyCombo, index: number, text: string, data: ZPWeaponFamilyFilter) => void;
}
interface ZPWeaponRememberCheckbox extends GLuaPanel {
    SetChecked(this: ZPWeaponRememberCheckbox, checked: boolean): void;
    SetTextColor(this: ZPWeaponRememberCheckbox, color: GLuaColor): void;
    OnChange?: (this: ZPWeaponRememberCheckbox, checked: boolean) => void;
}
/** @noSelf */
declare namespace vgui {
    function Create(name: "DComboBox", parent?: GLuaPanel): ZPWeaponFamilyCombo;
    function Create(name: "DCheckBoxLabel", parent?: GLuaPanel): ZPWeaponRememberCheckbox;
}
