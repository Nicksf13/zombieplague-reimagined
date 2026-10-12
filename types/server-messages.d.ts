interface ZPServerMessageManager {
    BroadcastMessage(this: ZPServerMessageManager, text: ZPMessageText): void;
    BroadcastColorMessage(this: ZPServerMessageManager, text: ZPMessageText, color: GLuaColor, exclude?: ZPPlayer[]): void;
    BroadcastSound(this: ZPServerMessageManager, path: string, exclude?: ZPPlayer[]): void;
    BroadcastNotifyMessage(this: ZPServerMessageManager, text: ZPMessageText, duration?: number, color?: GLuaColor): void;
    SendMessage(this: ZPServerMessageManager, ply: ZPPlayer, text: ZPMessageText): void;
    SendColorMessage(this: ZPServerMessageManager, ply: ZPPlayer, text: ZPMessageText, color: GLuaColor): void;
    SendConsoleMessage(this: ZPServerMessageManager, ply: ZPPlayer, text: ZPMessageText): void;
    SendPopupMessage(this: ZPServerMessageManager, ply: ZPPlayer, text: ZPMessageText): void;
    SendSound(this: ZPServerMessageManager, ply: ZPPlayer, path: string): void;
    SendNotifyMessage(this: ZPServerMessageManager, ply: ZPPlayer, text: ZPMessageText, duration?: number, color?: GLuaColor): void;
}
