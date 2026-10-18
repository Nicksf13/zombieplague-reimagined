/** @noSelf */
declare namespace os { function time(): number; function date(format: string, timestamp?: number): string; }
declare function error(this: void, message: string): never;
