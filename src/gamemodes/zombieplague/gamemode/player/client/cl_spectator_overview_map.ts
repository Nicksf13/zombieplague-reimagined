interface Marker { Contact: ZPSpectatorContact; X: number; Y: number; }

export function markers(this: void, overview: ZPRadarOverview, state: ZPSpectatorSnapshot, size: number): Marker[] {
    const points: Marker[] = [];
    for (const contact of state.Contacts) {
        const point = ZPRadarRules.Point(overview, contact.Position);
        if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) continue;
        points.push({ Contact: contact, X: Math.max(10, Math.min(size - 10, point.x * size)),
            Y: Math.max(10, Math.min(size - 10, point.y * size)) });
    }
    return points;
}

export function hit(this: void, points: readonly Marker[], x: number, y: number): number | undefined {
    let best: number | undefined, distance = 18 * 18;
    for (const point of points) {
        const squared = (point.X - x) ** 2 + (point.Y - y) ** 2;
        if (squared < distance) { best = point.Contact.ID; distance = squared; }
    }
    return best;
}

export function paint(this: void, overview: ZPRadarOverview, state: ZPSpectatorSnapshot, size: number,
    palette: ZPThemePalette, layer: number | undefined, hovered: number | undefined): void {
    const material = ZPRadar.GetMaterial(layer);
    if (!material) return;
    surface.SetDrawColor(255, 255, 255, 255); surface.SetMaterial(material); surface.DrawTexturedRect(0, 0, size, size);
    for (const { Contact: contact, X: x, Y: y } of markers(overview, state, size)) {
        const elevation = ZPRadarRules.Elevation(layer === undefined ? undefined : overview.Layers?.[layer], contact.Position.z);
        const base = contact.Role === "nemesis" ? NEMESIS_COLOR : contact.Team === TEAM_HUMANS ? HUMANS_COLOR : ZOMBIES_COLOR;
        const color = Color(base.r, base.g, base.b, elevation === 0 ? 255 : 140);
        const angle = -contact.Yaw * Math.PI / 180, dx = Math.cos(angle), dy = Math.sin(angle);
        draw.RoundedBox(7, x - 7, y - 7, 14, 14, hovered === contact.ID ? palette.Accent : palette.Panel);
        draw.RoundedBox(4, x - 4, y - 4, 8, 8, color);
        draw.NoTexture(); surface.SetDrawColor(color.r, color.g, color.b, color.a);
        surface.DrawPoly([{ x: x + dx * 15, y: y + dy * 15 },
            { x: x + dx * 6 - dy * 4, y: y + dy * 6 + dx * 4 },
            { x: x + dx * 6 + dy * 4, y: y + dy * 6 - dx * 4 }]);
        if (contact.Role) draw.DrawText(language.GetPhrase(contact.Role === "nemesis" ?
            "zombieplague.radarnemesismarker" : "zombieplague.radarsurvivormarker"), "DermaDefaultBold", x - 4, y - 24, color, TEXT_ALIGN_LEFT);
        if (elevation !== 0) draw.DrawText(elevation > 0 ? "▲" : "▼", "DermaDefault", x + 10, y - 7, color, TEXT_ALIGN_LEFT);
        let name = contact.Name;
        surface.SetFont("DermaDefault");
        while (name.length > 1 && surface.GetTextSize(name)[0] > Math.min(160, size - 8)) name = name.substring(0, name.length - 1);
        const [width] = surface.GetTextSize(name);
        const labelX = Math.max(4, Math.min(size - width - 4, x - width / 2)), labelY = Math.min(size - 18, y + 16);
        draw.RoundedBox(2, labelX - 2, labelY, width + 4, 16, Color(palette.Surface.r, palette.Surface.g, palette.Surface.b, 220));
        draw.DrawText(name, "DermaDefault", labelX, labelY, elevation === 0 ? palette.Text : palette.Muted, TEXT_ALIGN_LEFT);
    }
}
