export interface MotionObservation {
    Mode: ZPBotMoveMode; Position: GLuaVector; Velocity: GLuaVector; Run: number;
    Controlled: boolean; Moving: boolean;
}
interface GroundCommand { Owner: string; Time: number; Position: GLuaVector; Run: number; }
interface Flight { Owner: string; Started: number; Seen: number; CommandAt: number; Landed?: number; }
export interface DepartureEvidence { Owner: string; CommandAt?: number; DepartureAt: number; Reason: string; }
interface CausalityContract {
    Observe(observation: MotionObservation, owner: string | undefined, now: number): void;
    Owner(now: number): string | undefined;
    Pending(owner: string, now: number): boolean;
    Reset(reason: string): void;
}
/** Attribution requires an executed ground command followed by an observed unforced departure. */
export class BotMotionCausality implements CausalityContract {
    private ground: GroundCommand | undefined;
    private flight: Flight | undefined;
    private mode: ZPBotMoveMode | undefined;
    constructor(private departure?: (this: void, evidence: DepartureEvidence) => void) {}
    Reason = "no_observed_departure";
    Timing(): { CommandAt: number; DepartureAt: number } | undefined {
        return this.flight ? { CommandAt: this.flight.CommandAt, DepartureAt: this.flight.Started } : undefined;
    }
    Explain(now: number): string {
        // Describe the existing eligibility checks without changing ownership or its windows.
        if (this.flight && now < this.flight.Seen) return "flight_clock_reversed_before_damage";
        if (this.flight && now - this.flight.Started > 12) return "flight_timed_out_before_damage";
        if (this.flight && now - this.flight.Seen > 0.35) return "stale_flight_before_damage";
        return this.Reason;
    }
    Reset(reason: string): void { this.ground = undefined; this.flight = undefined; this.mode = undefined; this.Reason = reason; }
    Observe(observation: MotionObservation, owner: string | undefined, now: number): void {
        const { Mode: mode, Position: position, Velocity: velocity } = observation;
        if (!observation.Controlled || mode === "water" || mode === "ladder" || velocity.x ** 2 + velocity.y ** 2 > observation.Run ** 2 * 2.25) {
            if (mode === "air" && this.mode === "ground") this.departure?.({ Owner: "", DepartureAt: now,
                Reason: !observation.Controlled ? "controller_substitution" : "external_or_special_movement",
                ...(this.ground ? { CommandAt: this.ground.Time } : {}) });
            this.Reset(!observation.Controlled ? "controller_substitution" : "external_or_special_movement"); this.mode = mode; return;
        }
        const ground = this.ground;
        if (mode === "air" && this.mode === "ground") {
            if (ground && now >= ground.Time && now - ground.Time <= 0.35 &&
                position.DistToSqr(ground.Position) <= Math.max(100, ground.Run * (now - ground.Time) * 3) ** 2) {
                this.flight = { Owner: ground.Owner, Started: now, Seen: now, CommandAt: ground.Time }; this.Reason = "observed_departure";
            } else { this.flight = undefined; this.Reason = "departure_without_recent_command"; }
            this.departure?.({ Owner: this.flight?.Owner ?? "", DepartureAt: now, Reason: this.Reason,
                ...(ground ? { CommandAt: ground.Time } : {}) });
        }
        if (this.flight) {
            if (now - this.flight.Seen > 0.35 || now < this.flight.Seen || now - this.flight.Started > 12) {
                this.flight = undefined; this.Reason = "flight_observation_gap";
            } else if (mode === "air") { this.flight.Seen = now; delete this.flight.Landed; }
            else if (mode === "ground") {
                this.flight.Seen = now; this.flight.Landed ??= now;
                if (now - this.flight.Landed > 0.2) { this.flight = undefined; this.Reason = "landing_settled"; }
            }
        }
        if (mode === "ground" && owner && observation.Moving) this.ground = { Owner: owner, Time: now, Position: Vector(position.x, position.y, position.z), Run: observation.Run };
        this.mode = mode;
    }
    Owner(now: number): string | undefined {
        const flight = this.flight;
        return flight && now >= flight.Seen && now - flight.Seen <= 0.35 && now - flight.Started <= 12 ? flight.Owner : undefined;
    }
    Pending(owner: string, now: number): boolean {
        return this.Owner(now) === owner || (this.ground?.Owner === owner && now >= this.ground.Time && now - this.ground.Time <= 0.35);
    }
    Consume(): void { this.flight = undefined; this.ground = undefined; this.Reason = "incident_already_resolved"; }
}
