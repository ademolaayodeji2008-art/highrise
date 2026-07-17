// The server process's own local time is unreliable across environments —
// it's West Africa Time in local dev (inherits the machine's timezone) but
// UTC on Render. Every date/time decision must instead be computed against
// the office's actual timezone, set via TIMEZONE in .env.
const TIMEZONE = process.env.TIMEZONE || 'Africa/Lagos';

function partsInZone(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: Number(map.hour) % 24, // hour12:false can render midnight as "24" in some ICU versions
    minute: Number(map.minute)
  };
}

// "YYYY-MM-DD" for `date` as seen in the office's timezone
function todayString(date = new Date()) {
  const { year, month, day } = partsInZone(date);
  return `${year}-${month}-${day}`;
}

// cutoff like "09:00" -> true if `date`'s time in the office's timezone is after that cutoff
function isAfterCutoff(date, cutoff) {
  const [cutHour, cutMin] = cutoff.split(':').map(Number);
  const { hour, minute } = partsInZone(date);
  return hour > cutHour || (hour === cutHour && minute > cutMin);
}

// Weekday (Mon-Fri) date strings between fromStr and toStr (inclusive),
// capped at today — future days can't yet count as absent.
function workingDaysBetween(fromStr, toStrRaw) {
  const today = todayString();
  const toStr = toStrRaw > today ? today : toStrRaw;

  const dates = [];
  const cursor = new Date(`${fromStr}T00:00:00`);
  const end = new Date(`${toStr}T00:00:00`);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day >= 1 && day <= 5) {
      dates.push(todayString(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

module.exports = { todayString, isAfterCutoff, workingDaysBetween };
