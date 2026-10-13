interface ZPClassMenuService {
    NeedsChoice(this: ZPClassMenuService, ply: ZPServerPlayer, kind: ZPClassMenuKind): boolean;
}
declare const ZPClassMenu: ZPClassMenuService;
interface ZPGlobals {
    ZPClassMenu?: ZPClassMenuService;
    ZPApplyInitialClass: (this: void, ply: ZPServerPlayer, definition: ZPClassDefinition, kind: ZPClassMenuKind) => void;
}
declare function ZPApplyInitialClass(this: void, ply: ZPServerPlayer, definition: ZPClassDefinition, kind: ZPClassMenuKind): void;
/** @noSelf */
declare namespace hook {
    function Add(name: "ZPClassSelectionReady" | "ZPClassMenuConfirmed", id: string, action: (this: void, ply: ZPServerPlayer) => void): void;
}
