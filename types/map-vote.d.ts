interface ZPMapVoteEntry { Map: string; Votes: number; Extend: boolean; }
interface ZPMapVoteSnapshot {
    Version: 1; ID: number; Voting: boolean; Remaining: number;
    Entries: ZPMapVoteEntry[]; Selected: string; Winner: string;
}
interface ZPMapVoteRequest { Version: 1; ID: number; Map: string; }
interface ZPMapVoteProtocol {
    Map(this: void, value: unknown): value is string;
    Request(this: void, value: unknown): ZPMapVoteRequest | undefined;
    Snapshot(this: void, value: unknown): ZPMapVoteSnapshot | undefined;
}
declare const ZPMapVoteProtocol: ZPMapVoteProtocol;
interface ZPGlobals { ZPMapVoteProtocol: ZPMapVoteProtocol; }
/** @noSelf */
declare namespace string { function match(value: string, pattern: string): string | undefined; }
