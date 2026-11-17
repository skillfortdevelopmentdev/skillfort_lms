import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { Course } from '../types';
import { resolveMediaUrl } from '../api/config';
import { useSearch } from '../hooks/useSearch';

export type CourseCatalogTheme = {
  card: string;
  cardHover: string;
  innerCard: string;
  textWhite: string;
  textMuted: string;
  textMutedSecondary: string;
  border: string;
  input: string;
};

export function buildCourseCatalogTheme(isDarkMode: boolean): CourseCatalogTheme {
  return {
    card: isDarkMode ? 'bg-[#111111] border-[#222222]' : 'bg-white border-slate-200/80 shadow-xs',
    cardHover: isDarkMode ? 'hover:border-[#F89A15]/40' : 'hover:border-[#F89A15]/50',
    innerCard: isDarkMode ? 'bg-black/40 border-[#222222]' : 'bg-slate-100/50 border-slate-200/60',
    textWhite: isDarkMode ? 'text-white' : 'text-slate-950',
    textMuted: isDarkMode ? 'text-gray-400' : 'text-slate-500',
    textMutedSecondary: isDarkMode ? 'text-gray-500' : 'text-slate-400',
    border: isDarkMode ? 'border-[#222222]' : 'border-slate-200/80',
    input: isDarkMode
      ? 'bg-black border-[#222222] text-white focus:border-[#F89A15]'
      : 'bg-slate-100/80 border-slate-200 text-slate-950 focus:border-[#F89A15] focus:bg-white focus:ring-1 focus:ring-[#F89A15]/20',
  };
}

interface CourseCatalogProps {
  courses: Course[];
  isDarkMode?: boolean;
  title?: string;
  subtitle?: string;
  enrolledCourseIds?: string[];
  initialSearchQuery?: string;
  onViewCourse: (courseId: string) => void;
  onContinueCourse?: (course: Course) => void;
  onAddToCart?: (courseId: string) => Promise<void>;
  onEnrollFree?: (course: Course) => void;
}

