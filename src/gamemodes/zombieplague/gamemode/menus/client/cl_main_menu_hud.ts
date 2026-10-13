// Presentation only: options and their actions belong to the controller.
export class MainMenuHUD implements ZPMainMenuPresentation {
    private frame: GLuaPanel | undefined;
    private list: GLuaPanel | undefined;
    private signature: string = "";
    private actions: ZPMainMenuActions | undefined;
    constructor(private palette: ZPThemePalette, private square: boolean) {}

    Open(state: ZPMainMenuState, actions: ZPMainMenuActions): void {
        this.actions = actions;
        const frame = vgui.Create("DFrame");
        this.frame = frame;
        frame.SetTitle("");
        frame.ShowCloseButton(false);
        frame.SetDraggable(false);
        frame.SetDeleteOnClose(true);
        frame.SetSize(Math.min(580, ScrW() - 32), Math.min(440, ScrH() - 180));
        frame.Center();
        frame.Paint = (width, height) => {
            draw.RoundedBox(this.square ? 0 : 8, 0, 0, width, height, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, width, 3, this.palette.Accent);
            draw.DrawText("ZOMBIE PLAGUE", "Trebuchet18", 24, 20, this.palette.Accent, TEXT_ALIGN_LEFT);
            draw.DrawText(language.GetPhrase("zombieplague.mainmenutitle"), "DermaLarge", 24, 48, this.palette.Text, TEXT_ALIGN_LEFT);
            draw.DrawText(language.GetPhrase("zombieplague.mainmenucontrols"), "DermaDefault", 24, height - 28, this.palette.Muted, TEXT_ALIGN_LEFT);
        };
        const [width] = frame.GetSize();
        this.Button(frame, "X", width - 52, 18, 30, () => actions.Close());
        frame.MakePopup();
        this.Update(state);
    }

    Update(state: ZPMainMenuState): void {
        const frame = this.frame;
        if (!frame || !IsValid(frame))
            return;
        const signature = state.Entries.map(entry => entry.ID + ":" + entry.Label + ":" + entry.Description).join("|");
        if (this.list && signature === this.signature)
            return;
        this.signature = signature;
        this.list?.Remove();
        const [width, height] = frame.GetSize();
        const list = vgui.Create("DScrollPanel", frame);
        this.list = list;
        list.SetPos(24, 100);
        list.SetSize(width - 48, height - 148);
        state.Entries.forEach((entry, index) => {
            const button = this.Button(list, language.GetPhrase(entry.Label), 0, index * 84, width - 70,
                () => this.actions?.Activate(entry.ID), 72);
            button.Paint = (w, h) => {
                const hovered = button.IsHovered();
                draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, hovered ? this.palette.Accent : this.palette.Panel);
                const color = hovered ? Color(12, 18, 22) : this.palette.Text;
                draw.DrawText(language.GetPhrase(entry.Label), "ZPMenuOptionTitle", 16, 10, color, TEXT_ALIGN_LEFT);
                draw.DrawText(language.GetPhrase(entry.Description), "DermaDefault", 16, 44, color, TEXT_ALIGN_LEFT);
            };
        });
        frame.SetKeyboardInputEnabled(false);
    }

    private Button(parent: GLuaPanel, text: string, x: number, y: number, width: number, action: ZPAction, height: number = 30): GLuaPanel {
        const button = parent.Add("DButton");
        button.SetText("");
        button.SetPos(x, y);
        button.SetSize(width, height);
        button.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, w, h, this.palette.Panel);
            surface.SetFont("Trebuchet18");
            const [textWidth, textHeight] = surface.GetTextSize(text);
            draw.DrawText(text, "Trebuchet18", (w - textWidth) / 2, (h - textHeight) / 2,
                this.palette.Accent, TEXT_ALIGN_LEFT);
        };
        button.DoClick = () => action();
        return button;
    }

    Destroy(): void {
        this.frame?.Remove();
        this.frame = undefined;
        this.list = undefined;
    }
}
_G.ZPCreateMainMenuHUD = (palette, square) => new MainMenuHUD(palette, square);
