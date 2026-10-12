type ZPAction = (this: void) => void;
interface ZPKeyEvent { Name: string; Action(this: ZPKeyEvent): void; DefaultKey: number; }
type ZPKeyGroups = Record<string, Record<string, number>>;
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
}
interface ZPGlobals { KeyManager: ZPKeyManager; }
declare const KeyManager: ZPKeyManager;
declare const KEY_NONE: number, KEY_F3: number, KEY_T: number;
/** @noSelf */
declare namespace input { function IsKeyDown(key: number): boolean; }
