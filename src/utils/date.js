function pad(n) {
  return String(n).padStart(2, '0');
}

// "YYYY-MM-DD" in local (server) time
function todayString(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// cutoff like "09:00" -> true if `date`'s local time is after that cutoff
function isAfterCutoff(date, cutoff) {
  const [cutHour, cutMin] = cutoff.split(':').map(Number);
  const cutoffDate = new Date(date);
  cutoffDate.setHours(cutHour, cutMin, 0, 0);
  return date.getTime() > cutoffDate.getTime();
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
