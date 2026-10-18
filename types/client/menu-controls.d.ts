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
    ScrollPanel(this: void, panel: ZPMenuScrollPanel, palette: ZPThemePalette, square: boolean): void;
    TextEntry(this: void, entry: ZPTextEntry, palette: ZPThemePalette, square: boolean): void;
    ComboBox(this: void, combo: ZPThemedComboBox, palette: ZPThemePalette, square: boolean): void;
}
interface ZPMenuScrollBar extends GLuaPanel {
    SetWide(this: ZPMenuScrollBar, width: number): void;
    btnGrip: GLuaPanel; btnUp: GLuaPanel; btnDown: GLuaPanel;
}
interface ZPMenuScrollPanel extends GLuaPanel { GetVBar(this: ZPMenuScrollPanel): ZPMenuScrollBar; }
/** @noSelf */
declare namespace vgui { function Create(name: "DScrollPanel", parent?: GLuaPanel): ZPMenuScrollPanel; }
interface ZPMenuComboBox<T> extends ZPThemedComboBox {
    Clear(this: ZPMenuComboBox<T>): void;
    AddChoice(this: ZPMenuComboBox<T>, text: string, data: T): number;
    SetValue(this: ZPMenuComboBox<T>, text: string): void;
    SetSortItems(this: ZPMenuComboBox<T>, enabled: boolean): void;
    OnSelect?: (this: ZPMenuComboBox<T>, index: number, text: string, data: T) => void;
}
declare const ZPMenuControls: ZPMenuControls;
interface ZPGlobals { ZPMenuControls: ZPMenuControls; }
