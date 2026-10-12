export {};
const phrase = (id: string): string => language.GetPhrase("zombieplague.weaponmenu" + id);
const categories: readonly ZPWeaponMenuCategory[] = ["primary", "secondary", "melee"];

// Themes consume only state/actions. No networking or gameplay belongs here.
class WeaponMenuHUD implements ZPWeaponMenuPresentation {
    private frame: GLuaPanel | undefined;
    private content: GLuaPanel | undefined;
    private state: ZPWeaponMenuState | undefined;
    private actions: ZPWeaponMenuActions | undefined;
    constructor(private style: "classic" | "hl2" | "cs16", private palette: ZPThemePalette) {}

    private Text(text: string, font: string, x: number, y: number, color: GLuaColor = this.palette.Text): void {
        draw.DrawText(text, font, x, y, color, TEXT_ALIGN_LEFT);
    }

    private Button(parent: GLuaPanel, text: string, x: number, y: number, width: number, height: number,
        action: ZPAction, selected: boolean = false): GLuaPanel {
        const button = vgui.Create("DButton", parent);
        button.SetText("");
        button.SetPos(x, y);
        button.SetSize(width, height);
        button.Paint = (_width, _height) => {
            draw.RoundedBox(this.style === "cs16" ? 0 : 4, 0, 0, _width, _height, selected || button.IsHovered() ? this.palette.Accent : this.palette.Panel);
            this.Text(text, "Trebuchet18", 12, Math.max(4, (_height - 20) / 2), selected || button.IsHovered() ? Color(12, 18, 22) : this.palette.Text);
        };
        button.DoClick = () => action();
        return button;
    }

    Open(state: ZPWeaponMenuState, actions: ZPWeaponMenuActions): void {
        this.actions = actions;
        const frame = vgui.Create("DFrame");
        this.frame = frame;
        frame.SetTitle("");
        frame.ShowCloseButton(false);
        frame.SetDraggable(false);
        frame.SetDeleteOnClose(true);
        const maxWidth = this.style === "cs16" ? 780 : 960;
        frame.SetSize(Math.min(maxWidth, ScrW() >= 1100 ? ScrW() - 480 : ScrW() - 32), Math.min(560, ScrH() - 180));
        frame.Center();
        frame.Paint = (width, height) => {
            draw.RoundedBox(this.style === "cs16" ? 0 : 8, 0, 0, width, height, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, width, this.style === "cs16" ? 28 : 3, this.style === "cs16" ? this.palette.Panel : this.palette.Accent);
            this.Text("ZOMBIE PLAGUE", "Trebuchet18", 24, 20, this.palette.Accent);
            this.Text(phrase("title"), "DermaLarge", 24, 44);
            if (height >= 400)
                this.Text(phrase("subtitle"), "DermaDefault", 24, 82, this.palette.Muted);
            this.Text(phrase("controls"), "DermaDefault", 24, height - 28, this.palette.Muted);
        };
        frame.MakePopup();
        // Cursor selects weapons; keyboard remains available for movement.
        frame.SetKeyboardInputEnabled(false);
        const [width] = frame.GetSize();
        this.Button(frame, "X", width - 52, 18, 30, 30, () => this.actions?.Close());
        this.Update(state);
    }

