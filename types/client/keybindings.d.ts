type ZPAction = (this: void) => void;
interface ZPKeyEvent { Name: string; Action(this: ZPKeyEvent): void; DefaultKey: number; }
type ZPKeyGroups = Record<string, Record<string, number>>;
interface ZPKeyBinding { readonly ID: string; readonly Label: string; readonly Key: number; }
interface ZPKeyManager {
    Keys: ZPKeyGroups; EventGroups: Record<string, Record<string, ZPKeyEvent>>;
    TemporaryKeys: ZPKeyGroups; SaveFileName: string; LastPress: number; PressingKeyList: Record<number, boolean>;
    SetKeyGroup(this: ZPKeyManager, id: string, group: Record<string, number>): void;
    GetEvent(this: ZPKeyManager, id: string): ZPKeyEvent | undefined;
    AddEvent(this: ZPKeyManager, group: string, id: string, name: string, action: ZPAction, key: number): void;
    GetEventGroup(this: ZPKeyManager, id: string): Record<string, ZPKeyEvent>;
    GetEventGroups(this: ZPKeyManager): Record<string, Record<string, ZPKeyEvent>>;
    GetKeys(this: ZPKeyManager): ZPKeyGroups;
    GetKeysByGroupID(this: ZPKeyManager, id: string): Record<string, number>;
    Save(this: ZPKeyManager): void; Load(this: ZPKeyManager): void;
    ResetGroup(this: ZPKeyManager, id: string): void; LoadDefault(this: ZPKeyManager): ZPKeyGroups;
    Capturing: boolean;
    GetBindings(this: ZPKeyManager): ZPKeyBinding[];
    SetBinding(this: ZPKeyManager, id: string, key: number): boolean;
    ResetBindings(this: ZPKeyManager): void;
}
interface ZPGlobals { KeyManager: ZPKeyManager; }
declare const KeyManager: ZPKeyManager;
declare const KEY_NONE: number, KEY_F3: number, KEY_T: number;
/** @noSelf */
declare namespace input { function IsKeyDown(key: number): boolean; }
declare const KEY_LAST: number, KEY_BACKQUOTE: number;
declare const MOUSE_LEFT: number, MOUSE_RIGHT: number, MOUSE_MIDDLE: number, MOUSE_4: number, MOUSE_5: number;
/** @noSelf */
declare namespace input {
    function GetKeyName(key: number): string | undefined;
    function LookupKeyBinding(key: number): string | undefined;
    function TranslateAlias(bind: string): string | undefined;
    function IsMouseDown(key: number): boolean;
}
/** @noSelf */
declare namespace gui { function IsGameUIVisible(): boolean; function IsConsoleVisible(): boolean; }
/** @noSelf */
declare namespace vgui {
    function GetKeyboardFocus(): GLuaPanel | undefined;
    function CursorVisible(): boolean;
}
interface GLuaPanel {
    RequestFocus(this: GLuaPanel): void;
    OnKeyCodePressed?: (this: GLuaPanel, key: number) => void;
    OnMousePressed?: (this: GLuaPanel, button: number) => void;
    SetMouseInputEnabled(this: GLuaPanel, enabled: boolean): void;
    SetZPos(this: GLuaPanel, position: number): void;
}
/** @noSelf */
declare namespace hook {
    function Add(name: "PlayerBindPress", id: string,
        callback: (this: void, ply: ZPClientPlayer, bind: string, pressed: boolean, code: number) => boolean | undefined): void;
}
