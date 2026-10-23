interface ZPSpectatorOverviewServer {
    Open(this: ZPSpectatorOverviewServer, player: ZPServerPlayer): boolean;
    Input(this: ZPSpectatorOverviewServer, player: ZPServerPlayer): boolean;
}
interface ZPGlobals { ZPSpectatorOverview?: ZPSpectatorOverviewServer; }
