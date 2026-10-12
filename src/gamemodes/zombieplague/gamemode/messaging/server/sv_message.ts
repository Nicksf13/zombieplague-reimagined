AddCSLuaFile("cl_message.lua");
export class ServerMessageManager implements ZPServerMessageManager {
    BroadcastMessage(text: ZPMessageText): void {
        for (const ply of player.GetAll())
            this.SendMessage(ply, text);
    }
    BroadcastColorMessage(text: ZPMessageText, color: GLuaColor, exclude?: ZPPlayer[]): void {
        for (const ply of player.GetAll()) {
            if (!exclude || !exclude.includes(ply))
                this.SendColorMessage(ply, text, color);
        }
    }
    BroadcastSound(path: string, exclude?: ZPPlayer[]): void {
        for (const ply of player.GetAll()) {
            if (!exclude || !exclude.includes(ply))
                this.SendSound(ply, path);
        }
    }
    BroadcastNotifyMessage(text: ZPMessageText, duration?: number, color?: GLuaColor): void {
        for (const ply of player.GetAll())
            this.SendNotifyMessage(ply, text, duration, color);
    }
    SendMessage(ply: ZPPlayer, text: ZPMessageText): void {
        this.SendColorMessage(ply, text, Color(255, 255, 255));
    }
    SendColorMessage(ply: ZPPlayer, text: ZPMessageText, color: GLuaColor): void {
        if (typeof text !== "string")
            return this.SendLocalized(ply, "chat", text, color);
        net.Start("SendMessage");
        net.WriteColor(color);
        net.WriteString(text);
        net.Send(ply);
    }
    SendConsoleMessage(ply: ZPPlayer, text: ZPMessageText): void {
        if (typeof text !== "string")
            return this.SendLocalized(ply, "console", text);
        net.Start("SendConsoleMessage");
        net.WriteString(text);
        net.Send(ply);
    }
    SendPopupMessage(ply: ZPPlayer, text: ZPMessageText): void {
        if (typeof text !== "string")
            return this.SendLocalized(ply, "popup", text);
        net.Start("SendPopupMessage");
        net.WriteString(text);
        net.Send(ply);
    }
    SendSound(ply: ZPPlayer, path: string): void {
        net.Start("SendSound");
        net.WriteString(path);
        net.Send(ply);
    }
    SendNotifyMessage(ply: ZPPlayer, text: ZPMessageText, duration?: number, color?: GLuaColor): void {
        if (typeof text !== "string")
            return this.SendLocalized(ply, "notify", text, color, duration);
        net.Start("SendNotifyMessage");
        net.WriteInt(duration ?? 5, 8);
        net.WriteString(text);
        net.WriteColor(color ?? Color(255, 255, 255));
        net.Send(ply);
    }
    private SendLocalized(ply: ZPPlayer, kind: "chat" | "console" | "popup" | "notify",
        text: ZPLocalizedText, color: GLuaColor = Color(255, 255, 255), duration: number = 5): void {
        net.Start("SendLocalizedMessage");
        net.WriteString(kind);
        net.WriteTable(text);
        net.WriteColor(color);
        net.WriteInt(duration, 8);
        net.Send(ply);
    }
}
const messageManager = new ServerMessageManager();
// Keep the existing no-self API for callers and addons, including detached callbacks.
_G.BroadcastMessage = (text) => messageManager.BroadcastMessage(text);
_G.BroadcastColorMessage = (text, color, exclude) => messageManager.BroadcastColorMessage(text, color, exclude);
_G.BroadcastSound = (path, exclude) => messageManager.BroadcastSound(path, exclude);
_G.BroadcastNotifyMessage = (text, duration, color) => messageManager.BroadcastNotifyMessage(text, duration, color);
_G.SendMessage = (ply, text) => messageManager.SendMessage(ply, text);
_G.SendColorMessage = (ply, text, color) => messageManager.SendColorMessage(ply, text, color);
_G.SendConsoleMessage = (ply, text) => messageManager.SendConsoleMessage(ply, text);
_G.SendPopupMessage = (ply, text) => messageManager.SendPopupMessage(ply, text);
_G.SendSound = (ply, path) => messageManager.SendSound(ply, path);
_G.SendNotifyMessage = (ply, text, duration, color) => messageManager.SendNotifyMessage(ply, text, duration, color);
for (const name of ["SendMessage", "SendConsoleMessage", "SendPopupMessage", "SendSound", "SendNotifyMessage", "SendLocalizedMessage"]) {
    util.AddNetworkString(name);
}
