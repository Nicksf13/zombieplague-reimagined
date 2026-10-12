export {};
// Only phrase identifiers are translated. Player names and other string arguments
// stay literal, even when they happen to match a localization key.
function localizedText(value: unknown, depth: number = 0): string | undefined {
    const text = ZPClientData.Record(value);
    if (!text || depth > 4 || typeof text.Phrase !== "string" || text.Phrase.length > 128)
        return;
    if (string.sub(text.Phrase, 1, 13) !== "zombieplague.")
        return;
    const phrase = language.GetPhrase(text.Phrase);
    if (text.Arguments === undefined)
        return phrase;
    const argumentsRecord = ZPClientData.Record(text.Arguments);
    if (!argumentsRecord)
        return;
    const count = Object.keys(argumentsRecord).length;
    if (count > 8)
        return;
    const args: (string | number)[] = [];
    for (let index = 1; index <= count; index++) {
        const argument = argumentsRecord[index];
        if (typeof argument === "string" && argument.length <= 4000)
            args.push(argument);
        else if (typeof argument === "number" && argument === argument && Math.abs(argument) !== Infinity)
            args.push(argument);
        else if (typeof argument === "object") {
            const translated = localizedText(argument, depth + 1);
            if (translated === undefined)
                return;
            args.push(translated);
        }
        else
            return;
    }
    // A malformed format in a translation must not break the notification hook.
    const [success, formatted] = pcall(string.format, phrase, ...args);
    return success && typeof formatted === "string" ? formatted : phrase;
}
_G.ZPClientData = {
    Record(this: void, value): Record<string, unknown> | undefined {
        return typeof value === "object" && value !== null ? value as Record<string, unknown> : undefined;
    },
    LocalizedText: localizedText,
};
