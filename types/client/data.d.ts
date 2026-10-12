interface ZPClientData {
    Record(this: void, value: unknown): Record<string, unknown> | undefined;
    LocalizedText(this: void, value: unknown): string | undefined;
}
interface ZPGlobals { ZPClientData: ZPClientData; }
declare const ZPClientData: ZPClientData;
/** @noSelf */
declare namespace util {
    function JSONToTable(json: string): unknown;
    function TableToJSON(value: object, pretty?: boolean): string;
}
declare function pairs<T>(this: void, value: Record<string, T>): LuaIterable<LuaMultiReturn<[string, T]>>;