    Update(state: ZPWeaponMenuState): void {
        this.state = state;
        const frame = this.frame;
        if (!frame || !IsValid(frame))
            return;
        if (this.content && IsValid(this.content))
            this.content.Remove();
        const [width, height] = frame.GetSize();
        const content = vgui.Create("DPanel", frame);
        this.content = content;
        const compact = height < 400, contentY = compact ? 76 : 106;
        content.SetPos(16, contentY);
        content.SetSize(width - 32, height - contentY - 40);
        content.Paint = () => {};
        const w = width - 32, h = height - contentY - 40, footerHeight = compact ? 76 : 90;
        // Header controls belong to content, so each update removes the previous controls.
        const themes = ZPThemes.GetThemes(), themeWidth = Math.min(180, (w - 16) / Math.max(1, themes.length));
        themes.forEach((theme, index) => this.Button(content, theme.Name, index * (themeWidth + 8), 0, themeWidth, 30,
            () => this.actions?.UsePresentation(theme.ID), theme.ID === state.Presentation));
        const horizontal = this.style === "hl2" && height >= 450;
        const categoryWidth = horizontal ? Math.floor((w - 24) / 3) : Math.min(176, w * 0.3);
        categories.forEach((kind, index) => {
            const x = horizontal ? index * (categoryWidth + 12) : 0;
            const y = horizontal ? 44 : 44 + index * 62;
            this.Button(content, phrase(kind), x, y, categoryWidth, 48,
                () => this.actions?.SetCategory(kind), kind === state.Category);
        });
        const listX = horizontal ? 0 : categoryWidth + 18, listY = horizontal ? 104 : 44;
        const listWidth = w - listX, listHeight = Math.max(40, h - listY - footerHeight - 10);
        const scroll = vgui.Create("DScrollPanel", content);
        scroll.SetPos(listX, listY);
        scroll.SetSize(listWidth, listHeight);
        const entries = state.Snapshot?.Entries.filter(entry => entry.Kind === state.Category) ?? [];
        const columns = horizontal && listWidth >= 560 ? 2 : 1;
        const cardWidth = Math.floor((listWidth - 20 - (columns - 1) * 10) / columns);
        entries.forEach((entry, index) => this.WeaponCard(scroll, entry, index, columns, cardWidth));
        if (entries.length === 0) {
            const label = scroll.Add("DLabel");
            label.SetText(phrase(state.Pending ? "waiting" : "empty"));
            label.SetPos(12, 12);
            label.SetSize(listWidth - 24, 40);
            label.SetColor(this.palette.Muted);
        }
        const footer = vgui.Create("DPanel", content);
        footer.SetPos(listX, h - footerHeight);
        footer.SetSize(listWidth, footerHeight);
        footer.Paint = () => {
            const current = this.state;
            if (!current)
                return;
            this.Text(language.GetPhrase(current.Feedback), "DermaDefault", 0, 4, this.palette.Accent);
            if (current.Snapshot) {
                const delivery = current.Snapshot.CanReceive[current.Category] ? "receivenow" : "receivelater";
                this.Text(phrase(delivery), "DermaDefault", 0, compact ? 20 : 26, this.palette.Muted);
            }
            if (current.Snapshot?.Truncated)
                this.Text(phrase("truncated"), "DermaDefault", 0, compact ? 34 : 46, this.palette.Muted);
        };
        this.Button(footer, phrase("refresh"), 0, compact ? 50 : 60, 130, compact ? 24 : 28, () => this.actions?.Refresh());
        // Newly created buttons must not take keyboard focus from gameplay either.
        frame.SetKeyboardInputEnabled(false);
    }

    private WeaponCard(parent: GLuaPanel, entry: ZPWeaponMenuEntry, index: number, columns: number, width: number): void {
        const button = parent.Add("DButton");
        button.SetText("");
        const height = this.style === "cs16" ? 54 : 66;
        button.SetPos((index % columns) * (width + 10), Math.floor(index / columns) * (height + 10));
        button.SetSize(width, height);
        button.Paint = (w, h) => {
            const state = this.state;
            const selected = state?.Snapshot?.Selected[entry.Kind] === entry.ID;
            const color = selected ? this.palette.Accent : this.palette.Panel;
            draw.RoundedBox(this.style === "cs16" ? 0 : 4, 0, 0, w, h, color);
            if (button.IsHovered() && !selected)
                draw.RoundedBox(0, 0, 0, 3, h, this.palette.Accent);
            const textColor = selected ? Color(12, 18, 22) : this.palette.Text;
            this.Text(entry.Name, "Trebuchet18", 14, 10, textColor);
            this.Text(phrase(selected ? "selected" : state?.Pending ? "waiting" : "choose"), "DermaDefault", 14, height - 22,
                selected ? textColor : this.palette.Muted);
        };
        button.DoClick = () => this.actions?.Select(entry.ID);
    }

    Destroy(): void {
        if (this.frame && IsValid(this.frame))
            this.frame.Remove();
        this.frame = undefined;
        this.content = undefined;
        this.actions = undefined;
        this.state = undefined;
    }
}

const palettes: Record<"classic" | "hl2" | "cs16", ZPThemePalette> = {
    classic: { Accent: Color(239, 190, 76), Surface: Color(11, 17, 22, 238), Panel: Color(24, 33, 42, 245),
        Text: Color(238, 242, 245), Muted: Color(156, 174, 187) },
    hl2: { Accent: Color(255, 160, 0), Surface: Color(20, 20, 20, 200), Panel: Color(45, 43, 36, 235),
        Text: Color(255, 218, 154), Muted: Color(195, 174, 140) },
    cs16: { Accent: Color(232, 204, 86), Surface: Color(62, 70, 56, 245), Panel: Color(83, 94, 73, 255),
        Text: Color(230, 230, 214), Muted: Color(181, 190, 165) },
};
for (const id of ["classic", "hl2", "cs16"] as const) {
    ZPThemes.RegisterTheme(id, { Name: "zombieplague.theme" + id, Palette: palettes[id],
        CreateWeaponMenu: () => new WeaponMenuHUD(id, palettes[id]),
        CreateMainMenu: () => ZPCreateMainMenuHUD(palettes[id], id === "cs16"),
        CreateScoreboard: () => ZPCreateScoreboardHUD(palettes[id], id),
        PaintPlayerHUD: (state, palette) => {
            if (id === "classic") ZPPlayerHUDRenderer.PaintClassic(state, palette);
            else if (id === "hl2") ZPPlayerHUDRenderer.PaintHL2(state, palette);
            else ZPPlayerHUDRenderer.PaintCS16(state, palette);
        } });
}
