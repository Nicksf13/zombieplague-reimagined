export {};
const phrase = (id: string): string => language.GetPhrase("zombieplague.weaponmenu" + id);
const categories: readonly ZPWeaponMenuCategory[] = ["primary", "secondary", "melee"];
const weaponName = (entry: ZPWeaponMenuEntry): string => entry.NamePhrase ? language.GetPhrase(entry.NamePhrase) : entry.Name;

// Themes consume only state/actions. No networking or gameplay belongs here.
class WeaponMenuHUD implements ZPWeaponMenuPresentation {
    private frame: GLuaPanel | undefined;
    private content: GLuaPanel | undefined;
    private state: ZPWeaponMenuState | undefined;
    private actions: ZPWeaponMenuActions | undefined;
    private search: ZPWeaponSearchEntry | undefined;
    private family: ZPWeaponFamilyCombo | undefined;
    private remember: ZPWeaponRememberCheckbox | undefined;
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
            if (height >= 400) this.Text(phrase("controls"), "DermaDefault", 24, height - 28, this.palette.Muted);
        };
        frame.MakePopup();
        // Keyboard input belongs to the menu while it is open, including search.
        frame.SetKeyboardInputEnabled(true);
        const [width] = frame.GetSize();
        this.Button(frame, "X", width - 52, 18, 30, 30, () => this.actions?.Close());
        const [, height] = frame.GetSize(), filtersY = height < 400 ? 76 : 106;
        this.search = vgui.Create("DTextEntry", frame);
        ZPMenuControls.TextEntry(this.search, this.palette, this.style === "cs16");
        this.search.SetPos(16, filtersY); this.search.SetSize((width - 44) * 0.55, 30);
        this.search.SetPlaceholderText(phrase("search"));
        this.search.SetText(state.Search);
        this.search.OnChange = () => this.actions?.SetSearch(this.search?.GetValue() ?? "");
        // Keep the field alive while filtering so each keystroke preserves focus/caret.
        this.family = vgui.Create("DComboBox", frame);
        ZPMenuControls.ComboBox(this.family, this.palette, this.style === "cs16");
        this.family.SetPos(28 + (width - 44) * 0.55, filtersY); this.family.SetSize((width - 44) * 0.45, 30);
        this.family.SetSortItems(false);
        this.family.OnSelect = (_index, _text, family) => this.actions?.SetFamily(family);
        this.remember = vgui.Create("DCheckBoxLabel", frame);
        this.remember.SetPos(16, height < 400 ? height - 32 : filtersY + 36); this.remember.SetSize(width - 32, 26);
        this.remember.SetText(phrase("remember")); this.remember.SetTextColor(this.palette.Text);
        this.remember.SetTooltip(phrase("rememberhelp"));
        this.remember.OnChange = checked => this.actions?.SetRemember(checked);
        this.Update(state);
    }

    Update(state: ZPWeaponMenuState): void {
        this.state = state;
        const frame = this.frame;
        if (!frame || !IsValid(frame))
            return;
        if (this.search && this.search.GetValue() !== state.Search) this.search.SetText(state.Search);
        this.family?.Clear();
        this.family?.AddChoice(phrase("familyall"), "all");
        for (const family of ["smg", "machinegun", "rifle", "sniper", "shotgun", "pistol", "revolver", "melee", "other"] as const)
            if (state.Snapshot?.Entries.some(entry => entry.Kind === state.Category && entry.Family === family))
                this.family?.AddChoice(phrase("family" + family), family);
        this.family?.SetValue(phrase("family" + state.Family));
        this.remember?.SetChecked(state.Snapshot?.Remember ?? true);
        this.remember?.SetEnabled(state.Snapshot !== undefined && !state.Pending);
        if (this.content && IsValid(this.content))
            this.content.Remove();
        const [width, height] = frame.GetSize();
        const content = vgui.Create("DPanel", frame);
        this.content = content;
        const compact = height < 400, contentY = compact ? 110 : 176;
        content.SetPos(16, contentY);
        content.SetSize(width - 32, height - contentY - 40);
        content.Paint = () => {};
        const w = width - 32, h = height - contentY - 40, footerHeight = compact ? 56 : 90;
        const horizontal = compact || (this.style === "hl2" && height >= 450);
        const categoryWidth = horizontal ? Math.floor((w - 24) / 3) : Math.min(176, w * 0.3);
        categories.forEach((kind, index) => {
            const x = horizontal ? index * (categoryWidth + 12) : 0;
            const y = horizontal ? 0 : index * 62;
            this.Button(content, phrase(kind), x, y, categoryWidth, compact ? 30 : 48,
                () => this.actions?.SetCategory(kind), kind === state.Category);
        });
        const listX = horizontal ? 0 : categoryWidth + 18, listY = horizontal ? (compact ? 38 : 60) : 0;
        const listWidth = w - listX, listHeight = Math.max(40, h - listY - footerHeight - 10);
        const scroll = vgui.Create("DScrollPanel", content);
        scroll.SetPos(listX, listY);
        scroll.SetSize(listWidth, listHeight);
        const query = state.Search.trim().toLowerCase();
        const entries = state.Snapshot?.Entries.filter(entry => entry.Kind === state.Category &&
            (state.Family === "all" || entry.Family === state.Family) && weaponName(entry).toLowerCase().includes(query)) ?? [];
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
            if (current.Snapshot?.Truncated && !compact)
                this.Text(phrase("truncated"), "DermaDefault", 0, compact ? 34 : 46, this.palette.Muted);
        };
        const refresh = this.Button(footer, phrase("refresh"), 0, compact ? 34 : 60,
            Math.min(240, listWidth - 20), compact ? 22 : 28, () => this.actions?.Refresh());
        refresh.SetTooltip(phrase("refreshhelp"));
        // Newly created buttons must not take keyboard focus from gameplay either.
        // New list buttons do not capture input; the persistent search keeps its focus.
        content.SetKeyboardInputEnabled(false);
    }

    private WeaponCard(parent: GLuaPanel, entry: ZPWeaponMenuEntry, index: number, columns: number, width: number): void {
        const button = parent.Add("DButton");
        if (entry.Description) button.SetTooltip(language.GetPhrase(entry.Description));
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
            this.Text(weaponName(entry), "Trebuchet18", 14, 10, textColor);
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
        this.search = undefined; this.family = undefined; this.remember = undefined;
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
