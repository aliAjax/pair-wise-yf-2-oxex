import type {
  Bench,
  BenchExperience,
  MaterialType,
  OrientationType,
  ShadeLevelType,
  NoiseLevelType,
  StayDurationType,
  TimePeriodType,
} from '@/types';
import { generateId } from '@/utils/comfort';

const STORAGE_KEY = 'bench-archive-data';

const MATERIAL_VALUES: MaterialType[] = ['wood', 'metal', 'stone', 'plastic', 'mixed'];
const ORIENTATION_VALUES: OrientationType[] = [
  'east', 'south', 'west', 'north', 'southeast', 'northeast', 'southwest', 'northwest',
];
const SHADE_VALUES: ShadeLevelType[] = ['none', 'partial', 'full'];
const NOISE_VALUES: NoiseLevelType[] = ['quiet', 'moderate', 'noisy'];
const STAY_DURATION_VALUES: StayDurationType[] = ['short', 'medium', 'long', 'verylong'];
const TIME_PERIOD_VALUES: TimePeriodType[] = ['morning', 'noon', 'afternoon', 'evening', 'night'];

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asRating(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 3;
  return Math.min(5, Math.max(1, Math.round(value)));
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function normalizeExperience(raw: unknown, benchId: string): BenchExperience | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;
  return {
    id: asString(item.id) || generateId(),
    benchId,
    timePeriod: pickEnum(item.timePeriod, TIME_PERIOD_VALUES, 'morning'),
    notes: asString(item.notes),
    rating: asRating(item.rating),
  };
}

/**
 * Repair a possibly damaged stored record so the archive can always be opened.
 * Missing fields fall back to safe defaults; structurally invalid entries are dropped.
 */
export function normalizeBench(raw: unknown): Bench | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const item = raw as Record<string, unknown>;
  const id = asString(item.id) || generateId();
  const experiences = Array.isArray(item.experiences)
    ? item.experiences
        .map((exp) => normalizeExperience(exp, id))
        .filter((exp): exp is BenchExperience => exp !== null)
    : [];

  return {
    id,
    name: asString(item.name, '未命名长椅'),
    location: asString(item.location),
    lat: asNumber(item.lat, 31.23),
    lng: asNumber(item.lng, 121.47),
    material: pickEnum(item.material, MATERIAL_VALUES, 'wood'),
    orientation: pickEnum(item.orientation, ORIENTATION_VALUES, 'south'),
    hasBackrest: asBoolean(item.hasBackrest, true),
    shadeLevel: pickEnum(item.shadeLevel, SHADE_VALUES, 'partial'),
    noiseLevel: pickEnum(item.noiseLevel, NOISE_VALUES, 'moderate'),
    stayDuration: pickEnum(item.stayDuration, STAY_DURATION_VALUES, 'medium'),
    rating: asRating(item.rating),
    review: asString(item.review),
    experiences,
    createdAt: asString(item.createdAt) || new Date().toISOString(),
    updatedAt: asString(item.updatedAt) || asString(item.createdAt) || new Date().toISOString(),
  };
}

export function loadBenches(): Bench[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => normalizeBench(item))
          .filter((bench): bench is Bench => bench !== null);
      }
    }
  } catch (error) {
    console.error('Failed to load benches from localStorage:', error);
  }
  return [];
}

/**
 * Persist benches. Returns false (without throwing) when local storage is
 * unavailable or full, so callers can keep the old data and warn the user.
 */
export function saveBenches(benches: Bench[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(benches));
    return true;
  } catch (error) {
    console.error('Failed to save benches to localStorage:', error);
    return false;
  }
}

export function clearBenches(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear benches from localStorage:', error);
  }
}
