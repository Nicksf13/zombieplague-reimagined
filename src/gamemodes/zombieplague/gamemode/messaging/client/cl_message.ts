export {};
net.Receive("SendMessage", () => chat.AddText(net.ReadColor(), "[ZP] ", Color(255, 255, 255), net.ReadString()));
net.Receive("SendConsoleMessage", () => print(net.ReadString()));
net.Receive("SendPopupMessage", () => notification.AddLegacy(net.ReadString(), NOTIFY_GENERIC, 5));
net.Receive("SendSound", () => surface.PlaySound(net.ReadString()));
function showNotify(text: string, duration: number, color: GLuaColor): void {
    const notice = vgui.Create("DNotify");
    notice.SetLife(duration);
    notice.SetSize(800, 40);
    notice.SetPos(ScrW() / 2 - 400, 30);
    const label = vgui.Create("DLabel", notice);
    label.Dock(FILL);
    label.SetFont("GModNotify");
    label.SetContentAlignment(5);
    label.SetText(text);
    label.SetColor(color);
    notice.AddItem(label);
}
net.Receive("SendNotifyMessage", () => {
    const duration = net.ReadInt(8), text = net.ReadString(), color = net.ReadColor();
    showNotify(text, duration, color);
});
net.Receive("SendLocalizedMessage", () => {
    const kind = net.ReadString(), text = ZPClientData.LocalizedText(net.ReadTable());
    const color = net.ReadColor(), duration = net.ReadInt(8);
    if (text === undefined)
        return;
    if (kind === "chat")
        chat.AddText(color, "[ZP] ", Color(255, 255, 255), text);
    else if (kind === "console")
        print(text);
    else if (kind === "popup")
        notification.AddLegacy(text, NOTIFY_GENERIC, 5);
    else if (kind === "notify")
        showNotify(text, duration, color);
});
