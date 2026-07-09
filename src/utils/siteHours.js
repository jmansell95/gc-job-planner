export const SITE_EARLY_ACCESS_TIME = '06:00';
export const SITE_OPEN_TIME = '08:00';
export const SITE_CLOSE_TIME = '17:00';
export const CHECK_IN_DEADLINE = '08:15';

export function getCurrentTimeStr() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function isWithinSiteHours() {
  const now = getCurrentTimeStr();
  return now >= SITE_OPEN_TIME && now <= SITE_CLOSE_TIME;
}

export function isBeforeSiteOpen() {
  const now = getCurrentTimeStr();
  return now >= SITE_EARLY_ACCESS_TIME && now < SITE_OPEN_TIME;
}

export function isCheckInDeadlinePassed() {
  return getCurrentTimeStr() > CHECK_IN_DEADLINE;
}