interface ZPAdminSetting {
    readonly Name: string;
    readonly Label: string;
    readonly Kind: "toggle" | "skybox" | "brightness" | "exposure";
    readonly Default: string;
    readonly RequiresReload: boolean;
}
interface ZPAdminConfig {
    readonly Entries: readonly ZPAdminSetting[];
    Normalize(this: void, entry: ZPAdminSetting, value: string): string | undefined;
}
declare const ZPAdminConfig: ZPAdminConfig;
interface ZPGlobals { ZPAdminConfig: ZPAdminConfig; }
