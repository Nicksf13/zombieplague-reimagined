interface ZPBotSafeEditor { Open(this: ZPBotSafeEditor): void; Close(this: ZPBotSafeEditor): void; }
declare const ZPBotSafeEditor: ZPBotSafeEditor;
interface ZPGlobals { ZPBotSafeEditor: ZPBotSafeEditor; }
