declare const clientPlayer: ZPClientPlayer;
clientPlayer.SetZombieClass("Fast Zombie");
net.Receive("Example", (length: number) => {});
ZPThemes.UseTheme("hl2");

// @ts-expect-error Client receivers have no sender argument supplied by the engine.
net.Receive("Example", (length: number, sender: ZPPlayer) => {});
// @ts-expect-error Client class state contains its display name, not the server definition.
clientPlayer.SetZombieClass({ Name: "Fast Zombie" });
// @ts-expect-error Client code cannot give server-controlled ammo packs.
clientPlayer.GiveAmmoPacks(10);
// @ts-expect-error Client code cannot send packets to another player.
net.Send(clientPlayer);
// @ts-expect-error Per-player HUD position configuration was removed.
HudManager.GetConfig("Status", "XPos");
// @ts-expect-error HUD renderers cannot change the collected weapon ammo.
ZPPlayerHUD.GetState().Ammo!.Primary!.Clip = 99;

ZPWeaponMenu.SetCategory("primary");
ZPWeaponMenu.Select("weapon_ar2");
// @ts-expect-error Categories are domain IDs, not visual positions.
ZPWeaponMenu.SetCategory(1);
// @ts-expect-error Presentations may read, but cannot mutate the typed state.
ZPWeaponMenu.GetState().Category = "melee";
// @ts-expect-error Choices use stable weapon IDs, not server weapon instances.
ZPWeaponMenu.Select({ WeaponID: "weapon_ar2" });

ZPScoreboard.ToggleMute(12);
ZPSettings.SetAlwaysRun(true);
// @ts-expect-error Settings preferences are boolean values, not console strings.
ZPSettings.SetAlwaysRun("1");
// @ts-expect-error Presentation snapshots must not modify the local preference.
ZPSettings.GetState().AlwaysRun = true;
// @ts-expect-error Scoreboard snapshots cannot change player points.
ZPScoreboard.GetState().Teams[0]!.Players[0]!.Points = 999;
// @ts-expect-error Presentations act on connection IDs, not engine Player objects.
ZPScoreboard.ToggleMute(clientPlayer);
