export class KeyManager implements ZPKeyManager {
    Keys: ZPKeyGroups = {};
    EventGroups: Record<string, Record<string, ZPKeyEvent>> = {};
    TemporaryKeys: ZPKeyGroups = {};
    SaveFileName: string = "zombieplague/keybinding.json";
    LastPress: number = 0;
    PressingKeyList: Record<number, boolean> = {};
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
                    if (typeof key === "number" && key >= KEY_NONE && key === Math.floor(key))
                        group[id] = key;
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
hook.Add("Think", "KeyManagerHook", () => {
    if (LocalPlayer().IsTyping() || CurTime() < keyManager.LastPress)
        return;
    for (const [, group] of pairs(keyManager.Keys))
        for (const [id, key] of pairs(group)) {
            if (key !== KEY_NONE && input.IsKeyDown(key)) {
                if (!keyManager.PressingKeyList[key]) {
                    keyManager.LastPress = CurTime() + 0.2;
                    keyManager.PressingKeyList[key] = true;
                    keyManager.GetEvent(id)?.Action();
                }
            }
            else
                delete keyManager.PressingKeyList[key];
        }
});
const request = (name: string): ZPAction => () => { net.Start(name); net.SendToServer(); };
keyManager.AddEvent("ZombiePlagueActions", "NightVisionToggle", "KeyBindingNightVisionToggle", request("RequestNightvision"), KEY_F3);
keyManager.AddEvent("ZombiePlagueActions", "RequestAbility", "KeyBindingRequestAbility", request("RequestAbility"), KEY_T);
keyManager.AddEvent("ZombiePlagueActions", "MainMenu", "MainMenuKeyBinding", () => ZPMainMenu.Toggle(), KEY_F4);
keyManager.Load();
