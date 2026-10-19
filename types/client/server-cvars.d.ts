interface ZPServerCvarClientState {
    readonly Category: number; readonly Values: readonly string[]; readonly Available: readonly boolean[];
    readonly Ready: boolean; readonly Pending: boolean; readonly Dirty: boolean; readonly Feedback: string; readonly CanEdit: boolean;
    readonly ReloadRequired: boolean; readonly CanReload: boolean;
}
interface ZPServerCvarActions {
    OpenCvars(this: ZPServerCvarActions, category: number): void;
    SetCvar(this: ZPServerCvarActions, index: number, value: string): void;
    SaveCvars(this: ZPServerCvarActions): void;
    RefreshCvars(this: ZPServerCvarActions): void;
}
