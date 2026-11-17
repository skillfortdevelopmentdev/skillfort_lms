import React, { useMemo } from 'react';
import { resolveMediaUrl } from '../api/config';
import {
  Award,
  BookOpen,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Flame,
  Play,
  ShoppingCart,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Certificate, Course, CourseModule, Enrollment, Lesson, User } from '../types';
import type { ContinueTarget } from '../utils/courseProgress';

export interface QuizAttempt {
  id: string;
  courseTitle: string;
  quizName: string;
  score: number;
  date: string;
}

interface StudentDashboardProps {
  currentUser: User;
  courses: Course[];
  modules: CourseModule[];
  lessons: Lesson[];
  enrollments: Enrollment[];
  certificates: Certificate[];
  continueTargets: ContinueTarget[];
  quizAttempts: QuizAttempt[];
  unreadAlerts: number;
  isDarkMode: boolean;
  onContinueCourse: (course: Course, lessonId?: string) => void;
  onBrowseCourses: () => void;
  onViewCertificates: () => void;
  onViewQuizResults: () => void;
  onViewAlerts: () => void;
  onAddToCart: (courseId: string) => void;
  onBuyNow: (course: Course) => void;
}

const CHART_COLORS = ['#F89A15', '#22C55E', '#3B82F6', '#A855F7', '#F97316', '#06B6D4'];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function parseDurationHours(duration: string): number {
  const h = duration.match(/(\d+)\s*h/i);
  const m = duration.match(/(\d+)\s*m/i);
  return (h ? parseInt(h[1], 10) : 0) + (m ? parseInt(m[1], 10) / 60 : 0);
}

