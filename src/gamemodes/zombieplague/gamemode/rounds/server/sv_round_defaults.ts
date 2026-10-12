export {};
const manager = RoundManager as ZPServerRoundManager;
manager.AddDefaultRounds = function (this: ZPServerRoundManager): void {
    const reward = (ply: ZPServerPlayer) => this.AddPlayerToBeRewarded(ply);
    const simple: ZPRoundDefinition = {
        Name: "RoundSimpleName", MinPlayers: cvars.Number("zp_min_players", 2), Chance: 100,
        SpecialRound: false, Respawn: false, Order: 1,
        StartFunction: (selected) => {
            const players = this.GetPlayersToPlay(true), first = selected ?? SafeTableRandom(players);
            if (!first)
                return;
            first.Infect();
            for (const ply of players) {
                reward(ply);
                SendNotifyMessage(ply, { Phrase: "zombieplague.roundsimple" }, 5, Color(0, 255, 0));
                SendPopupMessage(ply, { Phrase: "zombieplague.noticefirstzombie", Arguments: [first.Name()] });
            }
        },
        RespawnFunction(this: void): boolean { return manager.CountHumansAlive() > 1; },
    };
    const multi: ZPRoundDefinition = {
        Name: "RoundMultiInfectionName", Chance: 15, MinPlayers: 4, Order: 2, Respawn: false,
        StartFunction: () => {
            const players = this.GetPlayersToPlay(true);
            for (let i = 0; i < 2 && players.length > 0; i++) {
                const selected = players.splice(math.random(1, players.length) - 1, 1)[0];
                if (selected)
                    selected.Infect();
            }
            for (const ply of players) {
                reward(ply);
                SendNotifyMessage(ply, { Phrase: "zombieplague.noticemultiinfection" }, 5, Color(0, 255, 0));
            }
        },
        RespawnFunction(this: void): boolean { return manager.CountHumansAlive() > 1; },
    };
    const nemesis: ZPRoundDefinition = {
        Name: "RoundNemesisName", Chance: 5, MinPlayers: 5, SpecialRound: true, Respawn: false,
        StartSound: ["zombieplague/nemesis1.mp3", "zombieplague/nemesis2.mp3"], Order: 3,
        StartFunction: () => {
            const players = this.GetPlayersToPlay(true), selected = SafeTableRandom(players);
            if (!selected)
                return;
            selected.MakeNemesis();
            for (const ply of players) {
                reward(ply);
                SendPopupMessage(ply, { Phrase: "zombieplague.noticenemesis", Arguments: [selected.Name()] });
                if (nemesis.Respawn && ply.IsHuman())
                    ply.Lifes = 5;
            }
        },
    };
    const survivor: ZPRoundDefinition = {
        Name: "RoundSurvivorName", Chance: 5, MinPlayers: 3, SpecialRound: true,
        StartSound: ["zombieplague/survivor1.mp3", "zombieplague/survivor2.mp3"], Order: 4,
        StartFunction: () => {
            const players = this.GetPlayersToPlay(true), selected = SafeTableRandom(players);
            if (!selected)
                return;
            table.RemoveByValue(players, selected);
            for (const ply of players) {
                if (survivor.Respawn)
                    ply.Lifes = 5;
                ply.Infect();
                reward(ply);
                SendNotifyMessage(ply, { Phrase: "zombieplague.noticesurvivor", Arguments: [selected.Name()] }, 5, SURVIVOR_COLOR);
            }
            selected.MakeSurvivor();
            reward(selected);
        },
    };
    for (const round of [nemesis, survivor]) {
        if (round.Respawn) {
            round.OnDeathFunction = function (this: void, ply): void { ply.Lifes = (ply.Lifes ?? 0) - 1; };
            round.RespawnFunction = function (this: void, ply): boolean { return (ply.Lifes ?? 0) > 0; };
        }
    }
    const swarm: ZPRoundDefinition = {
        Name: "RoundSwarmName", Chance: 10, MinPlayers: 4, SpecialRound: true, StartSound: ["zombieplague/swarmmode.mp3"], Order: 5,
        StartFunction: () => splitTeams("NoticeSwarm"),
    };
    const plague: ZPRoundDefinition = {
        Name: "RoundPlagueName", Chance: 10, MinPlayers: 4, SpecialRound: true, StartSound: ["zombieplague/plaguemode.mp3"], Order: 6,
        StartFunction: () => {
            splitTeams("NoticePlague");
            SafeTableRandom(this.GetAliveZombies())?.MakeNemesis();
            SafeTableRandom(this.GetAliveHumans())?.MakeSurvivor();
        },
    };
    const splitTeams = (phrase: string): void => {
        const players = this.GetPlayersToPlay(true);
        let index = 1;
        while (players.length > 0) {
            const selected = SafeTableRandom(players);
            if (!selected)
                break;
            table.RemoveByValue(players, selected);
            if (index % 2 === 0)
                selected.Infect();
            index++;
            reward(selected);
            SendNotifyMessage(selected, { Phrase: "zombieplague." + string.lower(phrase) }, 5, Color(0, 255, 0));
        }
    };
    for (const [id, round] of [["SimpleRound", simple], ["MultiInfectionRound", multi], ["NemesisRound", nemesis],
        ["SurvivalRound", survivor], ["SwarmRound", swarm], ["PlagueRound", plague]] as const)
        this.AddRoundType(id, round);
};
