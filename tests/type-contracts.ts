// These calls are compiled for diagnostics only; they never run in the game.
declare const testPlayer: ZPPlayer;
declare function acceptPlayer(this: void, ply: ZPPlayer): void;

RoundManager.SetSpecialRound(true);
RoundManager.SetRoundState(ROUND_PLAYING);
const special: boolean = RoundManager.IsSpecialRound();
const count: number = RoundManager.CountHumansAlive();
const alive: ZPPlayer[] = RoundManager.GetAlivePlayers();
const id: string = PlayerManager.GetPlayerID(testPlayer);
const found = PlayerManager.DiscoverPlayerByTextID(id);
if (found !== undefined) acceptPlayer(found);

// @ts-expect-error Special-round flags must be booleans.
RoundManager.SetSpecialRound("true");
// @ts-expect-error Respawn flags must be booleans.
RoundManager.SetRespawn(1);
// @ts-expect-error Only declared round states are accepted.
RoundManager.SetRoundState(99);
// @ts-expect-error SteamID64 values must stay strings to avoid precision loss.
PlayerManager.DiscoverPlayerByTextID(76561198000000000);
// @ts-expect-error A missing player must be handled before using it.
acceptPlayer(found);
// @ts-expect-error GetGlobalInt cannot read boolean values or defaults.
GetGlobalInt("SpecialRound", false);
// @ts-expect-error Engine library functions have no self/context argument.
team.GetPlayers(TEAM_HUMANS, testPlayer);

declare const serverPlayer: ZPServerPlayer;
declare const serverRoundManager: ZPServerRoundManager;
const status: ZPServerStatus = serverRoundManager.GetServerStatus(serverPlayer);
net.WriteTable(status);
net.Send(serverPlayer);
const randomSound: string | undefined = SafeTableRandom(["sound.mp3"]);
const randomFlag: boolean | undefined = SafeTableRandom({ enabled: false });

// @ts-expect-error The gamemode no longer controls a custom player language.
serverPlayer.SetLanguage("pt-br", false);
// @ts-expect-error Initialize does not supply a player argument.
hook.Add("Initialize", "WrongSignature", (ply: ZPPlayer) => {});
// @ts-expect-error Net sender is a Player, not the message length.
net.Receive("RequestServerStatus", (length: number, ply: number) => {});
// @ts-expect-error A net recipient must be a Player or a list of players.
net.Send("76561198000000001");
// @ts-expect-error SafeTableRandom's result is not guaranteed for an empty table.
const guaranteedSound: string = SafeTableRandom(["sound.mp3"]);

const typedWeapon = new WeaponDefinition({ PrettyName: "Custom", WeaponID: "custom", DamageMultiplier: 2.4 });
typedWeapon.GiveWeapon(serverPlayer);
const typedZombie = new ZombieClassDefinition({ ID: "CustomZombie", MaxHealth: 1500 });
const typedHuman = new HumanClassDefinition({ ID: "CustomHuman", Armor: 50 });
const typedItem = new ExtraItemDefinition({ ID: "custom", Name: "Custom", Price: 10,
    OnBuy(this: ZPExtraItem, ply) { ply.SetArmor(this.Price ?? 0); } });
typedItem.OnBuy(serverPlayer);

// @ts-expect-error A weapon must declare its engine identifier.
new WeaponDefinition({ PrettyName: "Custom" });
// @ts-expect-error Weapon kinds must be a declared category.
new WeaponDefinition({ PrettyName: "Custom", WeaponID: "custom", WeaponType: 99 });
// @ts-expect-error Extra items must declare their purchase callback.
new ExtraItemDefinition({ ID: "custom", Name: "Custom", Price: 10 });
// @ts-expect-error Class identifiers are required for registration.
new ZombieClassDefinition({ MaxHealth: 1500 });
// @ts-expect-error Class attributes remain strictly typed.
new HumanClassDefinition({ ID: "CustomHuman", Armor: "50" });
