export {};
const phrase = (key: string): string => language.GetPhrase("zombieplague.mapvote" + key);

class MapVoteHUD implements ZPMapVotePresentation {
    private frame: GLuaPanel | undefined;
    private images: Record<string, GLuaMaterial | false | undefined> = {};
    constructor(private palette: ZPThemePalette, private square: boolean) {}

    private Thumbnail(map: string): GLuaMaterial | false {
        const cached = this.images[map];
        if (cached !== undefined) return cached;
        // Native map icons can live outside materials/. Load once, never during Paint.
        for (const path of ["maps/thumb/" + map + ".png", "maps/thumb/" + map + ".jpg",
            "materials/maps/" + map + ".png", "materials/maps/" + map + ".vmt"]) {
            if (!file.Exists(path, "GAME")) continue;
            const material = Material(path.startsWith("materials/") ? string.sub(path, 11) : path);
            if (!material.IsError()) { this.images[map] = material; return material; }
        }
        this.images[map] = false;
        return false;
    }

    Open(actions: ZPMapVoteController): void {
        const frame = vgui.Create("DFrame"); this.frame = frame;
        frame.SetTitle(""); frame.ShowCloseButton(false); frame.SetDraggable(false); frame.SetDeleteOnClose(true);
        frame.SetSize(Math.min(960, ScrW() - 32), Math.min(660, ScrH() - 64)); frame.Center();
        frame.Paint = (w, h) => {
            draw.RoundedBox(this.square ? 0 : 8, 0, 0, w, h, this.palette.Surface);
            draw.RoundedBox(0, 0, 0, w, 3, this.palette.Accent);
            draw.DrawText(phrase("title"), "DermaLarge", 20, 18, this.palette.Text, TEXT_ALIGN_LEFT);
            const snapshot = actions.GetSnapshot();
            const status = snapshot?.Voting ? string.format(phrase("remaining"), actions.GetRemaining()) :
                string.format(phrase("winner"), snapshot?.Entries.find(entry => entry.Map === snapshot.Winner)?.Extend ? phrase("extend") : snapshot?.Winner ?? "");
            draw.DrawText(status, "Trebuchet18", 20, 55, this.palette.Accent, TEXT_ALIGN_LEFT);
            draw.DrawText(phrase("help"), "DermaDefault", 20, h - 44, this.palette.Muted, TEXT_ALIGN_LEFT);
            draw.DrawText(phrase("nominatehelp"), "DermaDefault", 20, h - 26, this.palette.Muted, TEXT_ALIGN_LEFT);
        };
        const [w, h] = frame.GetSize();
        const close = vgui.Create("DButton", frame);
        close.SetText(""); close.SetPos(w - 50, 16); close.SetSize(30, 30);
        close.Paint = (width, height) => {
            draw.RoundedBox(this.square ? 0 : 4, 0, 0, width, height, close.IsHovered() ? this.palette.Accent : this.palette.Panel);
            draw.DrawText("X", "Trebuchet18", 9, 5, close.IsHovered() ? Color(12, 18, 22) : this.palette.Text, TEXT_ALIGN_LEFT);
        };
        close.DoClick = () => actions.Close();
        const scroll = vgui.Create("DScrollPanel", frame);
        scroll.SetPos(20, 88); scroll.SetSize(w - 40, Math.max(40, h - 146));
        const columns = w >= 800 ? 2 : 1, width = Math.floor((w - 60 - (columns - 1) * 10) / columns);
        actions.GetSnapshot()?.Entries.forEach((entry, index) => {
            const button = scroll.Add("DButton"), image = this.Thumbnail(entry.Map);
            button.SetText(""); button.SetPos((index % columns) * (width + 10), Math.floor(index / columns) * 94);
            button.SetSize(width, 84); button.SetTooltip(entry.Map);
            button.Paint = (bw, bh) => {
                const snapshot = actions.GetSnapshot();
                const current = snapshot?.Entries.find(item => item.Map === entry.Map);
                const votes = current?.Votes ?? 0, total = snapshot?.Entries.reduce((sum, item) => sum + item.Votes, 0) ?? 0;
                const best = Math.max(0, ...(snapshot?.Entries.map(item => item.Votes) ?? []));
                const selected = snapshot?.Selected === entry.Map, leading = votes > 0 && votes === best;
                const enabled = snapshot?.Voting === true && actions.GetRemaining() > 0;
                button.SetEnabled(enabled);
                draw.RoundedBox(this.square ? 0 : 4, 0, 0, bw, bh, this.palette.Panel);
                if (selected || leading || (enabled && button.IsHovered())) draw.RoundedBox(0, 0, 0, 3, bh, this.palette.Accent);
                if (image) {
                    surface.SetDrawColor(255, 255, 255, 255); surface.SetMaterial(image); surface.DrawTexturedRect(10, 10, 64, 64);
                }
                else {
                    draw.RoundedBox(this.square ? 0 : 4, 10, 10, 64, 64, this.palette.Surface);
                    draw.DrawText("?", "DermaLarge", 33, 26, this.palette.Muted, TEXT_ALIGN_LEFT);
                }
                const label = entry.Extend ? phrase("extend") : entry.Map;
                surface.SetFont("Trebuchet18");
                let clipped = label;
                while (clipped.length > 1 && surface.GetTextSize(clipped + (clipped !== label ? "…" : ""))[0] > bw - 100)
                    clipped = clipped.substring(0, clipped.length - 1);
                draw.DrawText(clipped + (clipped !== label ? "…" : ""), "Trebuchet18", 86, 8, enabled ? this.palette.Text : this.palette.Muted, TEXT_ALIGN_LEFT);
                draw.DrawText(string.format(phrase("votes"), votes), "DermaDefault", 86, 32, this.palette.Muted, TEXT_ALIGN_LEFT);
                draw.DrawText(snapshot?.Winner === entry.Map ? phrase("won") : selected ? phrase("selected") : leading ? phrase("leading") : "",
                    "DermaDefault", 86, 50, this.palette.Accent, TEXT_ALIGN_LEFT);
                draw.RoundedBox(0, 86, 72, bw - 100, 4, this.palette.Surface);
                draw.RoundedBox(0, 86, 72, total > 0 ? (bw - 100) * votes / total : 0, 4, this.palette.Accent);
            };
            button.DoClick = () => actions.Select(entry.Map);
        });
        frame.MakePopup(); frame.SetKeyboardInputEnabled(false);
    }
    Destroy(): void { if (this.frame && IsValid(this.frame)) this.frame.Remove(); this.frame = undefined; }
}
_G.ZPCreateMapVoteHUD = (palette, square) => new MapVoteHUD(palette, square);
