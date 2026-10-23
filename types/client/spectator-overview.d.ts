interface ZPSpectatorOverviewClient {
    IsOpen(this: ZPSpectatorOverviewClient): boolean;
    GetSnapshot(this: ZPSpectatorOverviewClient): ZPSpectatorSnapshot | undefined;
    Follow(this: ZPSpectatorOverviewClient, id: number): void;
}
interface ZPSpectatorOverviewPresentation {
    Open(this: ZPSpectatorOverviewPresentation, actions: ZPSpectatorOverviewClient, overview: ZPRadarOverview): void;
    Destroy(this: ZPSpectatorOverviewPresentation): void;
}
interface ZPGlobals { ZPSpectatorOverview?: ZPSpectatorOverviewClient; }
/** @noSelf */
declare namespace input { function LookupBinding(binding: string): string | undefined; }
