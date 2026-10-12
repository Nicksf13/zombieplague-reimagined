export class MapManager implements ZPServerMapManager {
    Configs: ZPMapConfig[] = [];
    SearchConfigs(): void {
        const [files] = file.Find("zombieplague/gamemode/mapconfigs/*.lua", "LUA");
        for (const name of files) {
            _G.MapConfig = {};
            include("zombieplague/gamemode/mapconfigs/" + name);
            if ((MapConfig.Prefix || MapConfig.MapName) && MapConfig.Start)
                this.AddMapConfig(MapConfig);
            else
                print("Invalid map config: '" + name + "'.");
        }
    }
    AddMapConfig(config: ZPMapConfig): void { this.Configs.push(config); }
    GetMapConfig(name: string): ZPMapConfig | undefined {
        for (const config of this.Configs)
            if (config.MapName === name)
                return config;
        for (const config of this.Configs)
            if (config.Prefix && string.StartWith(name, config.Prefix))
                return config;
        return undefined;
    }
}
const mapManager = new MapManager();
_G.MapManager = mapManager;
hook.Add("ZPPrePreparingRound", "LoadMapConfig", (round) => {
    const config = mapManager.GetMapConfig(game.GetMap());
    if (config?.Start)
        config.Start(round);
});
