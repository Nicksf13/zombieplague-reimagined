interface ZPTextEntry extends GLuaPanel {
    GetValue(this: ZPTextEntry): string;
    SetPlaceholderText(this: ZPTextEntry, text: string): void;
    GetPlaceholderText(this: ZPTextEntry): string | undefined;
    SetTextInset(this: ZPTextEntry, x: number, y: number): void;
    HasFocus(this: ZPTextEntry): boolean;
    DrawTextEntryText(this: ZPTextEntry, text: GLuaColor, highlight: GLuaColor, cursor: GLuaColor): void;
    OnChange?: (this: ZPTextEntry) => void;
}
/** @noSelf */
declare namespace vgui {
    function Create(name: "DTextEntry", parent?: GLuaPanel): ZPTextEntry;
}
