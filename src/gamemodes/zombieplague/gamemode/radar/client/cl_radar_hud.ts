function tint(this: void, color: GLuaColor, alpha: number, special = false): GLuaColor {
    const brightness = special ? 0.75 : 1;
    return Color(Math.floor(color.r * brightness), Math.floor(color.g * brightness), Math.floor(color.b * brightness), Math.floor(alpha * color.a));
}
function roleLabel(this: void, x: number, y: number, color: GLuaColor, role: ZPRadarSpecialRole): void {
    const text = language.GetPhrase(role === "survivor" ? "zombieplague.radarsurvivormarker" : "zombieplague.radarnemesismarker");
    surface.SetFont("DermaDefaultBold");
    const [width, height] = surface.GetTextSize(text);
    draw.DrawText(text, "DermaDefaultBold", x - width / 2, y - height / 2, color, TEXT_ALIGN_LEFT);
}
function roleColor(this: void, role: ZPRadarSpecialRole): GLuaColor {
    return role === "survivor" ? HUMANS_COLOR : NEMESIS_COLOR;
}
function marker(this: void, x: number, y: number, elevation: -1 | 0 | 1, color: GLuaColor, role?: ZPRadarSpecialRole): void {
    if (role) {
        roleLabel(x, y, color, role);
        if (elevation === 0) return;
        x += 12;
    }
    if (elevation === 0) {
        draw.RoundedBox(4, x - 4, y - 4, 8, 8, color);
        return;
    }
    draw.NoTexture(); surface.SetDrawColor(color.r, color.g, color.b, color.a);
    surface.DrawPoly([{ x, y: y - elevation * 6 }, { x: x + elevation * 5, y: y + elevation * 4 },
        { x: x - elevation * 5, y: y + elevation * 4 }]);
}

export function paintRadar(this: void, overview: ZPRadarOverview, material: GLuaMaterial, state: ZPRadarSnapshot,
    position: ZPRadarPosition, yaw: number, palette: ZPThemePalette, theme: string, layerIndex?: number,
    special: boolean | ZPRadarSpecialRole = false): void {
    const layer = layerIndex === undefined ? undefined : overview.Layers?.[layerIndex];
    const size = Math.floor(Math.min(240, ScrW() * 0.23, ScrH() * 0.3)), x = 18, y = 92, padding = 8;
    const radius = theme === "cs16" || theme === "hl2" ? 0 : 8;
    draw.RoundedBox(radius, x, y, size + padding * 2, size + 54, palette.Surface);
    draw.RoundedBox(0, x, y, size + padding * 2, 3, palette.Accent);
    surface.SetDrawColor(255, 255, 255, 235); surface.SetMaterial(material);
    surface.DrawTexturedRect(x + padding, y + padding, size, size);
    const screen = (pos: ZPRadarPosition): { x: number; y: number } | undefined => {
        const point = ZPRadarRules.Point(overview, pos);
        if (point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) return;
        return { x: x + padding + Math.max(0.02, Math.min(0.98, point.x)) * size,
            y: y + padding + Math.max(0.02, Math.min(0.98, point.y)) * size };
    };
    for (const contact of state.Contacts) {
        if (contact.Expires <= CurTime()) continue;
        const point = screen(contact.Position);
        if (!point) continue;
        const ally = contact.Source === "ally";
        const alpha = ally ? 1 : Math.max(0, Math.min(1,
            (contact.Expires - CurTime()) / Math.max(0.01, contact.Expires - contact.Created)));
        const perceivedTeam = ally ? state.Team : state.Team === TEAM_HUMANS ? TEAM_ZOMBIES : TEAM_HUMANS;
        const role = contact.Role ?? (contact.Special ? perceivedTeam === TEAM_HUMANS ? "survivor" : "nemesis" : undefined);
        const color = tint(role ? roleColor(role) : perceivedTeam === TEAM_HUMANS ? HUMANS_COLOR : ZOMBIES_COLOR, alpha, role !== undefined);
        // Enemy height comes only from its saved sample, even when the target moves silently.
        marker(point.x, point.y, ZPRadarRules.Elevation(layer, contact.Position.z, position.z), color, role);
    }
    const own = screen(position);
    if (own) {
        // World +Y points north/up on the overview; yaw zero points east/right.
        const angle = -yaw * Math.PI / 180, forward = { x: Math.cos(angle), y: Math.sin(angle) };
        const role = typeof special === "string" ? special : special ? state.Team === TEAM_HUMANS ? "survivor" : "nemesis" : undefined;
        const color = tint(role ? roleColor(role) : state.Team === TEAM_HUMANS ? HUMANS_COLOR : ZOMBIES_COLOR, 1, role !== undefined);
        draw.NoTexture(); surface.SetDrawColor(color.r, color.g, color.b, color.a);
        surface.DrawPoly([
            { x: own.x + forward.x * 9, y: own.y + forward.y * 9 },
            { x: own.x - forward.x * 5 - forward.y * 5, y: own.y - forward.y * 5 + forward.x * 5 },
            { x: own.x - forward.x * 5 + forward.y * 5, y: own.y - forward.y * 5 - forward.x * 5 },
        ]);
        if (role) roleLabel(own.x, own.y - 16, color, role);
    }
    const remaining = Math.max(0, state.ScanUntil - CurTime());
    if (remaining > 0) {
        // A bounded sweep over the map communicates scanning without positional audio.
        const sweep = (CurTime() % 1) * size;
        draw.RoundedBox(0, x + padding + sweep, y + padding, 2, size, tint(palette.Accent, 0.4));
    }
    const label = remaining > 0 ? string.format(language.GetPhrase("zombieplague.radarscanning"), Math.ceil(remaining)) :
        language.GetPhrase("zombieplague.radartitle");
    draw.DrawText(label, "Trebuchet18", x + padding, y + size + 15, palette.Text, TEXT_ALIGN_LEFT);
    if (layerIndex !== undefined && overview.Layers)
        draw.DrawText(string.format(language.GetPhrase("zombieplague.radarlevel"), layerIndex + 1, overview.Layers.length),
            "DermaDefault", x + padding, y + size + 36, palette.Muted, TEXT_ALIGN_LEFT);
}
