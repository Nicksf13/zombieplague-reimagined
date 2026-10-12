// The server sends phrase identifiers, never a dictionary or a selected locale.
interface ZPLocalizedText {
    Phrase: string;
    Arguments?: (string | number | ZPLocalizedText)[];
}
type ZPMessageText = string | ZPLocalizedText;
