export {};
_G.WARNING_MESSAGE = 1;
_G.ERROR_MESSAGE = 2;
_G.INFO_MESSAGE = 3;
_G.Utils = {
    RecursiveFileSearch(this: ZPUtils, currentPath: string, suffix: string): Record<string, string> {
        const [files, directories] = file.Find(currentPath + "/*", "LUA");
        const found: Record<string, string> = {};
        for (const name of files) {
            if (string.EndsWith(name, suffix))
                found[currentPath + "/" + name] = currentPath + "/" + name;
            else
                this.Print(WARNING_MESSAGE, "'" + currentPath + "/" + name + "' is not a .lua, ignoring it!");
        }
        for (const directory of directories) {
            for (const [key, value] of pairs(this.RecursiveFileSearch(currentPath + "/" + directory, suffix))) {
                found[key] = value;
            }
        }
        return found;
    },
    Print(this: ZPUtils, kind: number, message: string): void {
        const prefix = kind === WARNING_MESSAGE ? "WARNING" : kind === ERROR_MESSAGE ? "ERROR" : kind === INFO_MESSAGE ? "INFO" : "";
        print("[" + prefix + "] " + message);
    },
};
