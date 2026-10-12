function listConvars(this: void, ply: ZPServerPlayer, convars: Record<string, string>): void {
    const sorted: {
        Name: string;
        Description: string;
    }[] = [];
    for (const [name, description] of pairs(convars)) {
        sorted.push({ Name: name, Description: description });
    }
    sorted.sort((a, b) => a.Name < b.Name ? -1 : a.Name > b.Name ? 1 : 0);
    SendConsoleMessage(ply, "Convars server list:");
    for (const item of sorted)
        SendConsoleMessage(ply, item.Name + " - " + item.Description);
    SendColorMessage(ply, "ConVars has been printed on the console", Color(255, 255, 0));
}
export class ConvarManager implements ZPConvarManager {
    Convars: Record<string, string> = {};
    CreateConVar(name: string, value: string | number, flags: number, description: string): void {
        CreateConVar(name, tostring(value), flags, description);
        this.Convars[name] = description;
    }
    ListCvars: ZPConvarManager["ListCvars"] = (ply): void => listConvars(ply, this.Convars);
}
const convarManager = new ConvarManager();
_G.ConvarManager = convarManager;
Commands.AddCommand("cvars", "List all cvars available for zombieplague", convarManager.ListCvars, "", true);
Commands.AddCommand("makecvarslist", "Make a list of all cvars available for zombieplague", convarManager.ListCvars, "", true);
