interface ZPMenuControlLabel extends GLuaPanel {
    GetText(this: ZPMenuControlLabel): string;
    SetTextColor(this: ZPMenuControlLabel, color: GLuaColor): void;
    SetTextInset(this: ZPMenuControlLabel, x: number, y: number): void;
}
interface ZPMenuControlCanvas {
    GetChildren(this: ZPMenuControlCanvas): ZPMenuControlLabel[];
}
interface ZPMenuControlPopup extends GLuaPanel {
    GetCanvas(this: ZPMenuControlPopup): ZPMenuControlCanvas;
}
interface ZPThemedComboBox extends ZPMenuControlLabel {
    DropButton: GLuaPanel;
    IsMenuOpen(this: ZPThemedComboBox): boolean;
    OnMenuOpened?: (this: ZPThemedComboBox, menu: ZPMenuControlPopup) => void;
}
interface ZPMenuControls {
    TextEntry(this: void, entry: ZPTextEntry, palette: ZPThemePalette, square: boolean): void;
    ComboBox(this: void, combo: ZPThemedComboBox, palette: ZPThemePalette, square: boolean): void;
}
declare const ZPMenuControls: ZPMenuControls;
interface ZPGlobals { ZPMenuControls: ZPMenuControls; }
