/**
 * conflictDetection.js
 * --------------------
 * Pure functions for detecting scheduling conflicts between calendar events.
 * Kept separate so they can be unit-tested independently of any React state.
 */

/**
 * Returns true when [startA, endA) overlaps [startB, endB).
 * Uses the standard half-open interval check so back-to-back events
 * (one ends at the exact moment the next starts) are NOT considered conflicts.
 *
 * @param {Date|string} startA
 * @param {Date|string} endA
 * @param {Date|string} startB
 * @param {Date|string} endB
 * @returns {boolean}
 */
export function rangesOverlap(startA, endA, startB, endB) {
  const sA = new Date(startA).getTime();
  const eA = new Date(endA).getTime();
  const sB = new Date(startB).getTime();
  const eB = new Date(endB).getTime();

  if (isNaN(sA) || isNaN(eA) || isNaN(sB) || isNaN(eB)) return false;

  // sA < eB  AND  sB < eA   →  overlap
  return sA < eB && sB < eA;
}

/**
 * Given a candidate [start, end] window and the current list of FullCalendar
 * events, returns all events that would overlap with the candidate.
 *
 * Skips friend events (isFriendEvent flag) and the event being edited
 * (matchId) so an edit doesn't flag itself as a conflict.
 *
 * @param {string|Date} candidateStart
 * @param {string|Date} candidateEnd
 * @param {Array}       events           - FullCalendar-formatted event objects
 * @param {string|null} [excludeId]      - id of event being edited (to skip self)
 * @returns {Array}                      - subset of events that conflict
 */
export function findConflicts(candidateStart, candidateEnd, events, excludeId = null) {
  return events.filter((ev) => {
    // Skip friend-overlay events — they're read-only busy blocks
    if (ev.extendedProps?.isFriendEvent) return false;

    // Skip the event currently being edited
    if (excludeId !== null && String(ev.id) === String(excludeId)) return false;

    const evEnd = ev.end || ev.start; // all-day events may have no end
    return rangesOverlap(candidateStart, candidateEnd, ev.start, evEnd);
  });
}

/**
 * Convenience wrapper for invite conflict checking.
 * Returns true if [inviteStart, inviteEnd] overlaps any existing event.
 */
export function inviteHasConflict(inviteStart, inviteEnd, events) {
  return findConflicts(inviteStart, inviteEnd, events).length > 0;
}