export default function CourseCatalog({
  courses,
  isDarkMode = true,
  title = 'Our Courses',
  subtitle = 'Job-oriented IT courses with placement support from industry experts.',
  enrolledCourseIds = [],
  initialSearchQuery = '',
  onViewCourse,
  onContinueCourse,
  onAddToCart,
  onEnrollFree,
}: CourseCatalogProps) {
  const theme = useMemo(() => buildCourseCatalogTheme(isDarkMode), [isDarkMode]);
  const enrolledSet = useMemo(() => new Set(enrolledCourseIds), [enrolledCourseIds]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addingCourseId, setAddingCourseId] = useState<string | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedLevel,
    setSelectedLevel,
    minPrice,
    setMinPrice,
    maxPrice,
    setMaxPrice,
    absoluteMinPrice,
    absoluteMaxPrice,
    categories,
    levels,
    resetFilters,
    filteredCourses: searchResults,
  } = useSearch(courses);

  useEffect(() => {
    if (initialSearchQuery) {
      setSearchQuery(initialSearchQuery);
    }
  }, [initialSearchQuery, setSearchQuery]);

  const handleAddToCartClick = async (e: React.MouseEvent, course: Course) => {
    e.stopPropagation();
    if (!onAddToCart || enrolledSet.has(course.id) || course.price <= 0) return;
    setAddingCourseId(course.id);
    try {
      await onAddToCart(course.id);
    } finally {
      setAddingCourseId(null);
    }
  };

  const renderCourseAction = (course: Course) => {
    const isEnrolled = enrolledSet.has(course.id);
    const isFree = course.price <= 0;

    if (isEnrolled) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onContinueCourse?.(course);
          }}
          className="px-3 py-1.5 text-[10px] bg-emerald-500 text-black font-bold rounded-lg hover:bg-emerald-400 transition-colors"
        >
          Continue
        </button>
      );
    }

    if (isFree) {
      return (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onEnrollFree) {
              onEnrollFree(course);
            } else {
              onViewCourse(course.id);
            }
          }}
          className="px-3 py-1.5 text-[10px] bg-[#F89A15] text-black font-bold rounded-lg hover:bg-neutral-900 hover:text-white transition-colors"
        >
          Enroll free
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={addingCourseId === course.id || !onAddToCart}
        onClick={(e) => void handleAddToCartClick(e, course)}
        className="px-3 py-1.5 text-[10px] border border-[#F89A15]/40 text-[#F89A15] hover:bg-[#F89A15] hover:text-black font-bold rounded-lg transition-colors disabled:opacity-60"
      >
        {addingCourseId === course.id ? 'Adding…' : 'Add to cart'}
      </button>
    );
  };

  return (
    <div className="space-y-12 text-left animate-fade-in">
      <div className="space-y-3">
        <h1 className={`text-3xl font-display font-black tracking-tight ${theme.textWhite}`}>{title}</h1>
        <p className={`${theme.textMuted} text-sm`}>{subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setFiltersOpen((value) => !value)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border ${theme.card} text-sm font-semibold ${theme.textWhite}`}
          >
            <span className="flex items-center gap-2">
              <Search size={16} className="text-[#F89A15]" />
              {filtersOpen ? 'Hide Filters' : 'Show Filters'}
            </span>
            {(selectedCategory !== 'All' ||
              selectedLevel !== 'All' ||
              searchQuery !== '' ||
              minPrice !== absoluteMinPrice ||
              maxPrice !== absoluteMaxPrice) && (
              <span className="text-[10px] font-bold uppercase text-[#F89A15]">Active</span>
            )}
          </button>
        </div>

        <div
          className={`lg:col-span-3 space-y-6 p-6 rounded-2xl border ${theme.card} transition-all ${
            filtersOpen ? 'block' : 'hidden'
          } lg:block`}
        >
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-bold uppercase tracking-wider ${theme.textWhite}`}>
              Refine Blueprints
            </h3>
            {(selectedCategory !== 'All' ||
              selectedLevel !== 'All' ||
              searchQuery !== '' ||
              minPrice !== absoluteMinPrice ||
              maxPrice !== absoluteMaxPrice) && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-[10px] font-bold uppercase text-[#F89A15] hover:text-[#f3ab3d] transition-colors cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          <div className="space-y-2">
            <label className={`text-[10px] font-bold uppercase ${theme.textMutedSecondary} block`}>
              Keyword Search
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="e.g. Java, SQL, React..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full ${theme.input} text-xs pl-8 pr-3 py-2 h-9 rounded-lg font-medium outline-none transition-all placeholder:text-gray-500`}
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <span className={`text-[10px] font-bold uppercase ${theme.textMutedSecondary} block`}>
              Domain Category
            </span>
            <div className="flex flex-col gap-1.5">
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat;
                const count =
                  cat === 'All' ? courses.length : courses.filter((c) => c.category === cat).length;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full text-left text-xs px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#F89A15] text-black font-extrabold border-[#F89A15]'
                        : `${isDarkMode ? 'bg-black/50 border-[#222222] text-gray-400 hover:text-white hover:border-[#F89A15]/40' : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-250/50'}`
                    }`}
                  >
                    <span className="truncate">{cat}</span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-black/20 text-black'
                          : isDarkMode
                            ? 'bg-[#222222] text-gray-400'
                            : 'bg-slate-250 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5">
            <span className={`text-[10px] font-bold uppercase ${theme.textMutedSecondary} block`}>
              Technical Level
            </span>
            <div className="flex flex-col gap-1.5">
              {levels.map((lvl) => {
                const isSelected = selectedLevel === lvl;
                const count =
                  lvl === 'All' ? courses.length : courses.filter((c) => c.level === lvl).length;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedLevel(lvl)}
                    className={`w-full text-left text-xs px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer ${
                      isSelected
                        ? 'bg-[#F89A15] text-black font-extrabold border-[#F89A15]'
                        : `${isDarkMode ? 'bg-black/50 border-[#222222] text-gray-400 hover:text-white hover:border-[#F89A15]/40' : 'bg-slate-100 border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-250/50'}`
                    }`}
                  >
                    <span>{lvl}</span>
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-black/20 text-black'
                          : isDarkMode
                            ? 'bg-[#222222] text-gray-400'
                            : 'bg-slate-250 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3.5 pt-2 border-t border-slate-200 dark:border-[#222222]">
            <span className={`text-[10px] font-bold uppercase ${theme.textMutedSecondary} block`}>
              Investment Range
            </span>
            <div className="space-y-2">
              <div className="flex justify-between text-[11px] font-mono text-gray-500">
                <span>Min: ₹{minPrice}</span>
                <span>Max: ₹{maxPrice}</span>
              </div>
              <input
                type="range"
                min={absoluteMinPrice}
                max={absoluteMaxPrice}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full h-1 bg-slate-200 dark:bg-[#222222] rounded-lg appearance-none cursor-pointer accent-[#F89A15]"
              />
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice(absoluteMinPrice);
                    setMaxPrice(2500);
                  }}
                  className={`text-[9px] font-bold px-2 py-1 rounded border transition-colors cursor-pointer ${
                    maxPrice <= 2500 && minPrice === absoluteMinPrice
                      ? 'bg-[#F89A15]/20 text-[#F89A15] border-[#F89A15]/40'
                      : 'bg-black/10 dark:bg-black/30 border-slate-200 dark:border-[#222222]/80 text-gray-500 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Under ₹2.5k
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice(2501);
                    setMaxPrice(absoluteMaxPrice);
                  }}
                  className={`text-[9px] font-bold px-2 py-1 rounded border transition-colors cursor-pointer ${
                    minPrice >= 2500 && maxPrice === absoluteMaxPrice
                      ? 'bg-[#F89A15]/20 text-[#F89A15] border-[#F89A15]/40'
                      : 'bg-black/10 dark:bg-black/30 border-slate-200 dark:border-[#222222]/80 text-gray-500 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  Above ₹2.5k
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMinPrice(absoluteMinPrice);
                    setMaxPrice(absoluteMaxPrice);
                  }}
                  className="text-[9px] font-bold px-2 py-1 rounded border border-slate-200 dark:border-[#222222]/80 bg-black/10 dark:bg-black/30 text-gray-500 hover:text-slate-950 dark:hover:text-white cursor-pointer"
                >
                  All
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-9 space-y-6">
          <div
            className={`flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b ${theme.border}`}
          >
            <div className={`text-xs ${theme.textMuted}`}>
              Showing{' '}
              <b className={`${theme.textWhite} font-mono pl-0.5`}>{searchResults.length}</b> curriculums
              matching filters
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1.5 sm:pt-0">
              {selectedCategory !== 'All' && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#F89A15]/10 text-[#F89A15] border border-[#F89A15]/20">
                  {selectedCategory}
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('All')}
                    className="hover:opacity-75 cursor-pointer"
                  >
                    <X size={10} className="stroke-[3]" />
                  </button>
                </span>
              )}
              {selectedLevel !== 'All' && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#F89A15]/10 text-[#F89A15] border border-[#F89A15]/20">
                  Level: {selectedLevel}
                  <button
                    type="button"
                    onClick={() => setSelectedLevel('All')}
                    className="hover:opacity-75 cursor-pointer"
                  >
                    <X size={10} className="stroke-[3]" />
                  </button>
                </span>
              )}
              {(minPrice !== absoluteMinPrice || maxPrice !== absoluteMaxPrice) && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#F89A15]/10 text-[#F89A15] border border-[#F89A15]/20">
                  ₹{minPrice} - ₹{maxPrice}
                  <button
                    type="button"
                    onClick={() => {
                      setMinPrice(absoluteMinPrice);
                      setMaxPrice(absoluteMaxPrice);
                    }}
                    className="hover:opacity-75 cursor-pointer"
                  >
                    <X size={10} className="stroke-[3]" />
                  </button>
                </span>
              )}
              {searchQuery.trim() !== '' && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#F89A15]/10 text-[#F89A15] border border-[#F89A15]/20 animate-pulse">
                  &ldquo;{searchQuery}&rdquo;
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="hover:opacity-75 cursor-pointer"
                  >
                    <X size={10} className="stroke-[3]" />
                  </button>
                </span>
              )}
            </div>
          </div>

          {searchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((course) => (
                <div
                  key={course.id}
                  onClick={() => onViewCourse(course.id)}
                  className={`group ${theme.card} ${theme.cardHover} rounded-2xl overflow-hidden transition-all flex flex-col justify-between cursor-pointer hover:-translate-y-1 border`}
                >
                  <div className="text-left">
                    <div className="relative aspect-video">
                      <img
                        src={resolveMediaUrl(course.coverImage)}
                        alt={course.title}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2.5 left-2.5 bg-black/80 border border-[#222222] px-2 py-0.5 rounded text-[9px] uppercase font-bold text-gray-300">
                        {course.level}
                      </div>
                    </div>
                    <div className="p-6 space-y-3">
                      <span className="text-[9px] uppercase tracking-wider text-[#F89A15] font-extrabold">
                        {course.category}
                      </span>
                      <h3
                        className={`font-display font-bold text-base ${theme.textWhite} group-hover:text-[#F89A15] transition-colors`}
                      >
                        {course.title}
                      </h3>
                      <p className={`${theme.textMuted} text-xs leading-relaxed line-clamp-3`}>
                        {course.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 pt-0 mt-4 text-left">
                    <div
                      className={`border-t ${theme.border} pt-4 flex items-center justify-between text-xs ${theme.textMuted} mb-4`}
                    >
                      <span>
                        Course Rating:{' '}
                        <b className="text-yellow-500 font-bold">{course.rating}</b>
                      </span>
                      <span>{course.duration} Syllabus</span>
                    </div>
                    <div
                      className={`flex justify-between items-center gap-2 ${theme.innerCard} p-2 rounded-xl border ${theme.border}`}
                    >
                      <span className={`font-mono text-xs ${theme.textWhite} pl-2`}>
                        {course.price <= 0 ? 'FREE' : `₹${course.price}`}
                        {course.price > 0 && (
                          <span className={`text-[10px] font-sans font-light ${theme.textMuted}`}>
                            {' '}
                            (Inclusive GST)
                          </span>
                        )}
                      </span>
                      <div className="flex items-center gap-1.5 pr-1">
                        {renderCourseAction(course)}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewCourse(course.id);
                          }}
                          className="px-3 py-1.5 bg-[#F89A15] text-black text-[10px] font-bold rounded-lg hover:bg-neutral-900 hover:text-white transition-colors"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`flex flex-col items-center justify-center p-12 text-center border-2 border-dashed ${theme.border} rounded-2xl py-20 space-y-4`}
            >
              <div className="w-14 h-14 bg-[#F89A15]/10 rounded-full flex items-center justify-center text-[#F89A15]">
                <Search size={22} />
              </div>
              <div className="space-y-1">
                <h4 className={`text-base font-bold ${theme.textWhite}`}>No Matching Blueprints Found</h4>
                <p className={`text-xs ${theme.textMuted} max-w-xs mx-auto`}>
                  Adjust your active filters, keyword query, or pricing constraints to view other
                  premium curriculum paths.
                </p>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 bg-[#F89A15] text-black text-xs font-bold rounded-lg hover:bg-neutral-900 hover:text-white transition-all cursor-pointer shadow-md"
              >
                Reset All Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
