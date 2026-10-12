export class TextBankStorage implements ZPBankStorage {
    Init(): void {
        if (!file.Exists("zombie_plague", "DATA"))
            file.CreateDir("zombie_plague");
    }
    GetPlayerAmmopacks(ply: ZPServerPlayer): number {
        // Corrupt files must not propagate nil into Player state and net.WriteInt.
        return tonumber(file.Read("zombie_plague/" + ply.SteamID64() + ".txt", "DATA") ?? "0") ?? 0;
    }
    Save: ZPBankStorage["Save"] = (id, amount): void => {
        file.Write("zombie_plague/" + id + ".txt", tostring(amount));
    };
}
Bank.BankStorageSource = new TextBankStorage();
