interface ZPEmoteWheelEntry extends ZPEmoteDefinition { readonly Available: boolean; }
interface ZPEmoteWheelState { readonly Entries: readonly ZPEmoteWheelEntry[]; readonly Page: number; readonly Pages: number; }
interface ZPEmoteWheelPresentation {
    Open(this: ZPEmoteWheelPresentation): void;
    Selection(this: ZPEmoteWheelPresentation): number | undefined;
    Destroy(this: ZPEmoteWheelPresentation): void;
}
interface ZPEmoteWheelActions {
    State(this: ZPEmoteWheelActions): ZPEmoteWheelState;
    Page(this: ZPEmoteWheelActions, direction: number): void;
    Click(this: ZPEmoteWheelActions, button: number): void;
    Cancel(this: ZPEmoteWheelActions): void;
}
interface ZPEmoteWheel {
    Open(this: ZPEmoteWheel, heldKey?: number): void;
    IsOpen(this: ZPEmoteWheel): boolean;
    Cancel(this: ZPEmoteWheel): void;
}
declare const ZPEmoteWheel: ZPEmoteWheel;
interface ZPGlobals { ZPEmoteWheel: ZPEmoteWheel; }
interface ZPEmoteVertex { x: number; y: number; }
interface GLuaPanel {
    LocalCursorPos(this: GLuaPanel): LuaMultiReturn<[number, number]>;
    OnMouseWheeled?: (this: GLuaPanel, delta: number) => boolean;
    OnRemove?: (this: GLuaPanel) => void;
}
/** @noSelf */
declare namespace input { function SetCursorPos(x: number, y: number): void; }
/** @noSelf */
declare namespace math { function atan2(y: number, x: number): number; }
/** @noSelf */
declare namespace draw { function NoTexture(): void; }
/** @noSelf */
declare namespace surface { function DrawPoly(vertices: readonly ZPEmoteVertex[]): void; }
