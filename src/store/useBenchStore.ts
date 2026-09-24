import { create } from 'zustand';
import type { Bench, BenchExperience, MaterialType, OrientationType, ShadeLevelType, NoiseLevelType } from '@/types';
import { loadBenches, saveBenches } from '@/utils/storage';
import { generateId } from '@/utils/comfort';
import { mockBenches } from '@/data/mockBenches';

/** 表单提交的时段体验（新增时还没有 id / benchId） */
export type ExperienceDraft = Omit<BenchExperience, 'id' | 'benchId'> & { id?: string };

interface BenchState {
  benches: Bench[];
  searchQuery: string;
  materialFilter: MaterialType | null;
  orientationFilter: OrientationType | null;
  shadeFilter: ShadeLevelType | null;
  noiseFilter: NoiseLevelType | null;
  initialized: boolean;
}

interface BenchActions {
  initialize: () => void;
  setSearchQuery: (query: string) => void;
  setMaterialFilter: (material: MaterialType | null) => void;
  setOrientationFilter: (orientation: OrientationType | null) => void;
  setShadeFilter: (shade: ShadeLevelType | null) => void;
  setNoiseFilter: (noise: NoiseLevelType | null) => void;
  clearFilters: () => void;
  /** 新增长椅及其时段体验；持久化失败时返回 null，调用方需提示并保留表单 */
  addBenchWithExperiences: (
    benchData: Omit<Bench, 'id' | 'createdAt' | 'updatedAt' | 'experiences'>,
    experiences: ExperienceDraft[]
  ) => string | null;
  /** 整体覆盖一张长椅的资料与时段体验（编辑提交）；返回是否保存成功 */
  updateBenchWithExperiences: (
    id: string,
    updates: Partial<Omit<Bench, 'id' | 'createdAt' | 'experiences'>>,
    experiences: ExperienceDraft[]
  ) => boolean;
  deleteBench: (id: string) => boolean;
  getBenchById: (id: string) => Bench | undefined;
  /** 新增或修改单条时段体验（详情页使用）；expId 为空表示新增 */
  upsertExperience: (
    benchId: string,
    expId: string | null,
    data: Omit<BenchExperience, 'id' | 'benchId'>
  ) => boolean;
  deleteExperience: (benchId: string, expId: string) => boolean;
  getFilteredBenches: () => Bench[];
}

const initialState: BenchState = {
  benches: [],
  searchQuery: '',
  materialFilter: null,
  orientationFilter: null,
  shadeFilter: null,
  noiseFilter: null,
  initialized: false,
};

/** 把表单里的时段草稿落成属于某张长椅的完整记录 */
function materializeExperiences(benchId: string, drafts: ExperienceDraft[]): BenchExperience[] {
  return drafts.map((draft) => ({
    id: draft.id || generateId(),
    benchId,
    timePeriod: draft.timePeriod,
    notes: draft.notes,
    rating: draft.rating,
  }));
}

export const useBenchStore = create<BenchState & BenchActions>((set, get) => ({
  ...initialState,

  initialize: () => {
    if (get().initialized) return;
    const stored = loadBenches();
    if (stored === null) {
      // 本地没有可用档案（首次打开或档案损坏）：播种示例数据
      set({ benches: mockBenches, initialized: true });
      saveBenches(mockBenches);
    } else {
      // 包括空数组：用户删光后不应被示例数据"复活"
      set({ benches: stored, initialized: true });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setMaterialFilter: (material) => set({ materialFilter: material }),
  setOrientationFilter: (orientation) => set({ orientationFilter: orientation }),
  setShadeFilter: (shade) => set({ shadeFilter: shade }),
  setNoiseFilter: (noise) => set({ noiseFilter: noise }),

  clearFilters: () => set({
    searchQuery: '',
    materialFilter: null,
    orientationFilter: null,
    shadeFilter: null,
    noiseFilter: null,
  }),

  addBenchWithExperiences: (benchData, experiences) => {
    const now = new Date().toISOString();
    const id = generateId();
    const newBench: Bench = {
      ...benchData,
      id,
      experiences: materializeExperiences(id, experiences),
      createdAt: now,
      updatedAt: now,
    };
    const newBenches = [newBench, ...get().benches];
    // 先持久化：失败则内存也不更新，旧数据原样保留
    if (!saveBenches(newBenches)) return null;
    set({ benches: newBenches });
    return id;
  },

  updateBenchWithExperiences: (id, updates, experiences) => {
    const newBenches = get().benches.map((bench) => {
      if (bench.id !== id) return bench;
      return {
        ...bench,
        ...updates,
        id: bench.id,
        createdAt: bench.createdAt,
        experiences: materializeExperiences(id, experiences),
        updatedAt: new Date().toISOString(),
      } as Bench;
    });
    if (!saveBenches(newBenches)) return false;
    set({ benches: newBenches });
    return true;
  },

  deleteBench: (id) => {
    const newBenches = get().benches.filter((bench) => bench.id !== id);
    if (!saveBenches(newBenches)) return false;
    set({ benches: newBenches });
    return true;
  },

  getBenchById: (id) => {
    return get().benches.find((bench) => bench.id === id);
  },

  upsertExperience: (benchId, expId, data) => {
    const newBenches = get().benches.map((bench) => {
      if (bench.id !== benchId) return bench;
      const exists = bench.experiences.some((exp) => exp.id === expId);
      const experiences = exists
        ? bench.experiences.map((exp) => (exp.id === expId ? { ...exp, ...data } : exp))
        : [...bench.experiences, { id: generateId(), benchId, ...data }];
      return { ...bench, experiences, updatedAt: new Date().toISOString() };
    });
    if (!saveBenches(newBenches)) return false;
    set({ benches: newBenches });
    return true;
  },

  deleteExperience: (benchId, expId) => {
    const newBenches = get().benches.map((bench) =>
      bench.id === benchId
        ? {
            ...bench,
            experiences: bench.experiences.filter((exp) => exp.id !== expId),
            updatedAt: new Date().toISOString(),
          }
        : bench
    );
    if (!saveBenches(newBenches)) return false;
    set({ benches: newBenches });
    return true;
  },

  getFilteredBenches: () => {
    const { benches, searchQuery, materialFilter, orientationFilter, shadeFilter, noiseFilter } = get();

    return benches.filter((bench) => {
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchName = bench.name.toLowerCase().includes(query);
        const matchLocation = bench.location.toLowerCase().includes(query);
        const matchReview = bench.review.toLowerCase().includes(query);
        if (!matchName && !matchLocation && !matchReview) return false;
      }

      if (materialFilter && bench.material !== materialFilter) return false;
      if (orientationFilter && bench.orientation !== orientationFilter) return false;
      if (shadeFilter && bench.shadeLevel !== shadeFilter) return false;
      if (noiseFilter && bench.noiseLevel !== noiseFilter) return false;

      return true;
    });
  },
}));
