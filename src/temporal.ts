// Lightweight temporal parser for prototype purposes.
// Recognizes: today, tomorrow, weekdays, 'in N hours/minutes', explicit dates (MM/DD or MM/DD/YYYY), and explicit times (HH:MM, H PM/AM).

export function parseNaturalDateTime(text: string, now = new Date()): { datetime?: string; confidence: number } {
  const lower = text.toLowerCase();

  // explicit time HH:MM
  const timeMatch = lower.match(/(\d{1,2}:\d{2})/);
  let timePart: string | undefined = timeMatch ? timeMatch[1] : undefined;

  // explicit am/pm times like '4pm' or '4 pm'
  const ampmMatch = lower.match(/\b(\d{1,2})(?:[:](\d{2}))?\s?(am|pm)\b/);
  if (ampmMatch) {
    const hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
    const isPm = ampmMatch[3] === 'pm';
    const h = isPm ? (hour % 12) + 12 : hour % 12;
    timePart = `${String(h).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  }

  // relative: today / tomorrow
  if (/\btomorrow\b/.test(lower)) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() + 1);
    if (timePart) {
      const [hh, mm] = timePart.split(':').map(Number);
      dt.setHours(hh, mm, 0, 0);
    } else {
      dt.setHours(9,0,0,0);
    }
    return { datetime: dt.toISOString(), confidence: 0.9 };
  }

  if (/\btoday\b/.test(lower)) {
    const dt = new Date(now);
    if (timePart) {
      const [hh, mm] = timePart.split(':').map(Number);
      dt.setHours(hh, mm, 0, 0);
    } else {
      dt.setHours(18,0,0,0);
    }
    return { datetime: dt.toISOString(), confidence: 0.85 };
  }

  // in N hours / minutes
  const inMatch = lower.match(/in\s+(\d+)\s*(hour|hours|hr|hrs)/);
  if (inMatch) {
    const n = parseInt(inMatch[1], 10);
    const dt = new Date(now.getTime() + n * 60 * 60 * 1000);
    return { datetime: dt.toISOString(), confidence: 0.8 };
  }
  const inMinMatch = lower.match(/in\s+(\d+)\s*(minute|minutes|min|mins)/);
  if (inMinMatch) {
    const n = parseInt(inMinMatch[1], 10);
    const dt = new Date(now.getTime() + n * 60 * 1000);
    return { datetime: dt.toISOString(), confidence: 0.75 };
  }

  // weekday: next monday / monday
  const weekdayMatch = lower.match(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const next = Boolean(weekdayMatch[1]);
    const dayName = weekdayMatch[2];
    const targetIndex = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].indexOf(dayName);
    const dt = new Date(now);
    let diff = (targetIndex - dt.getDay() + 7) % 7;
    if (diff === 0 && next) diff = 7;
    if (diff === 0 && !next) diff = 0;
    dt.setDate(dt.getDate() + diff);
    if (timePart) {
      const [hh, mm] = timePart.split(':').map(Number);
      dt.setHours(hh, mm, 0, 0);
    } else {
      dt.setHours(9,0,0,0);
    }
    return { datetime: dt.toISOString(), confidence: 0.8 };
  }

  // explicit date MM/DD or MM/DD/YYYY
  const dateMatch = lower.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (dateMatch) {
    const month = parseInt(dateMatch[1], 10) - 1;
    const day = parseInt(dateMatch[2], 10);
    const year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
    const dt = new Date(year, month, day);
    if (timePart) {
      const [hh, mm] = timePart.split(':').map(Number);
      dt.setHours(hh, mm, 0, 0);
    }
    return { datetime: dt.toISOString(), confidence: 0.9 };
  }

  // fallback: no parse
  return { confidence: 0.0 };
}
