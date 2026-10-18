interface GLuaEntity {
    IsInWorld(this: GLuaEntity): boolean;
}

interface ZPGameMode {
    TeamBased?: boolean;
    PlayerSelectSpawn(this: ZPGameMode, ply: ZPServerPlayer, transition?: boolean): GLuaEntity | undefined;
}

/** @noSelf */
declare namespace team {
    function GetSpawnPoints(id: number): GLuaEntity[] | undefined;
}

/** @noSelf */
declare namespace scripted_ents {
    function GetMember(className: "gmod_player_start", member: "SpawnPointClasses"): readonly string[] | undefined;
}

/** @noSelf */
declare namespace hook {
    function Add(name: "PostCleanupMap", id: string, callback: (this: void) => void): void;
    function Add(name: "PlayerSpawn", id: string, callback: (this: void, ply: ZPServerPlayer, transition?: boolean) => void): void;
}
