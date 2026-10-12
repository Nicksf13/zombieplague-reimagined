export class AmmoPackBank implements ZPBank {
    BankStorageType: string = "text";
    AmmoPacksStorage: Record<string, number> = {};
    Time: number = 5;
    ShouldSaveAmmoPacks: boolean = true;
    SetPlayerAmmoPacks(ply: ZPServerPlayer, amount: number): void {
        this.AmmoPacksStorage[ply.SteamID64()] = amount;
    }
    // Hooks and timers receive this callback without a Lua self argument.
    Save: ZPBank["Save"] = (): void => {
        const storage = this.BankStorageSource;
        if (!storage)
            return;
        for (const [id, amount] of pairs(this.AmmoPacksStorage)) {
            const [success, error] = pcall(storage.Save, id, amount);
            if (success)
                delete this.AmmoPacksStorage[id];
            else if (error !== undefined) {
                print("Error on ammo pack saving:");
                print(error);
            }
        }
    };
    GiveTakeAmmoPacks(requester: ZPServerPlayer, target: ZPServerPlayer | undefined, give: boolean, amount: number | undefined): void {
        if (!requester.IsSuperAdmin()) {
            SendPopupMessage(requester, { Phrase: "zombieplague.commandnotaccess" });
        }
        else if (!target) {
            SendPopupMessage(requester, { Phrase: "zombieplague.ammopackgiveplynotfound" });
        }
        else if (amount === undefined || amount <= 0) {
            SendPopupMessage(requester, { Phrase: "zombieplague.ammopackgiveinvalidamount" });
        }
        else {
            if (give)
                target.GiveAmmoPacks(amount);
            else
                target.TakeAmmoPacks(amount);
            const phrase = give ? "AmmoPackGiveName" : "AmmoPackTakeName";
            SendPopupMessage(target, { Phrase: "zombieplague." + string.lower(phrase), Arguments: [requester.Name(), amount] });
        }
    }
    BankStorageSource?: ZPBankStorage;

    constructor(storage?: ZPBankStorage) {
        if (storage)
            this.BankStorageSource = storage;
    }
}
const bank = new AmmoPackBank();
_G.Bank = bank;
if (bank.ShouldSaveAmmoPacks) {
    include("zombieplague/gamemode/bankstorage/" + bank.BankStorageType + ".lua");
    const storage = bank.BankStorageSource;
    if (!storage)
        throw "Bank backend did not register BankStorageSource";
    storage.Init();
    hook.Add("PlayerAuthed", "ZPBankWithdraw", (ply) => {
        ply.SetAmmoPacks(storage.GetPlayerAmmopacks(ply), true);
    });
    hook.Add("ShutDown", "ZPBankDepositAll", bank.Save);
    timer.Create("ZPBankSaver", bank.Time, 0, bank.Save);
}
