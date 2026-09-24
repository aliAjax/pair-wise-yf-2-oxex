import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Sunrise,
  Sun,
  Sunset,
  Moon,
  CloudSun,
  AlertCircle,
} from 'lucide-react';
import { useBenchStore } from '@/store/useBenchStore';
import type { ExperienceDraft } from '@/store/useBenchStore';
import {
  MATERIAL_LABELS,
  ORIENTATION_LABELS,
  SHADE_LABELS,
  NOISE_LABELS,
  STAY_DURATION_LABELS,
  TIME_PERIOD_LABELS,
} from '@/types';
import type {
  MaterialType,
  OrientationType,
  ShadeLevelType,
  NoiseLevelType,
  StayDurationType,
  TimePeriodType,
} from '@/types';
import Rating from '@/components/Rating/Rating';
import { generateId } from '@/utils/comfort';

type BenchFormData = {
  name: string;
  location: string;
  lat: number;
  lng: number;
  material: MaterialType;
  orientation: OrientationType;
  hasBackrest: boolean;
  shadeLevel: ShadeLevelType;
  noiseLevel: NoiseLevelType;
  stayDuration: StayDurationType;
  rating: number;
  review: string;
};

const TIME_PERIOD_ORDER: TimePeriodType[] = ['morning', 'noon', 'afternoon', 'evening', 'night'];

const emptyForm: BenchFormData = {
  name: '',
  location: '',
  lat: 31.23,
  lng: 121.47,
  material: 'wood',
  orientation: 'south',
  hasBackrest: true,
  shadeLevel: 'partial',
  noiseLevel: 'moderate',
  stayDuration: 'medium',
  rating: 3,
  review: '',
};

