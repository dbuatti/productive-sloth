export const parseFlexibleTime = (timeString: string, baseDate: Date): Date => {
  const lowerCaseTimeString = timeString.toLowerCase().trim();
  const now = new Date();
  let parsedDate: Date;

  // Try parsing with full 12-hour format with minutes first (h:mm a)
  parsedDate = parse(lowerCaseTimeString, 'h:mm a', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Try parsing with 12-hour format without minutes (h a)
  parsedDate = parse(lowerCaseTimeString, 'h a', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Try parsing 24-hour format with minutes (HH:mm)
  parsedDate = parse(lowerCaseTimeString, 'HH:mm', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Try parsing 12-hour format with single digit hour and minutes (h:m a)
  parsedDate = parse(lowerCaseTimeString, 'h:m a', baseDate);
  if (!isNaN(parsedDate.getTime())) return parsedDate;

  // Handle "12:30 pm" format specifically (h:mm a with space)
  const spaceFormatMatch = lowerCaseTimeString.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (spaceFormatMatch) {
    const [, hourStr, minuteStr, period] = spaceFormatMatch;
    const hour = parseInt(hourStr, 10);
    const minutes = parseInt(minuteStr, 10);
    let twelveHour = hour;
    
    if (period === 'pm' && hour !== 12) {
      twelveHour += 12;
    } else if (period === 'am' && hour === 12) {
      twelveHour = 0;
    }
    
    return setMinutes(setHours(baseDate, twelveHour), minutes);
  }

  // Handle simple hour inputs (e.g., "9", "14")
  const hourMatch = lowerCaseTimeString.match(/^(\d{1,2})$/);
  if (hourMatch) {
    const hour = parseInt(hourMatch[1], 10);
    if (hour >= 0 && hour <= 23) {
      return setHours(setMinutes(baseDate, 0), hour);
    }
  }

  // Fallback to current time if parsing fails
  console.warn(`parseFlexibleTime: Could not parse time string "${timeString}", falling back to current time`);
  return now;
};