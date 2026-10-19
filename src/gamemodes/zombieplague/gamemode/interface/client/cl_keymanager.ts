const { FilterKeyInput, IsBindingDown } = include("cl_key_input.lua") as typeof import("./cl_key_input");
export class KeyManager implements ZPKeyManager {
    Keys: ZPKeyGroups = {};
    EventGroups: Record<string, Record<string, ZPKeyEvent>> = {};
    TemporaryKeys: ZPKeyGroups = {};
    SaveFileName: string = "zombieplague/keybinding.json";
    LastPress: number = 0;
    PressingKeyList: Record<number, boolean> = {};
    Capturing = false;
    GetBindings(): ZPKeyBinding[] {
        return ["MainMenu", "NightVisionToggle", "RequestAbility", "Dance"].map(id => ({ ID: id,
            Label: id === "MainMenu" ? "zombieplague.mainmenukeybinding" :
                id === "NightVisionToggle" ? "zombieplague.keybindingnightvisiontoggle" :
                    id === "Dance" ? "zombieplague.keybindingdance" : "zombieplague.keybindingrequestability",
            Key: this.Keys.ZombiePlagueActions?.[id] ?? KEY_NONE }));
    }
    private ValidKey(key: number): boolean {
        return key === Math.floor(key) && key >= KEY_NONE &&
            (key <= KEY_LAST || (key >= MOUSE_LEFT && key <= MOUSE_5)) && key !== KEY_ESCAPE && key !== KEY_BACKQUOTE;
    }
    SetBinding(id: string, key: number): boolean {
        const group = this.Keys.ZombiePlagueActions, previous = group?.[id];
        if (!group || previous === undefined || !this.ValidKey(key)) return false;
        // Swapping keeps one action per key and preserves access to the other action.
        for (const [other, value] of pairs(group))
            if (other !== id && key !== KEY_NONE && value === key) group[other] = previous;
        group[id] = key;
        this.PressingKeyList[key] = true;
        this.Save();
        return true;
    }
    ResetBindings(): void {
        this.Keys = this.LoadDefault();
        for (const binding of this.GetBindings()) this.PressingKeyList[binding.Key] = true;
        this.Save();
    }
    CanDispatch(key = KEY_NONE): boolean {
        const ply = LocalPlayer();
        return IsValid(ply) && !ply.IsTyping() && !this.Capturing && !gui.IsGameUIVisible() &&
            !_G.ZPEmoteWheel?.IsOpen() &&
            !gui.IsConsoleVisible() && !IsValid(vgui.GetKeyboardFocus()) && (key <= KEY_LAST || !vgui.CursorVisible());
    }
    Tick(): void {
        for (const [, group] of pairs(this.Keys))
            for (const [id, key] of pairs(group)) {
                if (key !== KEY_NONE && IsBindingDown(key)) {
                    if (!this.PressingKeyList[key]) {
                        this.PressingKeyList[key] = true;
                        if (this.CanDispatch(key)) this.GetEvent(id)?.Action();
                    }
                } else delete this.PressingKeyList[key];
            }
    }
    SetKeyGroup(id: string, group: Record<string, number>): void { this.Keys[id] = group; }
    GetEvent(id: string): ZPKeyEvent | undefined {
        for (const [, group] of pairs(this.EventGroups))
            if (group[id])
                return group[id];
        return undefined;
    }
    AddEvent(group: string, id: string, name: string, action: ZPAction, key: number): void {
        if (this.GetEvent(id)) {
            print("Could not add event: '" + id + "', duplicated ID!");
            return;
        }
        const events = this.EventGroups[group] ?? {};
        this.EventGroups[group] = events;
        events[id] = { Name: name, Action(): void { action(); }, DefaultKey: key };
    }
    GetEventGroup(id: string): Record<string, ZPKeyEvent> { return this.EventGroups[id] ?? {}; }
    GetEventGroups(): Record<string, Record<string, ZPKeyEvent>> { return this.EventGroups; }
    GetKeys(): ZPKeyGroups { return this.Keys; }
    GetKeysByGroupID(id: string): Record<string, number> { return this.Keys[id] ?? {}; }
    Save(): void {
        if (!file.Exists("zombieplague", "DATA"))
            file.CreateDir("zombieplague");
        file.Write(this.SaveFileName, util.TableToJSON(this.Keys, true));
    }
    LoadDefault(): ZPKeyGroups {
        const keys: ZPKeyGroups = {};
        for (const [groupID, group] of pairs(this.EventGroups)) {
            const bindings: Record<string, number> = {};
            keys[groupID] = bindings;
            for (const [id, event] of pairs(group))
                bindings[id] = event.DefaultKey;
        }
        return keys;
    }
    Load(): void {
        this.Keys = this.LoadDefault();
        const text = file.Read(this.SaveFileName, "DATA");
        const stored = text ? ZPClientData.Record(util.JSONToTable(text)) : undefined;
        if (stored)
            for (const [groupID, events] of pairs(this.EventGroups)) {
                const saved = ZPClientData.Record(stored[groupID]), group = this.Keys[groupID];
                if (!saved || !group)
                    continue;
                for (const [id] of pairs(events)) {
                    const key = saved[id] ?? (id === "MainMenu" ? saved.WeaponMenu : undefined);
                    if (typeof key === "number" && this.ValidKey(key)) {
                        for (const [other, value] of pairs(group))
                            if (other !== id && key !== KEY_NONE && value === key) group[other] = group[id] ?? KEY_NONE;
                        group[id] = key;
                    }
                }
            }
        this.Save();
    }
    ResetGroup(id: string): void {
        this.Keys[id] = this.LoadDefault()[id] ?? {};
        this.Save();
    }
}
const keyManager = new KeyManager();
_G.KeyManager = keyManager;
hook.Add("Think", "KeyManagerHook", () => keyManager.Tick());
hook.Add("PlayerBindPress", "ZPExclusiveKeyBinding", (_ply, _bind, _pressed, code) => {
    if (keyManager.CanDispatch(code) && keyManager.GetBindings().some(binding => binding.Key !== KEY_NONE && binding.Key === code))
        return true;
});
hook.Add("CreateMove", "ZPExclusiveKeyInput", command => {
    if (keyManager.CanDispatch()) FilterKeyInput(command, keyManager.GetBindings().filter(binding => keyManager.CanDispatch(binding.Key)));
});
const request = (name: string): ZPAction => () => { net.Start(name); net.SendToServer(); };
keyManager.AddEvent("ZombiePlagueActions", "NightVisionToggle", "KeyBindingNightVisionToggle", request("RequestNightvision"), KEY_F3);
keyManager.AddEvent("ZombiePlagueActions", "RequestAbility", "KeyBindingRequestAbility", request("RequestAbility"), KEY_T);
keyManager.AddEvent("ZombiePlagueActions", "MainMenu", "MainMenuKeyBinding", () => ZPMainMenu.Toggle(), KEY_F4);
keyManager.AddEvent("ZombiePlagueActions", "Dance", "KeyBindingDance", () =>
    _G.ZPEmoteWheel?.Open(keyManager.Keys.ZombiePlagueActions?.Dance), KEY_G);
keyManager.Load();
