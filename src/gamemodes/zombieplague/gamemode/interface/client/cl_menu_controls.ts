export {};

function background(this: void, panel: GLuaPanel, palette: ZPThemePalette, square: boolean,
    width: number, height: number, active: boolean): void {
    const radius = square ? 0 : 4;
    const border = panel.IsEnabled() && (active || panel.IsHovered()) ? palette.Accent : palette.Muted;
    draw.RoundedBox(radius, 0, 0, width, height, border);
    draw.RoundedBox(radius, 1, 1, width - 2, height - 2, palette.Panel);
}

// Keep native editing, selection and menu lifetime. Only presentation is replaced.
_G.ZPMenuControls = {
    ScrollPanel(this: void, panel, palette, square): void {
        const bar = panel.GetVBar(); bar.SetWide(12);
        bar.Paint = (width, height) => { draw.RoundedBox(square ? 0 : 3, 0, 0, width, height, palette.Surface); };
        bar.btnGrip.Paint = (width, height) => { draw.RoundedBox(square ? 0 : 3, 1, 0, width - 2, height,
            !bar.IsEnabled() ? palette.Panel : bar.btnGrip.IsHovered() ? palette.Accent : palette.Muted); };
        for (const [button, glyph] of [[bar.btnUp, "▲"], [bar.btnDown, "▼"]] as const) button.Paint = (width, height) => {
            draw.RoundedBox(square ? 0 : 3, 0, 0, width, height, palette.Panel);
            draw.DrawText(glyph, "DermaDefault", Math.max(0, (width - 10) / 2), Math.max(0, (height - 14) / 2),
                !bar.IsEnabled() ? palette.Muted : button.IsHovered() ? palette.Accent : palette.Text, TEXT_ALIGN_LEFT);
        };
    },
    TextEntry(this: void, entry, palette, square): void {
        entry.SetFont("DermaDefault");
        entry.SetTextInset(8, 0);
        entry.Paint = (width, height) => {
            background(entry, palette, square, width, height, entry.HasFocus());
            const color = entry.IsEnabled() ? palette.Text : palette.Muted;
            entry.DrawTextEntryText(color, palette.Accent, color);
            const placeholder = entry.GetPlaceholderText();
            if (entry.GetValue() === "" && !entry.HasFocus() && placeholder) {
                surface.SetFont("DermaDefault");
                const [, textHeight] = surface.GetTextSize(placeholder);
                draw.DrawText(placeholder, "DermaDefault", 8, (height - textHeight) / 2, palette.Muted, TEXT_ALIGN_LEFT);
            }
        };
    },
    ComboBox(this: void, combo, palette, square): void {
        combo.SetFont("DermaDefault");
        combo.SetTextInset(8, 0);
        combo.Paint = (width, height) => {
            background(combo, palette, square, width, height, combo.IsMenuOpen());
            combo.SetTextColor(combo.IsEnabled() ? palette.Text : palette.Muted);
            return false; // Let DLabel draw the native caption once.
        };
        combo.DropButton.Paint = (width, height) => {
            draw.DrawText("▼", "DermaDefault", Math.max(0, (width - 10) / 2), Math.max(0, (height - 14) / 2),
                !combo.IsEnabled() ? palette.Muted : combo.IsMenuOpen() ? palette.Accent : palette.Text, TEXT_ALIGN_LEFT);
        };
        combo.OnMenuOpened = menu => {
            menu.Paint = (width, height) => {
                draw.RoundedBox(square ? 0 : 4, 0, 0, width, height, palette.Muted);
                draw.RoundedBox(square ? 0 : 4, 1, 1, width - 2, height - 2, palette.Surface);
            };
            for (const option of menu.GetCanvas().GetChildren()) {
                option.SetFont("DermaDefault");
                option.SetTextInset(12, 0);
                option.Paint = (width, height) => {
                    const hovered = option.IsEnabled() && option.IsHovered();
                    draw.RoundedBox(0, 1, 0, width - 2, height, hovered ? palette.Accent : palette.Surface);
                    if (!hovered && option.GetText() === combo.GetText())
                        draw.RoundedBox(0, 1, 0, 3, height, palette.Accent);
                    option.SetTextColor(!option.IsEnabled() ? palette.Muted : hovered ? Color(12, 18, 22) : palette.Text);
                    return false;
                };
            }
        };
    },
};
