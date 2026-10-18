/** Parsing and capture boundaries are separate from learning policy and reward code. */
export function parseLearningTrace(text) {
    const trimmed = text.replace(/^\uFEFF/, "").trim();
    if (trimmed.startsWith("{")) {
        const value = JSON.parse(trimmed);
        if (value.Version !== 1 || !Array.isArray(value.Rows)) throw new Error("Expected a version 1 learning trace export.");
        return value;
    }
    const Rows = [];
    for (const [index, line] of text.split(/\r?\n/).entries()) {
        const offset = line.indexOf("[ZP learning] ");
        if (offset < 0) continue;
        try { Rows.push(JSON.parse(line.slice(offset + "[ZP learning] ".length))); }
        catch { throw new Error(`Malformed learning record at console line ${index + 1}; do not silently skip lost data.`); }
    }
    if (!Rows.length) throw new Error("No learning records found; a statistics timeline is not an experience trace.");
    return { Version: 1, Rows, Source: "console" };
}

export function traceWindow(capture, phase, bot) {
    const seen = new Map(), rows = [], duplicates = [];
    for (const row of capture.Rows) {
        if (typeof row.Session !== "string" || !Number.isInteger(row.Bot) || !Number.isFinite(row.Time) ||
            typeof row.Experience !== "string" || typeof row.Reason !== "string" ||
            !["tactical", "motion", "profile", "passage", "place", "boost"].includes(row.Learner)) throw new Error("Invalid learning record identity/time.");
        if (row.Sequence !== undefined) {
            if (!Number.isInteger(row.Sequence) || row.Sequence < 1) throw new Error("Invalid record sequence.");
            const key = row.Session + ":" + row.Sequence;
            if (seen.has(key)) {
                if (JSON.stringify(seen.get(key)) !== JSON.stringify(row)) throw new Error("Conflicting records for one sequence.");
                duplicates.push(key); continue;
            }
            seen.set(key, row);
        }
        rows.push(row);
    }
    let start, end, window = rows;
    if (phase) {
        if (!["active", "evaluation"].includes(phase)) throw new Error("Phase must be active, evaluation or all.");
        end = rows.findLast(row => row.Bot === bot && row.Kind === "marker" && row.Reason === phase + "_end");
        if (!end) throw new Error("Missing end marker; cannot claim a complete phase or distinguish live pending experiences.");
        start = rows.findLast(row => row.Bot === bot && row.Session === end.Session && row.Kind === "marker" &&
            row.Reason === phase + "_start" && row.Time <= end.Time);
        if (!start) throw new Error("Missing start marker (possibly ring truncation); use a complete console capture.");
        window = rows.filter(row => row.Session === end.Session && row.Time >= start.Time && row.Time <= end.Time &&
            (row.Sequence === undefined || row.Sequence >= start.Sequence && row.Sequence <= end.Sequence));
    }
    const gaps = [];
    const sequences = new Map();
    for (const row of window) {
        const previous = sequences.get(row.Session);
        if (row.Sequence !== undefined && previous !== undefined && row.Sequence !== previous + 1)
            gaps.push({ Session: row.Session, After: previous, Before: row.Sequence });
        if (row.Sequence !== undefined) sequences.set(row.Session, row.Sequence);
    }
    return { Rows: window.filter(row => bot === undefined || row.Bot === bot), Start: start, End: end,
        Coverage: { Phase: phase ?? "all", Bot: bot ?? "all", Start: start?.Time ?? null, End: end?.Time ?? null,
            CompleteMarkedWindow: Boolean(start && end && !gaps.length && window.every(row => row.Sequence !== undefined)),
            SequenceGaps: gaps, DuplicateRecordsRemoved: duplicates.length, ExportDropped: capture.Dropped ?? null,
            Caveat: "Counts describe retained records. Open experiences are confirmed only by the end marker snapshot; unknown missing endings are not discarded experiences." } };
}

export function manualFallComparison(rows, falls, matches = []) {
    const manual = rows.filter(row => row.Kind === "marker" && row.Reason === "manual_fall");
    if (!Array.isArray(matches)) throw new Error("Manual matches must be an array of { Manual, Incidents } reviewed by the observer.");
    const reviewed = new Map(), claimed = new Set(), annotations = new Map(), duplicates = new Map();
    for (const match of matches) {
        const primary = Array.isArray(match.Incidents) && match.Incidents.every(id => typeof id === "string");
        const duplicate = typeof match.DuplicateOf === "string";
        if (typeof match.Manual !== "string" || primary === duplicate)
            throw new Error("Invalid manual fall match.");
        const marker = manual.find(row => row.Experience === match.Manual);
        if (!marker) continue; // One annotation file may cover both marked phases.
        if (annotations.has(match.Manual)) throw new Error("Duplicate manual annotation.");
        annotations.set(match.Manual, match);
    }
    for (const match of annotations.values()) {
        const marker = manual.find(row => row.Experience === match.Manual);
        if (match.DuplicateOf !== undefined) {
            const primary = annotations.get(match.DuplicateOf), primaryMarker = manual.find(row => row.Experience === match.DuplicateOf);
            if (match.DuplicateOf === match.Manual || !primary || primary.DuplicateOf !== undefined ||
                primaryMarker.Bot !== marker.Bot || primaryMarker.Session !== marker.Session)
                throw new Error("A duplicate marker must reference one reviewed primary fall from the same bot/session.");
            duplicates.set(match.Manual, match.DuplicateOf); continue;
        }
        const detections = match.Incidents.map(id => {
            const fall = falls.find(row => row.Incident === id && row.Bot === marker.Bot && row.Session === marker.Session);
            if (!fall || claimed.has(id)) throw new Error("Missing or multiply assigned fall incident; review the capture.");
            claimed.add(id); return fall;
        });
        reviewed.set(match.Manual, detections);
    }
    const cases = manual.map(row => {
        const duplicateOf = duplicates.get(row.Experience), found = reviewed.get(duplicateOf ?? row.Experience);
        return { Manual: row.Experience, Time: row.Time, Bot: row.Bot, Role: row.Role, Reviewed: found !== undefined,
            DuplicateOf: duplicateOf ?? null,
            Incidents: found?.map(fall => fall.Incident) ?? null, Detected: found ? found.length > 0 : null,
            Attributed: found ? found.some(fall => fall.Attributed === true) : null };
    });
    const physical = cases.filter(row => row.DuplicateOf === null);
    return { ObservedMarkers: manual.length, DuplicateMarkers: duplicates.size, DistinctObservedFalls: physical.length,
        Reviewed: reviewed.size, Unreviewed: physical.length - reviewed.size,
        DetectedAmongReviewed: physical.filter(row => row.Detected === true).length,
        AttributedAmongReviewed: physical.filter(row => row.Attributed === true).length,
        NotDetectedAmongReviewed: physical.filter(row => row.Detected === false).length,
        Cases: cases, Caveat: "Manual markers are observer reports, not detector output. Observer-confirmed duplicates are grouped explicitly. Reaction delay is unknown. Incidents are matched explicitly, never by an assumed causal/time window. No markers is missing manual evidence, not zero real falls." };
}
