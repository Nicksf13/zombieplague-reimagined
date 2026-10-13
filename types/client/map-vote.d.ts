interface ZPMapVoteController {
    GetSnapshot(this: ZPMapVoteController): ZPMapVoteSnapshot | undefined;
    GetRemaining(this: ZPMapVoteController): number;
    Open(this: ZPMapVoteController): void;
    Close(this: ZPMapVoteController): void;
    Rebuild(this: ZPMapVoteController): void;
    Select(this: ZPMapVoteController, map: string): void;
}
interface ZPMapVotePresentation {
    Open(this: ZPMapVotePresentation, actions: ZPMapVoteController): void;
    Destroy(this: ZPMapVotePresentation): void;
}
type ZPMapVotePresentationFactory = (this: void) => ZPMapVotePresentation;
declare const ZPMapVoteMenu: ZPMapVoteController;
declare function ZPCreateMapVoteHUD(this: void, palette: ZPThemePalette, square: boolean): ZPMapVotePresentation;
interface ZPGlobals { ZPMapVoteMenu: ZPMapVoteController; ZPCreateMapVoteHUD: typeof ZPCreateMapVoteHUD; }
interface ZPThemeDefinition { readonly CreateMapVote?: ZPMapVotePresentationFactory; }
interface GLuaMaterial { IsError(this: GLuaMaterial): boolean; }
/** @noSelf */
declare namespace surface {
    function SetMaterial(material: GLuaMaterial): void;
    function SetDrawColor(r: number, g: number, b: number, a: number): void;
    function DrawTexturedRect(x: number, y: number, width: number, height: number): void;
}
/** @noSelf */
declare namespace file { function Exists(path: string, realm: "GAME"): boolean; }
