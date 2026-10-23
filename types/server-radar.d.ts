interface ZPRadarServer {
    OverviewReady(this: ZPRadarServer, player: ZPServerPlayer): boolean;
    Available(this: ZPRadarServer): boolean;
    CanBuy(this: ZPRadarServer, player: ZPServerPlayer): boolean;
    Purchase(this: ZPRadarServer, player: ZPServerPlayer): void;
    Attack(this: ZPRadarServer, player: ZPServerPlayer, melee: boolean): void;
    Decoy(this: ZPRadarServer, entity: GLuaEntity): void;
    ForgetDecoy(this: ZPRadarServer, id: number): void;
}
declare const ZPRadar: ZPRadarServer;
interface ZPGlobals { ZPRadar: ZPRadarServer; }
/** @noSelf */
declare namespace player { function GetAll(): ZPServerPlayer[]; }
/** @noSelf */
declare namespace hook {
    function Add(name: "OnEntityCreated", id: string, callback: (this: void, entity: GLuaEntity) => void): void;
    function Add(name: "PlayerDisconnected", id: string, callback: (this: void, player: ZPServerPlayer) => void): void;
    function Add(name: "PostEntityFireBullets", id: string, callback: (this: void, entity: GLuaEntity, data: unknown) => void): void;
    function Add(name: "ZPRadarMelee" | "ZPRadarGunshot", id: string, callback: (this: void, player: ZPServerPlayer) => void): void;
    function Add(name: "OnPlayerChangedTeam", id: string, callback: (this: void, player: ZPServerPlayer, before: number, after: number) => void): void;
    function Add(name: "PlayerSpawn", id: string, callback: (this: void, player: ZPServerPlayer) => void): void;
}