function dashboardTheme(isDarkMode: boolean) {
  return {
    hero: isDarkMode
      ? 'border-[#222222] bg-gradient-to-br from-[#1a1208] via-[#111111] to-black'
      : 'border-slate-200 bg-gradient-to-br from-amber-50 via-white to-slate-100 shadow-sm',
    heroGlow: isDarkMode
      ? 'bg-[radial-gradient(ellipse_at_top_right,_rgba(248,154,21,0.18),_transparent_55%)]'
      : 'bg-[radial-gradient(ellipse_at_top_right,_rgba(248,154,21,0.12),_transparent_55%)]',
    heroGrid: isDarkMode
      ? 'opacity-[0.04] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]'
      : 'opacity-[0.45] [background-image:linear-gradient(#cbd5e1_1px,transparent_1px),linear-gradient(90deg,#cbd5e1_1px,transparent_1px)] [background-size:32px_32px]',
    heading: isDarkMode ? 'text-white' : 'text-slate-900',
    subtext: isDarkMode ? 'text-gray-400' : 'text-slate-600',
    muted: isDarkMode ? 'text-gray-500' : 'text-slate-500',
    pill: isDarkMode
      ? 'border-[#222222] bg-black/40 text-gray-400'
      : 'border-slate-200 bg-white/90 text-slate-500 shadow-xs',
    miniStat: isDarkMode
      ? 'border-[#222222]/80 bg-black/50'
      : 'border-slate-200 bg-white/95 shadow-sm',
    card: isDarkMode
      ? 'border-[#222222] bg-gradient-to-br from-[#121212] to-[#0a0a0a]'
      : 'border-slate-200 bg-white shadow-sm',
    cardDivider: isDarkMode ? 'border-[#222222]' : 'border-slate-200',
    statCard: isDarkMode
      ? 'border-[#222222] bg-gradient-to-br from-[#141414] to-[#0a0a0a] hover:border-[#F89A15]/30 hover:shadow-lg hover:shadow-[#F89A15]/5'
      : 'border-slate-200 bg-white shadow-sm hover:border-[#F89A15]/40 hover:shadow-md',
    statValue: isDarkMode ? 'text-white' : 'text-slate-900',
    statSub: isDarkMode ? 'text-gray-400' : 'text-slate-500',
    secondaryBtn: isDarkMode
      ? 'border-[#222222] bg-black/50 text-white hover:border-[#F89A15]/40 hover:text-[#F89A15]'
      : 'border-slate-200 bg-white text-slate-800 hover:border-[#F89A15]/50 hover:text-[#F89A15] shadow-xs',
    continueCard: isDarkMode
      ? 'border-[#222222] bg-[#111111] hover:border-[#F89A15]/35'
      : 'border-slate-200 bg-white shadow-sm hover:border-[#F89A15]/40',
    quickLink: isDarkMode
      ? 'border-[#222222] bg-[#111111] hover:border-[#F89A15]/30'
      : 'border-slate-200 bg-white shadow-sm hover:border-[#F89A15]/40',
    discoverCard: isDarkMode
      ? 'border-[#222222] bg-[#0a0a0a] hover:border-[#F89A15]/30'
      : 'border-slate-200 bg-white shadow-sm hover:border-[#F89A15]/40',
    empty: isDarkMode
      ? 'border-dashed border-[#333333] bg-[#0a0a0a]'
      : 'border-dashed border-slate-300 bg-slate-50',
    innerTile: isDarkMode ? 'border-[#222222] bg-black/40' : 'border-slate-200 bg-slate-50',
    badge: isDarkMode ? 'border-[#222222] bg-[#111111]' : 'border-slate-200 bg-slate-100',
    chartGrid: isDarkMode ? '#222222' : '#e2e8f0',
    chartAxis: isDarkMode ? '#64748b' : '#94a3b8',
    chartRemaining: isDarkMode ? '#333333' : '#e2e8f0',
    chartPieRemaining: isDarkMode ? '#2a2a2a' : '#e2e8f0',
    ringTrack: isDarkMode ? '#222222' : '#e2e8f0',
    ringLabel: isDarkMode ? 'text-white' : 'text-slate-900',
    legend: isDarkMode ? '#9ca3af' : '#64748b',
    imageOverlay: isDarkMode
      ? 'bg-gradient-to-t from-black via-black/20 to-transparent'
      : 'bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent',
    levelBadge: isDarkMode ? 'bg-black/70' : 'bg-white/90',
    cartBtn: isDarkMode
      ? 'border-[#222222] text-gray-400 hover:border-[#F89A15]/40 hover:text-[#F89A15]'
      : 'border-slate-200 text-slate-500 hover:border-[#F89A15]/40 hover:text-[#F89A15] bg-white',
    price: isDarkMode ? 'text-white' : 'text-slate-900',
    viewAll: isDarkMode ? 'hover:text-white' : 'hover:text-slate-900',
    emptyIcon: isDarkMode ? 'text-gray-600' : 'text-slate-300',
    tooltip: {
      backgroundColor: isDarkMode ? '#111111' : '#ffffff',
      borderColor: isDarkMode ? '#333333' : '#e2e8f0',
      color: isDarkMode ? '#ffffff' : '#0f172a',
      borderRadius: '12px',
      fontSize: '11px',
      borderWidth: '1px',
      boxShadow: isDarkMode ? '0 8px 24px rgba(0,0,0,0.25)' : '0 8px 24px rgba(15,23,42,0.08)',
    },
  };
}

