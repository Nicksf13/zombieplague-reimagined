export {};
type TextSource = string | number | ((this: void) => string | number);
interface Update {
    Component: GLuaPanel;
    ShouldUpdateFunction: ZPActionPredicate;
    UpdateFunction: ZPAction;
}
type ZPActionPredicate = (this: void) => boolean;
let frame: GLuaPanel | undefined;
let updates: Update[] = [];
const centerLabel = (label: GLuaPanel, text: string | number, font: string, x: number, maxWidth: number): void => {
    const [measured] = HudManager.CalculateTextSize(tostring(text), font), width = Math.min(measured, maxWidth);
    label.SetSize(width, 25);
    label.SetPos(x + (maxWidth - width) / 2, 0);
    label.SetText(tostring(text));
};
const label = (source: TextSource, font: string, color: GLuaColor, x: number, maxWidth: number): GLuaPanel => {
    const panel = vgui.Create("DLabel");
    if (typeof source === "function")
        updates.push({ Component: panel, ShouldUpdateFunction: () => true, UpdateFunction: () => centerLabel(panel, source(), font, x, maxWidth) });
    centerLabel(panel, typeof source === "function" ? source() : source, font, x, maxWidth);
    panel.SetFont(font);
    panel.SetColor(color);
    return panel;
};
const playerLine = (values: readonly TextSource[], muted: ZPClientPlayer | undefined, color: GLuaColor): GLuaPanel => {
    const panel = vgui.Create("DPanel");
    panel.SetSize(600, 20);
    panel.Paint = function (): void { };
    const positions = [[0, 190], [200, 80], [290, 80], [380, 70], [460, 80]] as const;
    positions.forEach(([x, width], index) => panel.Add(label(values[index] ?? "", "DermaDefault", color, x, width)));
    if (muted && IsValid(muted) && muted !== LocalPlayer()) {
        const button = vgui.Create("DButton");
        button.SetSize(20, 20);
        button.SetPos(530, 0);
        button.SetText("");
        const refresh = (): void => button.SetImage(muted.IsMuted() ? "icon16/sound_mute.png" : "icon16/sound.png");
        refresh();
        button.DoClick = function (): void { if (!IsValid(muted))
            return; muted.SetMuted(!muted.IsMuted()); refresh(); };
        button.Paint = function (): void { };
        panel.Add(button);
    }
    return panel;
};
const createTeam = (teamID: number): GLuaPanel => {
    const panel = vgui.Create("DPanel");
    panel.Paint = function (): void { };
    let height = 0;
    const add = (child: GLuaPanel): void => { child.SetPos(0, height); const [, h] = child.GetSize(); panel.Add(child); height += h; };
    const phrase = teamID === TEAM_HUMANS ? "ScoreBoardTitleHumans" : teamID === TEAM_ZOMBIES ? "ScoreBoardTitleZombies" : "ScoreBoardTitleSpectators";
    const title = vgui.Create("DLabel"), text = language.GetPhrase("zombieplague." + string.lower(phrase));
    title.SetText(text);
    title.SetFont("DermaLarge");
    const [titleWidth, titleHeight] = HudManager.CalculateTextSize(text, "DermaLarge");
    title.SetSize(titleWidth, titleHeight);
    add(title);
    const color = team.GetColor(teamID);
    add(playerLine(["ScoreBoardHeaderName", "ScoreBoardHeaderPoints", "ScoreBoardHeaderDeaths", "ScoreBoardHeaderStatus", "ScoreBoardHeaderPing"].map(id => language.GetPhrase("zombieplague." + string.lower(id))), undefined, color));
    const line = vgui.Create("DPanel");
    line.SetSize(560, 2);
    line.Paint = function (width, h): void { HudManager.CreateBox(0, 2, undefined, color, 0, 0, width, h); };
    add(line);
    const players = team.GetPlayers(teamID) as ZPClientPlayer[];
    players.sort((a, b) => b.GetPoints() - a.GetPoints());
    for (const ply of players)
        if (IsValid(ply))
            add(playerLine([
                () => IsValid(ply) ? ply.Name() : "", () => IsValid(ply) ? ply.GetPoints() : "", () => IsValid(ply) ? ply.Deaths() : "",
                () => !IsValid(ply) ? "" : language.GetPhrase("zombieplague." + string.lower(ply.Team() === TEAM_SPECTATOR ? "ScoreBoardStatusSpectating" : ply.Alive() ? "ScoreBoardStatusAlive" : "ScoreBoardStatusDead")),
                () => IsValid(ply) ? ply.Ping() : "",
            ], ply, color));
    panel.SetSize(600, height);
    return panel;
};
GM.ScoreboardShow = function (): void {
    if (frame && IsValid(frame))
        frame.Close();
    updates = [];
    frame = vgui.Create("DFrame");
    frame.SetDraggable(false);
    frame.ShowCloseButton(false);
    frame.SetDeleteOnClose(true);
    frame.SetTitle("");
    frame.SetSize(600, 600);
    frame.Center();
    frame.Paint = function (width, height): void { HudManager.CreateBox(0, 2, Color(0, 0, 0, 0), Color(0, 0, 0, 250), 0, 0, width, height); };
    const scroll = vgui.Create("DScrollPanel", frame);
    scroll.SetPos(0, 20);
    scroll.SetSize(600, 560);
    scroll.Paint = function (): void { };
    const counts: Record<number, number> = {};
    const fill = (): void => {
        updates = updates.filter(update => update.Component === scroll);
        scroll.Clear();
        let y = 0;
        for (const teamID of [TEAM_HUMANS, TEAM_ZOMBIES, TEAM_SPECTATOR]) {
            counts[teamID] = team.GetPlayers(teamID).length;
            if (counts[teamID] === 0)
                continue;
            const panel = createTeam(teamID);
            panel.SetPos(20, y);
            scroll.Add(panel);
            const [, h] = panel.GetSize();
            y += h + (teamID === TEAM_SPECTATOR ? 0 : 10);
        }
    };
    fill();
    updates.push({ Component: scroll, ShouldUpdateFunction: () => [TEAM_HUMANS, TEAM_ZOMBIES, TEAM_SPECTATOR].some(id => counts[id] !== team.GetPlayers(id).length), UpdateFunction: fill });
    frame.MakePopup();
    timer.Create("ScoreBoardUpdater", 1, 0, () => {
        updates = updates.filter(update => IsValid(update.Component));
        for (const update of [...updates])
            if (IsValid(update.Component) && update.ShouldUpdateFunction())
                update.UpdateFunction();
    });
};
GM.ScoreboardHide = function (): void {
    updates = [];
    timer.Destroy("ScoreBoardUpdater");
    if (frame && IsValid(frame))
        frame.Close();
    frame = undefined;
};
