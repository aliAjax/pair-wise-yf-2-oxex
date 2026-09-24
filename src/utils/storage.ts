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

export const STORAGE_KEY = 'bench-archive-data';

const MATERIALS: MaterialType[] = ['wood', 'metal', 'stone', 'plastic', 'mixed'];
const ORIENTATIONS: OrientationType[] = ['east', 'south', 'west', 'north', 'southeast', 'northeast', 'southwest', 'northwest'];
const SHADES: ShadeLevelType[] = ['none', 'partial', 'full'];
const NOISES: NoiseLevelType[] = ['quiet', 'moderate', 'noisy'];
const STAYS: StayDurationType[] = ['short', 'medium', 'long', 'verylong'];
const PERIODS: TimePeriodType[] = ['morning', 'noon', 'afternoon', 'evening', 'night'];

function oneOf<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function toNumber(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

function normalizeExperience(raw: unknown): BenchExperience | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const exp = raw as Record<string, unknown>;
  const timePeriod = oneOf(exp.timePeriod, PERIODS, 'morning');
  const rating = Math.min(5, Math.max(0, Math.round(toNumber(exp.rating, 0))));
  return {
    id: typeof exp.id === 'string' && exp.id ? exp.id : generateId(),
    benchId: typeof exp.benchId === 'string' ? exp.benchId : '',
    timePeriod,
    notes: typeof exp.notes === 'string' ? exp.notes : '',
    rating,
  };
}

/**
 * 读取并修复本地档案：
 * - JSON 损坏或数据不是数组时视为"无档案"，由调用方重新播种示例数据
 * - 单条记录字段缺失时补齐默认值，保证列表/地图/排行/详情都不会被旧数据击垮
 * 返回 null 表示本地没有可用的数据集（含损坏、被清空存储的情况）
 */
export function loadBenches(): Bench[] | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to read benches from localStorage:', error);
    return null;
  }
  if (raw === null) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error('Failed to parse bench archive, will rebuild from seed data:', error);
    return null;
  }
  if (!Array.isArray(parsed)) {
    console.error('Bench archive is not an array, will rebuild from seed data');
    return null;
  }

  const now = new Date().toISOString();
  return parsed
    .map((item): Bench | null => {
      if (typeof item !== 'object' || item === null) return null;
      const record = item as Record<string, unknown>;
      if (typeof record.id !== 'string' || !record.id) return null;

      const experiences = Array.isArray(record.experiences)
        ? record.experiences
            .map((exp) => normalizeExperience(exp))
            .filter((exp): exp is BenchExperience => exp !== null)
            .map((exp) =>
              exp.benchId === record.id ? exp : { ...exp, benchId: record.id as string }
            )
        : [];

      return {
        id: record.id,
        name: typeof record.name === 'string' ? record.name : '未命名长椅',
        location: typeof record.location === 'string' ? record.location : '位置待补充',
        lat: toNumber(record.lat, 31.23),
        lng: toNumber(record.lng, 121.47),
        material: oneOf(record.material, MATERIALS, 'wood'),
        orientation: oneOf(record.orientation, ORIENTATIONS, 'south'),
        hasBackrest: typeof record.hasBackrest === 'boolean' ? record.hasBackrest : true,
        shadeLevel: oneOf(record.shadeLevel, SHADES, 'partial'),
        noiseLevel: oneOf(record.noiseLevel, NOISES, 'moderate'),
        stayDuration: oneOf(record.stayDuration, STAYS, 'medium'),
        rating: Math.min(5, Math.max(1, Math.round(toNumber(record.rating, 3)))),
        review: typeof record.review === 'string' ? record.review : '',
        experiences,
        createdAt: typeof record.createdAt === 'string' ? record.createdAt : now,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : now,
      };
    })
    .filter((bench): bench is Bench => bench !== null);
}

/** 成功返回 true；写入失败（如配额超限/存储不可用）返回 false，调用方必须保留旧数据并提示用户 */
export function saveBenches(benches: Bench[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(benches));
    return true;
  } catch (error) {
    console.error('Failed to save benches to localStorage:', error);
    return false;
  }
}

/** 删除失败同样需要让调用方感知 */
export function clearBenches(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear benches from localStorage:', error);
    return false;
  }
}
