// ═══════════════════════════════════════
//  SCAN + FETCH
// ═══════════════════════════════════════
const FETCH_TIMEOUT_MS = 30000;
async function ebirdFetch(radiusKm, backDays) { /* your ebirdFetch */ }
async function scan() { /* your full scan function, updated to pass &activity=${currentActivity} */ }
// Add this helper:
function setActivity(act) {
  currentActivity = act;
  document.querySelectorAll('.act-btn').forEach(b => b.classList.toggle('on', b.id === `act-${act}`));
  toast(`Switched to ${act.charAt(0).toUpperCase() + act.slice(1)} mode`, 1500);
  spots = []; renderList(false);
}