export default function AddEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const {
    getBenchById,
    addBenchWithExperiences,
    updateBenchWithExperiences,
    initialize,
    initialized,
  } = useBenchStore();
  const existingBench = id ? getBenchById(id) : undefined;

  const [formData, setFormData] = useState<BenchFormData>(emptyForm);
  const [experiences, setExperiences] = useState<ExperienceDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formReady, setFormReady] = useState(false);

  useEffect(() => {
    if (!initialized) {
      initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    if (!initialized) return;
    if (isEdit) {
      if (!existingBench) {
        // 档案不存在（可能是损坏数据被清理）：回到列表，不覆盖用户输入
        navigate('/', { replace: true });
        return;
      }
      setFormData({
        name: existingBench.name,
        location: existingBench.location,
        lat: existingBench.lat,
        lng: existingBench.lng,
        material: existingBench.material,
        orientation: existingBench.orientation,
        hasBackrest: existingBench.hasBackrest,
        shadeLevel: existingBench.shadeLevel,
        noiseLevel: existingBench.noiseLevel,
        stayDuration: existingBench.stayDuration,
        rating: existingBench.rating,
        review: existingBench.review,
      });
      // 深拷贝一份，编辑过程中的增删改都不触碰已保存的旧数据
      setExperiences(
        existingBench.experiences.map((exp) => ({
          id: exp.id,
          timePeriod: exp.timePeriod,
          notes: exp.notes,
          rating: exp.rating,
        }))
      );
    } else {
      setFormData(emptyForm);
      setExperiences([]);
    }
    setError(null);
    setFormReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, isEdit, id]);

  const handleChange = (field: keyof BenchFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const usedPeriods = useMemo(
    () => new Set(experiences.map((exp) => exp.timePeriod)),
    [experiences]
  );

  const handleAddExperience = () => {
    const nextPeriod = TIME_PERIOD_ORDER.find((period) => !usedPeriods.has(period));
    if (!nextPeriod) {
      setError('五个时段都已经记录过了');
      return;
    }
    setExperiences((prev) => [
      ...prev,
      { id: generateId(), timePeriod: nextPeriod, notes: '', rating: 3 },
    ]);
    setError(null);
  };

  const handleUpdateExperience = (expId: string | undefined, field: string, value: string | number) => {
    setExperiences((prev) =>
      prev.map((exp) =>
        (exp.id || '') === (expId || '') ? { ...exp, [field]: value } : exp
      )
    );
    setError(null);
  };

  const handleDeleteExperience = (expId: string | undefined) => {
    // 仅移除本地暂存，旧档案要等保存成功后才会变化
    setExperiences((prev) => prev.filter((exp) => exp.id !== expId));
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setError('请输入长椅名称');
      return;
    }
    if (!formData.location.trim()) {
      setError('请输入位置描述');
      return;
    }

    const sanitizedExperiences = experiences.map((exp) => ({
      ...exp,
      notes: exp.notes.trim(),
    }));

    if (isEdit && id) {
      const ok = updateBenchWithExperiences(
        id,
        {
          ...formData,
          name: formData.name.trim(),
          location: formData.location.trim(),
        },
        sanitizedExperiences
      );
      if (!ok) {
        setError('保存失败：本地存储不可用（可能空间已满），旧档案与当前填写的内容都已保留，请重试。');
        return;
      }
      navigate(`/bench/${id}`, { replace: true });
    } else {
      const newId = addBenchWithExperiences(
        {
          ...formData,
          name: formData.name.trim(),
          location: formData.location.trim(),
        },
        sanitizedExperiences
      );
      if (!newId) {
        setError('保存失败：本地存储不可用（可能空间已满），当前填写的内容已保留，请重试。');
        return;
      }
      navigate(`/bench/${newId}`, { replace: true });
    }
  };

  const timePeriodIcons: Record<TimePeriodType, typeof Sunrise> = {
    morning: Sunrise,
    noon: Sun,
    afternoon: CloudSun,
    evening: Sunset,
    night: Moon,
  };

  if (!formReady) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center py-12">
          <p className="text-ink-light">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-ink-light hover:text-deep-brown mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">返回</span>
      </button>

      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-2xl font-bold text-deep-brown mb-6">
          {isEdit ? '编辑长椅档案' : '添加长椅档案'}
        </h1>

        {error && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 fade-in"
          >
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-1">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              基本信息
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  长椅名称 *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="给这张长椅起个名字"
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown placeholder:text-ink-light/60 focus:bg-white transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  位置描述 *
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => handleChange('location', e.target.value)}
                  placeholder="例如：人民公园东门北侧"
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown placeholder:text-ink-light/60 focus:bg-white transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-deep-brown mb-1.5">
                    纬度
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lat}
                    onChange={(e) => handleChange('lat', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-deep-brown mb-1.5">
                    经度
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    value={formData.lng}
                    onChange={(e) => handleChange('lng', parseFloat(e.target.value) || 0)}
                    className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-2">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              特征属性
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  材质
                </label>
                <select
                  value={formData.material}
                  onChange={(e) => handleChange('material', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(MATERIAL_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  朝向
                </label>
                <select
                  value={formData.orientation}
                  onChange={(e) => handleChange('orientation', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(ORIENTATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  遮阴情况
                </label>
                <select
                  value={formData.shadeLevel}
                  onChange={(e) => handleChange('shadeLevel', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(SHADE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  噪音等级
                </label>
                <select
                  value={formData.noiseLevel}
                  onChange={(e) => handleChange('noiseLevel', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(NOISE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  适合停留时长
                </label>
                <select
                  value={formData.stayDuration}
                  onChange={(e) => handleChange('stayDuration', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown focus:bg-white cursor-pointer"
                >
                  {Object.entries(STAY_DURATION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  是否有靠背
                </label>
                <div className="flex items-center gap-4 h-[42px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hasBackrest"
                      checked={formData.hasBackrest}
                      onChange={() => handleChange('hasBackrest', true)}
                      className="text-moss-green focus:ring-moss-green"
                    />
                    <span className="text-sm text-deep-brown">有</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hasBackrest"
                      checked={!formData.hasBackrest}
                      onChange={() => handleChange('hasBackrest', false)}
                      className="text-moss-green focus:ring-moss-green"
                    />
                    <span className="text-sm text-deep-brown">无</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-3">
            <h2 className="font-serif text-lg font-semibold text-deep-brown mb-4">
              个人评价
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  综合评分
                </label>
                <Rating
                  value={formData.rating}
                  onChange={(value) => handleChange('rating', value)}
                  size="lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-deep-brown mb-1.5">
                  评价文字
                </label>
                <textarea
                  value={formData.review}
                  onChange={(e) => handleChange('review', e.target.value)}
                  placeholder="写下你对这张长椅的感受..."
                  rows={4}
                  className="w-full px-4 py-2.5 bg-white/50 border border-deep-brown/10 rounded-lg text-deep-brown placeholder:text-ink-light/60 focus:bg-white transition-colors resize-none"
                />
              </div>
            </div>
          </div>

          <div className="paper-texture rounded-xl shadow-paper p-6 fade-in opacity-0 stagger-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-lg font-semibold text-deep-brown">
                分时段体验
              </h2>
              <button
                type="button"
                onClick={handleAddExperience}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-moss-green hover:bg-moss-green/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加时段
              </button>
            </div>

            {experiences.length > 0 ? (
              <div className="space-y-4">
                {experiences.map((exp) => {
                  const TimeIcon = timePeriodIcons[exp.timePeriod];
                  return (
                    <div
                      key={exp.id}
                      className="p-4 bg-warm-cream/50 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <TimeIcon className="w-5 h-5 text-ochre" />
                          <select
                            value={exp.timePeriod}
                            onChange={(e) =>
                              handleUpdateExperience(exp.id, 'timePeriod', e.target.value)
                            }
                            className="px-2 py-1 text-sm bg-white border border-deep-brown/10 rounded-md text-deep-brown cursor-pointer"
                          >
                            {Object.entries(TIME_PERIOD_LABELS).map(([value, label]) => {
                              const taken = usedPeriods.has(value as TimePeriodType) && value !== exp.timePeriod;
                              return (
                                <option key={value} value={value} disabled={taken}>
                                  {label}
                                  {taken ? '（已记录）' : ''}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteExperience(exp.id)}
                          className="p-1.5 text-red-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                          aria-label="删除该时段记录"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mb-3">
                        <label className="text-xs text-ink-light mb-1 block">
                          时段评分
                        </label>
                        <Rating
                          value={exp.rating}
                          onChange={(value) =>
                            handleUpdateExperience(exp.id, 'rating', value)
                          }
                          size="sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-ink-light mb-1 block">
                          体验备注
                        </label>
                        <textarea
                          value={exp.notes}
                          onChange={(e) =>
                            handleUpdateExperience(exp.id, 'notes', e.target.value)
                          }
                          placeholder="记录这个时段的体验..."
                          rows={2}
                          className="w-full px-3 py-2 text-sm bg-white/60 border border-deep-brown/10 rounded-md text-deep-brown placeholder:text-ink-light/60 focus:bg-white resize-none"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-ink-light">
                  还没有添加时段体验
                </p>
                <p className="text-xs text-ink-light/60 mt-1">
                  可以记录早晨、中午、下午等不同时段的感受
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-4 pb-6">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 px-6 py-3 bg-warm-beige text-deep-brown rounded-xl font-medium hover:bg-warm-beige/80 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 bg-moss-green text-white rounded-xl font-medium hover:bg-moss-light transition-colors shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isEdit ? '保存修改' : '添加档案'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
