type ZPRoundEndReason = 1 | 2 | 3;
interface ZPRoundDefinition {
    MinPlayers: number;
    Chance: number;
    SpecialRound?: boolean;
    Respawn?: boolean;
    Order: number;
    StartSound?: string[];
    ShouldBeEnabled?(this: ZPRoundDefinition): boolean;
    RoundEndFunction?(this: ZPRoundDefinition): void;
    RespawnFunction?(this: void, ply: ZPServerPlayer): boolean;
    OnDeathFunction?(this: void, ply: ZPServerPlayer): void;
}
interface ZPServerRoundManager {
    FreezeTimeActive: boolean;
    GetAlivePlayers(this: ZPServerRoundManager): ZPServerPlayer[];
    Rounds: Record<string, ZPRoundDefinition>;
    PlayersToPlay: ZPServerPlayer[];
    ExtraRounds: number;
    PlayersToReward: Record<number, string[]>;
    RoundPlaying?: ZPRoundDefinition;
    AddRoundType(this: ZPServerRoundManager, id: string, round: ZPRoundDefinition): void;
    AddDefaultRounds(this: ZPServerRoundManager): void;
    AddExtraRounds(this: ZPServerRoundManager, amount: number): void;
    SetTimer(this: ZPServerRoundManager, seconds: number, callback: (this: void) => void): void;
    GetTime(this: ZPServerRoundManager): number;
    CheckRoundEnd(this: ZPServerRoundManager): void;
    WaitPlayers(this: ZPServerRoundManager): void;
    Prepare(this: ZPServerRoundManager): boolean;
    FreezeTime(this: ZPServerRoundManager): void;
    FreezePlayer(this: ZPServerRoundManager, ply: ZPServerPlayer): void;
    UnfreezePlayer(this: ZPServerRoundManager, ply: ZPServerPlayer): void;
    TryNewRound(this: ZPServerRoundManager): void;
    NewRound(this: ZPServerRoundManager): void;
    RestartRound(this: ZPServerRoundManager): void;
    EndRound(this: ZPServerRoundManager, reason: ZPRoundEndReason): void;
    RoundsLeft(this: ZPServerRoundManager): number;
    GetCurrentRoundPlaying(this: ZPServerRoundManager): ZPRoundDefinition | undefined;
    GetGoodRounds(this: ZPServerRoundManager): Record<string, ZPRoundDefinition>;
    ShouldRoundEnd(this: ZPServerRoundManager): boolean;
    CountPlayersToPlay(this: ZPServerRoundManager): number;
    CountPlayersToPlayAlive(this: ZPServerRoundManager): number;
    GetPlayersToPlay(this: ZPServerRoundManager, alive?: boolean): ZPServerPlayer[];
    AddPlayerToBeRewarded(this: ZPServerRoundManager, ply: ZPServerPlayer): void;
    ReturnValidPlayerToBeRewardedOrNil(this: ZPServerRoundManager, id: string, team: number): ZPServerPlayer | undefined;
}
interface ZPServerPlayer { Lifes?: number; MakeNemesis(this: ZPServerPlayer): void; MakeSurvivor(this: ZPServerPlayer): void; }
interface ZPVoteMapManager {
    MapsToVote: Record<string, number>;
    Voting: boolean;
    Voters: Record<string, boolean>;
    StartVotemap(this: ZPVoteMapManager, prefixes: string[]): void;
    EndVotemap(this: ZPVoteMapManager): void;
}
interface ZPGlobals { ZPVoteMap: ZPVoteMapManager; }
declare const ZPVoteMap: ZPVoteMapManager;
/** @noSelf */
declare namespace player { function GetBySteamID64(id: string): ZPServerPlayer | undefined; }
/** @noSelf */
declare namespace game { function CleanUpMap(): void; }
/** @noSelf */
declare namespace cvars { function String(name: string, fallback?: string): string; }
/** @noSelf */
declare namespace hook {
    function Add(name: "PostPlayerDeath", id: string, callback: (this: void, ply: ZPServerPlayer) => void): void;
    function Add(name: "ZPEndRound", id: string, callback: (this: void, reason: ZPRoundEndReason) => void): void;
}
