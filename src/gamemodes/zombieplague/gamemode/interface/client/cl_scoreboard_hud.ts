export class ScoreboardHUD implements ZPScoreboardPresentation {
    private frame: GLuaPanel | undefined;
    private content: GLuaPanel | undefined;
    private state: ZPScoreboardState | undefined;
    private actions: ZPScoreboardActions | undefined;
    private players: Record<number, ZPScoreboardPlayer | undefined> = {};
    private signature: string = "";
    private dropdown: ZPScoreboardDropdown | undefined;
    constructor(private palette: ZPThemePalette, private style: ZPScoreboardStyle) {}

    private Radius(): number { return this.style === "cs16" ? 0 : this.style === "hl2" ? 8 : 4; }
    private Text(text: string, font: string, x: number, y: number, color: GLuaColor): void {
        draw.DrawText(text, font, x, y, color, TEXT_ALIGN_LEFT);
    }

    Open(state: ZPScoreboardState, actions: ZPScoreboardActions): void {
        this.actions = actions;
        const frame = vgui.Create("DFrame");
        this.frame = frame;
        frame.SetTitle("");
        frame.ShowCloseButton(false);
        frame.SetDraggable(false);
        frame.SetDeleteOnClose(true);
        frame.Paint = (width, height) => {
            draw.RoundedBox(this.Radius(), 0, 0, width, height, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, width, this.style === "cs16" ? 28 : 3,
                this.style === "cs16" ? this.palette.Panel : this.palette.Accent);
            this.Text("ZOMBIE PLAGUE", "Trebuchet18", 24, 20, this.palette.Accent);
            this.Text(language.GetPhrase("zombieplague.scoreboardtitle"), "DermaLarge", 24, 46, this.palette.Text);
            const count = this.state?.Teams.reduce((total, group) => total + group.Players.length, 0) ?? 0;
            this.Text(language.GetPhrase("zombieplague.scoreboardplayers") + ": " + count, "DermaDefault", width - 122, 54, this.palette.Muted);
            this.Text(language.GetPhrase("zombieplague.scoreboardcontrols"), "DermaDefault", 24, height - 26, this.palette.Muted);
        };
        frame.MakePopup();
        this.Update(state);
    }

    Update(state: ZPScoreboardState): void {
        const resized = state.Width !== this.state?.Width || state.Height !== this.state?.Height;
        this.state = state;
        this.players = {};
        for (const group of state.Teams)
            for (const entry of group.Players)
                this.players[entry.ID] = entry;
        const frame = this.frame;
        if (!frame || !IsValid(frame))
            return;
        if (resized) {
            frame.SetSize(Math.min(this.style === "cs16" ? 800 : 920, state.Width - 32), Math.min(620, state.Height - 180));
            frame.Center();
        }
        const signature = state.Teams.map(group => group.ID + ":" + group.Players.map(entry => entry.ID).join(",")).join("|");
        // Live values paint from the new snapshot; preserve the list and scroll on ordinary updates.
        if (!resized && signature === this.signature)
            return;
        this.signature = signature;
        this.content?.Remove();
        const [width, height] = frame.GetSize();
        const content = vgui.Create("DScrollPanel", frame);
        this.content = content;
        content.SetPos(24, 96);
        content.SetSize(width - 48, height - 136);
        const rowWidth = width - 68, rowHeight = this.style === "cs16" ? 28 : 34;
        let y = 0;
        for (const group of state.Teams) {
            if (group.Players.length === 0)
                continue;
            const heading = content.Add("DPanel");
            heading.SetPos(0, y);
            heading.SetSize(rowWidth, 28);
            heading.Paint = () => {
                this.Text(language.GetPhrase(group.Label) + "  (" + group.Players.length + ")", "Trebuchet24", 4, 2, this.palette.Accent);
            };
            y += 30;
            const header = content.Add("DPanel");
            header.SetPos(0, y);
            header.SetSize(rowWidth, 24);
            header.Paint = (w, h) => draw.RoundedBox(0, 0, 0, w, h, this.palette.Panel);
            const labels = ["name", "points", "deaths", "status", "ping", "sound"];
            this.Columns(rowWidth).forEach((column, index) => this.Cell(header,
                () => language.GetPhrase("zombieplague.scoreboardheader" + labels[index]), column.X, column.Width, 24, this.palette.Muted, index > 0));
            y += 26;
            group.Players.forEach((entry, index) => this.Row(content, entry.ID, y + index * (rowHeight + 4), rowWidth, rowHeight));
            y += group.Players.length * (rowHeight + 4) + 4;
        }
        if (y === 0)
            this.Cell(content, () => language.GetPhrase("zombieplague.scoreboardempty"), 0, rowWidth, 30, this.palette.Muted, false);
        frame.SetKeyboardInputEnabled(false);
    }

    private Columns(width: number): { X: number; Width: number; }[] {
        let x = 12;
        return [width - 380, 64, 64, 100, 52, 36].map(size => {
            const column = { X: x, Width: size };
            x += size + 8;
            return column;
        });
    }

    private Cell(parent: GLuaPanel, text: (this: void) => string, x: number, width: number, height: number,
        color: GLuaColor, centered: boolean, clicked?: ZPAction, rightClicked?: ZPAction): void {
        const cell = parent.Add(clicked ? "DButton" : "DPanel");
        if (clicked) {
            cell.SetText("");
            cell.DoClick = () => clicked();
        }
        if (rightClicked) {
            if (clicked) cell.DoRightClick = () => rightClicked();
            else cell.OnMousePressed = button => { if (button === MOUSE_RIGHT) rightClicked(); };
        }
        cell.SetPos(x, 0);
        cell.SetSize(width, height);
        // Separate cells clip long names/translations before they reach another column.
        cell.Paint = () => {
            const value = text().split("\n").join(" ").split("\r").join(" ");
            surface.SetFont("DermaDefault");
            const [measured] = surface.GetTextSize(value);
            this.Text(value, "DermaDefault", centered ? Math.max(0, (width - measured) / 2) : 0,
                Math.floor((height - 16) / 2), color);
        };
    }

    private Row(parent: GLuaPanel, id: number, y: number, width: number, height: number): void {
        const row = parent.Add("DPanel");
        row.SetPos(0, y);
        row.SetSize(width, height);
        row.OnMousePressed = button => { if (button === MOUSE_RIGHT) this.OpenPlayerMenu(id); };
        row.Paint = (w, h) => {
            draw.RoundedBox(this.Radius(), 0, 0, w, h, this.palette.Panel);
            if (this.players[id]?.Local)
                draw.RoundedBox(0, 0, 0, 3, h, this.palette.Accent);
        };
        const values: ((this: void) => string)[] = [
            () => this.players[id]?.Name ?? "",
            () => tostring(this.players[id]?.Points ?? 0),
            () => tostring(this.players[id]?.Deaths ?? 0),
            () => language.GetPhrase("zombieplague.scoreboardstatus" + (this.players[id]?.Status ?? "dead")),
            () => tostring(this.players[id]?.Ping ?? 0),
        ];
        const columns = this.Columns(width);
        values.forEach((value, index) => {
            const column = columns[index];
            if (column)
                this.Cell(row, value, column.X, column.Width, height, this.palette.Text, index > 0,
                    index === 0 ? () => this.OpenPlayerMenu(id) : undefined, () => this.OpenPlayerMenu(id));
        });
        const sound = columns[5];
        if (sound && this.players[id]?.CanMute) {
            const button = row.Add("DButton");
            button.SetText("");
            button.SetPos(sound.X, 4);
            button.SetSize(sound.Width, height - 8);
            button.SetTooltip(language.GetPhrase("zombieplague.scoreboardmutetoggle"));
            button.Paint = (w, h) => {
                const muted = this.players[id]?.Muted;
                const highlighted = muted || button.IsHovered();
                draw.RoundedBox(this.Radius(), 0, 0, w, h, highlighted ? this.palette.Accent : this.palette.Surface);
                const label = muted ? "OFF" : "ON";
                surface.SetFont("DermaDefault");
                const [textWidth, textHeight] = surface.GetTextSize(label);
                this.Text(label, "DermaDefault", (w - textWidth) / 2, (h - textHeight) / 2,
                    highlighted ? Color(12, 18, 22) : this.palette.Text);
            };
            button.DoClick = () => this.actions?.ToggleMute(id);
            button.DoRightClick = () => this.OpenPlayerMenu(id);
        }
    }

    private OpenPlayerMenu(id: number): void {
        this.dropdown?.Remove();
        const entry = this.players[id];
        if (!entry)
            return;
        const menu = DermaMenu();
        this.dropdown = menu;
        ZPMenuControls.Menu(menu, this.palette, this.Radius());
        const profile = menu.AddOption(language.GetPhrase("zombieplague.scoreboardviewprofile"),
            () => this.actions?.ViewProfile(id));
        profile.SetEnabled(entry.CanViewProfile);
        ZPMenuControls.MenuOption(profile, this.palette);
        const add = (key: string, role: ZPAdminPlayerRole): void => {
            const option = menu.AddOption(language.GetPhrase("zombieplague." + key), () => this.actions?.TransformPlayer(id, role));
            ZPMenuControls.MenuOption(option, this.palette);
        };
        if (entry.CanInfect) add("adminmakezombie", "zombie");
        if (entry.CanStartSpecial) {
            add("adminmakenemesis", "nemesis");
            add("adminmakesurvivor", "survivor");
        }
        menu.Open();
    }

    Destroy(): void {
        this.dropdown?.Remove();
        this.dropdown = undefined;
        this.frame?.Remove();
        this.frame = undefined;
        this.content = undefined;
        this.players = {};
        this.actions = undefined;
    }
}
_G.ZPCreateScoreboardHUD = (palette, style) => new ScoreboardHUD(palette, style);
