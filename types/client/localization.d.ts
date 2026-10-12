/** @noSelf */
declare namespace language { function GetPhrase(phrase: string): string; }
/** @noSelf */
declare namespace string {
    function lower(text: string): string;
    function sub(text: string, start: number, end?: number): string;
}
declare function pcall<A extends unknown[]>(this: void, action: (this: void, ...args: A) => string,
    ...args: A): LuaMultiReturn<[boolean, unknown]>;
