// Map-session results use engine globals so late joiners receive the same totals.
export class RoundResults implements ZPRoundResultsTracker {
    private active: boolean = false;
    private humans: number = 0;
    private zombies: number = 0;
    private draws: number = 0;

    constructor() {
        SetGlobalInt("ZPHumanRoundWins", 0);
        SetGlobalInt("ZPZombieRoundWins", 0);
        SetGlobalInt("ZPRoundDraws", 0);
    }

    Begin(): void { this.active = true; }
    Cancel(): void { this.active = false; }

    Finish(reason: ZPRoundEndReason): void {
        if (!this.active) return;
        if (reason === HUMANS_WIN) {
            this.humans++;
            SetGlobalInt("ZPHumanRoundWins", this.humans);
        } else if (reason === ZOMBIES_WIN) {
            this.zombies++;
            SetGlobalInt("ZPZombieRoundWins", this.zombies);
        } else if (reason === ROUND_DRAW) {
            this.draws++;
            SetGlobalInt("ZPRoundDraws", this.draws);
        } else return;
        // Several delayed end checks may finish the same round.
        this.active = false;
    }
}
(RoundManager as ZPServerRoundManager).Results = new RoundResults();
