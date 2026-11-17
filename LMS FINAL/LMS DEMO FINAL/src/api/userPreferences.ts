import { getPlatformValue, setPlatformValue } from './platformKv';

export interface UserPreferences {
  darkMode: boolean;
}

const DEFAULT_PREFS: UserPreferences = { darkMode: false };

export function prefsKey(userId: string): string {
  return `skillfort_prefs_${userId}`;
}

export async function loadUserPreferences(userId: string): Promise<UserPreferences> {
  const saved = await getPlatformValue<UserPreferences>(prefsKey(userId), DEFAULT_PREFS);
  return {
    darkMode: saved?.darkMode === true,
  };
}

export async function saveUserPreferences(
  userId: string,
  prefs: Partial<UserPreferences>
): Promise<boolean> {
  const current = await loadUserPreferences(userId);
  return setPlatformValue(prefsKey(userId), { ...current, ...prefs });
}

export async function migrateLegacyDarkModeToDb(userId: string): Promise<void> {
  const legacy = localStorage.getItem('skillfort_dark_mode');
  if (legacy === null) return;

  const current = await loadUserPreferences(userId);
  if (legacy === 'true' && !current.darkMode) {
    await saveUserPreferences(userId, { darkMode: true });
  }

  localStorage.removeItem('skillfort_dark_mode');
}