type Theme = ReturnType<typeof dashboardTheme>;

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  trend,
  theme,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  trend?: string;
  theme: Theme;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-5 transition-all ${theme.statCard}`}>
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-35"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${theme.muted}`}>{label}</p>
          <p className={`font-display text-2xl font-black ${theme.statValue}`}>{value}</p>
          {sub && <p className={`text-[10px] font-mono ${theme.statSub}`}>{sub}</p>}
          {trend && (
            <p className="flex items-center gap-1 text-[10px] font-semibold text-emerald-500">
              <TrendingUp size={11} /> {trend}
            </p>
          )}
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
          style={{ borderColor: `${accent}40`, backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function ProgressRing({
  percent,
  trackColor,
  size = 56,
  stroke = 5,
}: {
  percent: number;
  trackColor: string;
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#F89A15"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        className="transition-all duration-700"
      />
    </svg>
  );
}

export default function StudentDashboard({
  currentUser,
  courses,
  modules,
  lessons,
  enrollments,
  certificates,
  continueTargets,
  quizAttempts,
  unreadAlerts,
  isDarkMode,
  onContinueCourse,
  onBrowseCourses,
  onViewCertificates,
  onViewQuizResults,
  onViewAlerts,
  onAddToCart,
  onBuyNow,
}: StudentDashboardProps) {
  const t = dashboardTheme(isDarkMode);

  const enrolledCourses = useMemo(
    () => courses.filter((c) => enrollments.some((e) => e.courseId === c.id)),
    [courses, enrollments]
  );

  const getCourseStats = (courseId: string) => {
    const courseModules = modules.filter((m) => m.courseId === courseId);
    const moduleIds = courseModules.map((m) => m.id);
    const total = lessons.filter((l) => moduleIds.includes(l.moduleId)).length;
    const enrollment = enrollments.find((e) => e.courseId === courseId);
    const percent = enrollment?.progressPercentage || 0;
    const completed = total > 0 ? Math.round((percent / 100) * total) : 0;
    return { total, completed, remaining: Math.max(0, total - completed), percent, isComplete: percent >= 100 };
  };

  const progressChartData = useMemo(
    () =>
      enrolledCourses.map((course, i) => {
        const stats = getCourseStats(course.id);
        return {
          name: course.title.length > 16 ? `${course.title.slice(0, 14)}…` : course.title,
          fullName: course.title,
          Completed: stats.completed,
          Remaining: stats.remaining,
          percent: stats.percent,
          fill: CHART_COLORS[i % CHART_COLORS.length],
        };
      }),
    [enrolledCourses, modules, lessons, enrollments]
  );

  const totalCompleted = progressChartData.reduce((a, c) => a + c.Completed, 0);
  const totalRemaining = progressChartData.reduce((a, c) => a + c.Remaining, 0);
  const totalLessons = totalCompleted + totalRemaining;
  const overallPercent = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  const pieData = [
    { name: 'Completed', value: totalCompleted || 0, fill: '#F89A15' },
    { name: 'In progress', value: totalLessons === 0 ? 1 : totalRemaining, fill: t.chartPieRemaining },
  ];

  const avgQuizScore =
    quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((s, q) => s + q.score, 0) / quizAttempts.length)
      : 0;

  const passedQuizzes = quizAttempts.filter((q) => q.score >= 70).length;
  const learningHours = enrolledCourses.reduce((sum, c) => {
    const stats = getCourseStats(c.id);
    const courseHours = parseDurationHours(c.duration) || 10;
    return sum + (courseHours * stats.percent) / 100;
  }, 0);

  const weeklyActivity = useMemo(() => {
    const days: { day: string; lessons: number; quizzes: number; score: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayQuizzes = quizAttempts.filter((q) => q.date === dateStr);
      const quizCount = dayQuizzes.length;
      const avgScore = quizCount > 0 ? Math.round(dayQuizzes.reduce((s, q) => s + q.score, 0) / quizCount) : 0;
      const lessonProxy =
        i === 0
          ? Math.min(8, Math.max(1, Math.round(totalCompleted / Math.max(enrolledCourses.length, 1) / 3)))
          : Math.max(0, Math.round((totalCompleted / 7) * (0.6 + (i % 3) * 0.15)));
      days.push({
        day: dayLabel,
        lessons: enrolledCourses.length > 0 ? lessonProxy + quizCount * 2 : quizCount * 3,
        quizzes: quizCount,
        score: avgScore,
      });
    }
    return days;
  }, [quizAttempts, totalCompleted, enrolledCourses.length]);

  const quizChartData = useMemo(
    () =>
      quizAttempts.slice(0, 6).map((q) => ({
        name: q.quizName.length > 14 ? `${q.quizName.slice(0, 12)}…` : q.quizName,
        score: q.score,
        fill: q.score >= 70 ? '#22C55E' : '#F97316',
      })),
    [quizAttempts]
  );

  const completedCourses = enrolledCourses.filter((c) => getCourseStats(c.id).isComplete).length;
  const availableCourses = courses.filter((c) => !enrollments.some((e) => e.courseId === c.id));

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="space-y-8 pb-4">
      {/* Hero */}
      <section className={`relative overflow-hidden rounded-3xl border p-6 md:p-8 ${t.hero}`}>
        <div className={`pointer-events-none absolute inset-0 ${t.heroGlow}`} />
        <div className={`pointer-events-none absolute inset-0 ${t.heroGrid}`} />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#F89A15]/30 bg-[#F89A15]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#F89A15]">
                <Sparkles size={12} /> Learning dashboard
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-mono ${t.pill}`}>
                <Calendar size={11} /> {todayLabel}
              </span>
            </div>
            <h1 className={`font-display text-3xl font-black leading-tight md:text-4xl ${t.heading}`}>
              {getGreeting()}, {currentUser.name.split(' ')[0]}!
            </h1>
            <p className={`text-sm leading-relaxed ${t.subtext}`}>
              Track your progress, quiz performance, and certificates — all in one place. Pick up where you left off or explore new courses.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onBrowseCourses}
                className="inline-flex items-center gap-2 rounded-xl bg-[#F89A15] px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-black transition-all hover:bg-[#e08a10]"
              >
                <BookOpen size={14} /> Browse courses
              </button>
              {certificates.length > 0 && (
                <button
                  type="button"
                  onClick={onViewCertificates}
                  className={`inline-flex items-center gap-2 rounded-xl border px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all ${t.secondaryBtn}`}
                >
                  <Award size={14} /> My certificates
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {[
              { label: 'Enrolled', value: enrolledCourses.length, icon: BookOpen },
              { label: 'Completed', value: completedCourses, icon: CheckCircle2 },
              { label: 'Certificates', value: certificates.length, icon: Trophy },
              { label: 'Avg quiz', value: avgQuizScore ? `${avgQuizScore}%` : '—', icon: Target },
            ].map((item) => (
              <div key={item.label} className={`rounded-2xl border px-4 py-3 text-center backdrop-blur-sm ${t.miniStat}`}>
                <item.icon size={16} className="mx-auto mb-1 text-[#F89A15]" />
                <p className={`font-display text-xl font-black ${t.statValue}`}>{item.value}</p>
                <p className={`text-[9px] font-bold uppercase tracking-wider ${t.muted}`}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Overall progress"
          value={`${overallPercent}%`}
          sub={`${totalCompleted} of ${totalLessons || '—'} lessons done`}
          icon={TrendingUp}
          accent="#F89A15"
          trend={overallPercent > 0 ? 'Keep going!' : undefined}
          theme={t}
        />
        <StatCard
          label="Learning hours"
          value={learningHours < 1 ? '<1h' : `${learningHours.toFixed(1)}h`}
          sub="Estimated from syllabus progress"
          icon={Clock}
          accent="#3B82F6"
          theme={t}
        />
        <StatCard
          label="Quiz performance"
          value={quizAttempts.length ? `${avgQuizScore}%` : 'No attempts'}
          sub={quizAttempts.length ? `${passedQuizzes}/${quizAttempts.length} passed` : 'Take your first quiz'}
          icon={Zap}
          accent="#22C55E"
          theme={t}
        />
        <StatCard
          label="Alerts"
          value={unreadAlerts}
          sub={unreadAlerts ? 'Unread notifications' : 'All caught up'}
          icon={Bell}
          accent="#A855F7"
          theme={t}
        />
      </section>

      {enrolledCourses.length > 0 ? (
        <>
          {/* Charts row */}
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className={`xl:col-span-7 rounded-2xl border p-6 ${t.card}`}>
              <div className={`mb-5 flex flex-wrap items-start justify-between gap-3 border-b pb-4 ${t.cardDivider}`}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F89A15]">Activity trend</p>
                  <h3 className={`font-display text-lg font-black ${t.heading}`}>Weekly learning pulse</h3>
                </div>
                <div className={`flex items-center gap-3 text-[10px] font-mono ${t.statSub}`}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#F89A15]" /> Lessons
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-[#3B82F6]" /> Quizzes
                  </span>
                </div>
              </div>
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={weeklyActivity} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="lessonGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F89A15" stopOpacity={isDarkMode ? 0.45 : 0.35} />
                        <stop offset="100%" stopColor="#F89A15" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="quizGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3B82F6" stopOpacity={isDarkMode ? 0.35 : 0.25} />
                        <stop offset="100%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} vertical={false} />
                    <XAxis dataKey="day" stroke={t.chartAxis} fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke={t.chartAxis} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={t.tooltip} />
                    <Area type="monotone" dataKey="lessons" stroke="#F89A15" fill="url(#lessonGrad)" strokeWidth={2} />
                    <Area type="monotone" dataKey="quizzes" stroke="#3B82F6" fill="url(#quizGrad)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`xl:col-span-5 rounded-2xl border p-6 ${t.card}`}>
              <div className={`mb-4 border-b pb-4 ${t.cardDivider}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F89A15]">Completion ring</p>
                <h3 className={`font-display text-lg font-black ${t.heading}`}>Syllabus coverage</h3>
              </div>
              <div className="relative flex h-[200px] items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={t.tooltip} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`font-display text-3xl font-black ${t.heading}`}>{overallPercent}%</span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${t.muted}`}>Complete</span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Done', value: totalCompleted, color: '#F89A15' },
                  { label: 'Left', value: totalRemaining, color: isDarkMode ? '#64748b' : '#94a3b8' },
                  { label: 'Courses', value: enrolledCourses.length, color: '#22C55E' },
                ].map((item) => (
                  <div key={item.label} className={`rounded-xl border py-2 ${t.innerTile}`}>
                    <p className="font-display text-lg font-black" style={{ color: item.color }}>
                      {item.value}
                    </p>
                    <p className={`text-[8px] font-bold uppercase tracking-wider ${t.muted}`}>{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Course progress + quiz scores */}
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className={`rounded-2xl border p-6 ${t.card}`}>
              <div className={`mb-5 border-b pb-4 ${t.cardDivider}`}>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F89A15]">Per course</p>
                <h3 className={`font-display text-lg font-black ${t.heading}`}>Lessons completed</h3>
              </div>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={progressChartData} margin={{ top: 8, right: 8, left: -22, bottom: 40 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} vertical={false} />
                    <XAxis
                      dataKey="name"
                      stroke={t.chartAxis}
                      fontSize={9}
                      tickLine={false}
                      axisLine={false}
                      angle={-25}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis stroke={t.chartAxis} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                    <Tooltip
                      contentStyle={t.tooltip}
                      formatter={(value, name) => [value, name === 'Completed' ? 'Completed' : 'Remaining']}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ''}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }}
                      formatter={(v) => <span style={{ color: t.legend }}>{v}</span>}
                    />
                    <Bar dataKey="Completed" fill="#F89A15" radius={[6, 6, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="Remaining" fill={t.chartRemaining} radius={[6, 6, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`rounded-2xl border p-6 ${t.card}`}>
              <div className={`mb-5 flex items-start justify-between gap-3 border-b pb-4 ${t.cardDivider}`}>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F89A15]">Assessments</p>
                  <h3 className={`font-display text-lg font-black ${t.heading}`}>Recent quiz scores</h3>
                </div>
                {quizAttempts.length > 0 && (
                  <button
                    type="button"
                    onClick={onViewQuizResults}
                    className={`text-[10px] font-bold uppercase tracking-wider text-[#F89A15] ${t.viewAll}`}
                  >
                    View all
                  </button>
                )}
              </div>
              {quizChartData.length > 0 ? (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={quizChartData} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} stroke={t.chartAxis} fontSize={10} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="name" stroke={t.chartAxis} fontSize={9} width={72} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={t.tooltip} formatter={(v) => [`${v}%`, 'Score']} />
                      <Bar dataKey="score" radius={[0, 6, 6, 0]} maxBarSize={22}>
                        {quizChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[280px] flex-col items-center justify-center gap-3 text-center">
                  <Target size={40} className={t.emptyIcon} />
                  <p className={`text-sm ${t.subtext}`}>No quiz attempts yet</p>
                  <p className={`text-[11px] ${t.muted}`}>Complete lessons and take assessments to see scores here.</p>
                </div>
              )}
            </div>
          </section>

          {/* Continue learning */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F89A15]">Resume</p>
                <h3 className={`font-display text-xl font-black ${t.heading}`}>Continue learning</h3>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-mono ${t.badge} ${t.statSub}`}>
                <Flame size={12} className="text-orange-500" /> {enrolledCourses.length} active
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {enrolledCourses.map((course) => {
                const stats = getCourseStats(course.id);
                const continueTarget = continueTargets.find((c) => c.courseId === course.id);
                return (
                  <article
                    key={course.id}
                    className={`flex flex-col justify-between rounded-2xl border p-5 transition-all ${t.continueCard}`}
                  >
                    <div className="flex gap-4">
                      <div className="relative shrink-0">
                        <ProgressRing percent={stats.percent} trackColor={t.ringTrack} />
                        <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-black ${t.ringLabel}`}>
                          {stats.percent}%
                        </span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#F89A15]">
                          {course.category}
                        </span>
                        <h4 className={`line-clamp-2 font-display text-sm font-bold ${t.heading}`}>{course.title}</h4>
                        <p className={`text-[10px] font-mono ${t.muted}`}>
                          {stats.completed}/{stats.total || '—'} lessons · {course.duration}
                        </p>
                        {continueTarget && !stats.isComplete && (
                          <p className={`line-clamp-1 text-[10px] ${t.subtext}`}>
                            Next: {continueTarget.lessonTitle}
                          </p>
                        )}
                        {stats.isComplete && (
                          <p className="text-[10px] font-semibold text-emerald-500">Course completed</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onContinueCourse(course, continueTarget?.lessonId)}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#F89A15] py-2.5 text-[11px] font-extrabold uppercase tracking-wider text-black transition-all hover:bg-[#e08a10]"
                    >
                      <Play size={14} fill="currentColor" />
                      {continueTarget ? 'Continue lesson' : stats.isComplete ? 'Review course' : 'Resume course'}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      ) : (
        <section className={`rounded-2xl border p-12 text-center ${t.empty}`}>
          <BookOpen size={48} className="mx-auto mb-4 text-[#F89A15]/60" />
          <h3 className={`font-display text-xl font-black ${t.heading}`}>Start your learning journey</h3>
          <p className={`mx-auto mt-2 max-w-md text-sm ${t.subtext}`}>
            You are not enrolled in any courses yet. Browse our catalog and enroll to unlock charts, progress tracking, and certificates.
          </p>
          <button
            type="button"
            onClick={onBrowseCourses}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#F89A15] px-6 py-3 text-xs font-extrabold uppercase tracking-wider text-black hover:bg-[#e08a10]"
          >
            <BookOpen size={14} /> Explore courses
          </button>
        </section>
      )}

      {/* Quick links */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { label: 'Certificates earned', value: certificates.length, action: onViewCertificates, icon: Award, color: '#F89A15' },
          { label: 'Quiz attempts', value: quizAttempts.length, action: onViewQuizResults, icon: Target, color: '#22C55E' },
          { label: 'Unread alerts', value: unreadAlerts, action: onViewAlerts, icon: Bell, color: '#A855F7' },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className={`flex items-center justify-between rounded-2xl border p-5 text-left transition-all ${t.quickLink}`}
          >
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${t.muted}`}>{item.label}</p>
              <p className={`mt-1 font-display text-2xl font-black ${t.statValue}`}>{item.value}</p>
            </div>
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${item.color}18`, color: item.color }}
            >
              <item.icon size={22} />
            </div>
          </button>
        ))}
      </section>

      {/* Recommended courses */}
      {availableCourses.length > 0 && (
        <section className="space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#F89A15]">Discover</p>
            <h3 className={`font-display text-xl font-black ${t.heading}`}>Recommended for you</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {availableCourses.slice(0, 3).map((course) => (
              <article
                key={course.id}
                className={`flex flex-col justify-between overflow-hidden rounded-2xl border transition-all ${t.discoverCard}`}
              >
                {course.coverImage && (
                  <div className="relative h-32 overflow-hidden">
                    <img src={resolveMediaUrl(course.coverImage)} alt="" className="h-full w-full object-cover opacity-90" />
                    <div className={`absolute inset-0 ${t.imageOverlay}`} />
                    <span className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase text-[#F89A15] ${t.levelBadge}`}>
                      {course.level}
                    </span>
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${t.muted}`}>{course.category}</span>
                  <h4 className={`mt-1 line-clamp-2 font-display text-sm font-bold ${t.heading}`}>{course.title}</h4>
                  <div className={`mt-2 flex flex-wrap items-center gap-3 text-[10px] ${t.subtext}`}>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {course.duration}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={11} className="text-[#F89A15]" /> {course.rating}
                    </span>
                  </div>
                  <div className={`mt-4 flex items-center justify-between gap-2 border-t pt-4 ${t.cardDivider}`}>
                    <span className={`font-mono text-sm font-bold ${t.price}`}>
                      {course.price <= 0 ? 'FREE' : `₹${course.price}`}
                    </span>
                    <div className="flex gap-2">
                      {course.price > 0 && (
                        <button
                          type="button"
                          onClick={() => onAddToCart(course.id)}
                          className={`rounded-lg border p-2 transition-colors ${t.cartBtn}`}
                          aria-label="Add to cart"
                        >
                          <ShoppingCart size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onBuyNow(course)}
                        className="rounded-lg bg-[#F89A15]/15 px-3 py-1.5 text-[10px] font-bold uppercase text-[#F89A15] hover:bg-[#F89A15] hover:text-black"
                      >
                        {course.price <= 0 ? 'Enroll' : 'Buy'}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
