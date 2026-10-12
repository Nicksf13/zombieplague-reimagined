declare const clientPlayer: ZPClientPlayer;
clientPlayer.SetZombieClass("Fast Zombie");
net.Receive("Example", (length: number) => {});
HudManager.GetConfig("Status", "Body").a = 200;

// @ts-expect-error Client receivers have no sender argument supplied by the engine.
net.Receive("Example", (length: number, sender: ZPPlayer) => {});
// @ts-expect-error Client class state contains its display name, not the server definition.
clientPlayer.SetZombieClass({ Name: "Fast Zombie" });
// @ts-expect-error Client code cannot give server-controlled ammo packs.
clientPlayer.GiveAmmoPacks(10);
// @ts-expect-error Client code cannot send packets to another player.
net.Send(clientPlayer);
// @ts-expect-error HUD color channels are numbers.
HudManager.GetConfig("Status", "Body").a = "opaque";
