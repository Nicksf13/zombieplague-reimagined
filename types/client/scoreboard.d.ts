interface ZPGameMode { ScoreboardShow(this: ZPGameMode): void; ScoreboardHide(this: ZPGameMode): void; }
interface ZPClientPlayer {
    Deaths(this: ZPClientPlayer): number; Ping(this: ZPClientPlayer): number;
    IsMuted(this: ZPClientPlayer): boolean; SetMuted(this: ZPClientPlayer, muted: boolean): void;
}
interface GLuaPanel {
    SetImage(this: GLuaPanel, path: string): void;
    SetDraggable(this: GLuaPanel, value: boolean): void;
    SetDeleteOnClose(this: GLuaPanel, value: boolean): void;
    ShowCloseButton(this: GLuaPanel, value: boolean): void;
    SetTitle(this: GLuaPanel, text: string): void;
    Center(this: GLuaPanel): void;
    Paint?(this: GLuaPanel, width: number, height: number): void;
    DoClick?(this: GLuaPanel): void;
    Clear(this: GLuaPanel): void;
    Close(this: GLuaPanel): void;
    Add(this: GLuaPanel, item: string | GLuaPanel): GLuaPanel;
    MakePopup(this: GLuaPanel): void;
    GetSize(this: GLuaPanel): LuaMultiReturn<[number, number]>;
}
/** @noSelf */
declare namespace team { function GetColor(id: number): GLuaColor; }
/** @noSelf */
declare namespace timer { function Create(id: string, delay: number, repeats: number, action: ZPAction): void; function Destroy(id: string): void; }
declare function tostring(this: void, value: unknown): string;
