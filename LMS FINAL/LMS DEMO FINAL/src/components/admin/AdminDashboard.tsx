import React, { useMemo } from 'react';
import {
  Award,
  BookOpen,
  IndianRupee,
  Layers,
  Receipt,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Certificate, Course, CourseModule, PaymentReport, User } from '../../types';
import type { AdminTab } from '../../routes/adminRoutes';

const ACCENT = '#F89A15';
const CHART_COLORS = ['#F89A15', '#22C55E', '#3B82F6', '#A855F7', '#F97316'];

interface AdminStudentRow {
  id: string;
  name: string;
  email: string;
  enrollmentsCount?: number;
  totalSpent?: number;
}

interface AdminDashboardProps {
  currentUser: User;
  students: AdminStudentRow[];
  courses: Course[];
  modules: CourseModule[];
  payments: PaymentReport[];
  certificates: Certificate[];
  isDarkMode: boolean;
  onNavigate: (tab: AdminTab) => void;
  onRefresh?: () => void;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatINR(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

function adminDashboardTheme(isDarkMode: boolean) {
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
    accentLabel: 'text-[#F89A15]',
    quickBtn: isDarkMode
      ? 'border-[#222222] bg-black/40 text-gray-300 hover:border-[#F89A15]/40 hover:text-[#F89A15]'
      : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#F89A15]/50 hover:text-[#F89A15]',
    syncBtn: isDarkMode
      ? 'border-[#222222] bg-black/50 text-gray-300 hover:border-[#F89A15]/40 hover:text-[#F89A15]'
      : 'border-slate-200 bg-white text-slate-700 shadow-sm hover:border-[#F89A15]/50 hover:text-[#F89A15]',
    statCard: isDarkMode
      ? 'border-[#222222] bg-gradient-to-br from-[#141414] to-[#0a0a0a] hover:border-[#F89A15]/30 hover:shadow-lg hover:shadow-[#F89A15]/5'
      : 'border-slate-200 bg-white shadow-sm hover:border-[#F89A15]/40 hover:shadow-md',
    statValue: isDarkMode ? 'text-white' : 'text-slate-900',
    statSub: isDarkMode ? 'text-gray-400' : 'text-slate-500',
    card: isDarkMode
      ? 'border-[#222222] bg-gradient-to-br from-[#121212] to-[#0a0a0a]'
      : 'border-slate-200 bg-white shadow-sm',
    cardSolid: isDarkMode ? 'border-[#222222] bg-[#111111]' : 'border-slate-200 bg-white shadow-sm',
    cardTitle: isDarkMode ? 'text-white' : 'text-slate-900',
    empty: isDarkMode
      ? 'border-dashed border-[#333333] text-gray-500'
      : 'border-dashed border-slate-300 bg-slate-50 text-slate-500',
    tableHead: isDarkMode ? 'border-[#222222] text-gray-500' : 'border-slate-200 text-slate-500',
    tableRow: isDarkMode ? 'border-[#222222]/50' : 'border-slate-100',
    tableText: isDarkMode ? 'text-gray-300' : 'text-slate-600',
    tableName: isDarkMode ? 'text-white' : 'text-slate-900',
    tableMuted: isDarkMode ? 'text-gray-500' : 'text-slate-400',
    link: isDarkMode ? 'text-[#F89A15] hover:text-white' : 'text-[#F89A15] hover:text-slate-900',
    insightCard: isDarkMode
      ? 'border-[#222222] bg-[#111111] hover:border-[#F89A15]/35'
      : 'border-slate-200 bg-white shadow-sm hover:border-[#F89A15]/40',
    insightIcon: 'border-[#F89A15]/25 bg-[#F89A15]/10 text-[#F89A15]',
    chartGrid: isDarkMode ? '#222222' : '#e2e8f0',
    chartAxis: isDarkMode ? '#64748b' : '#94a3b8',
    chartTickY: isDarkMode ? '#9ca3af' : '#64748b',
    legend: isDarkMode ? 'text-gray-400' : 'text-slate-500',
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

type Theme = ReturnType<typeof adminDashboardTheme>;

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
  theme,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  accent: string;
  theme: Theme;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all ${theme.statCard}`}>
      <div
        className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-35"
        style={{ backgroundColor: accent }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${theme.muted}`}>{label}</p>
          <p className={`font-display text-xl font-black sm:text-2xl ${theme.statValue}`}>{value}</p>
          {sub && <p className={`text-[10px] font-mono ${theme.statSub}`}>{sub}</p>}
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:h-11 sm:w-11"
          style={{ borderColor: `${accent}40`, backgroundColor: `${accent}15`, color: accent }}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard({
  currentUser,
  students,
  courses,
  modules,
  payments,
  certificates,
  isDarkMode,
  onNavigate,
  onRefresh,
}: AdminDashboardProps) {
  const theme = adminDashboardTheme(isDarkMode);

  const metrics = useMemo(() => {
    const totalRevenue = payments.reduce((sum, p) => sum + (p.status === 'captured' ? p.amountPaid : 0), 0);
    const totalTax = payments.reduce((sum, p) => sum + (p.status === 'captured' ? p.taxAmount : 0), 0);
    const capturedCount = payments.filter((p) => p.status === 'captured').length;
    const totalEnrollments = students.reduce((sum, s) => sum + (s.enrollmentsCount || 0), 0);

    const monthMap = new Map<string, number>();
    for (const p of payments) {
      if (p.status !== 'captured' || !p.createdAt) continue;
      const key = monthKey(p.createdAt);
      monthMap.set(key, (monthMap.get(key) || 0) + p.amountPaid);
    }
    const revenueTrend = Array.from(monthMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .slice(-6);

    const courseMap = new Map<string, number>();
    for (const p of payments) {
      if (p.status !== 'captured') continue;
      const title = p.courseTitle || 'Other';
      courseMap.set(title, (courseMap.get(title) || 0) + p.amountPaid);
    }
    const topCourses = Array.from(courseMap.entries())
      .map(([name, revenue]) => ({ name: name.length > 22 ? `${name.slice(0, 20)}…` : name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const statusCounts = [
      { name: 'Captured', value: payments.filter((p) => p.status === 'captured').length, color: '#22C55E' },
      { name: 'Refunded', value: payments.filter((p) => p.status === 'refunded').length, color: '#F89A15' },
      { name: 'Failed', value: payments.filter((p) => p.status === 'failed').length, color: '#EF4444' },
    ].filter((s) => s.value > 0);

    const recentPayments = [...payments]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);

    const topStudents = [...students]
      .sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0))
      .slice(0, 8);

    return {
      totalRevenue,
      totalTax,
      capturedCount,
      totalEnrollments,
      revenueTrend,
      topCourses,
      statusCounts,
      recentPayments,
      topStudents,
    };
  }, [payments, students]);

  const firstName = currentUser.name.split(' ')[0] || 'Admin';

  return (
    <div className="space-y-6 md:space-y-8">
      <section className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 md:p-8 ${theme.hero}`}>
        <div className={`pointer-events-none absolute inset-0 ${theme.heroGlow}`} />
        <div className={`pointer-events-none absolute inset-0 ${theme.heroGrid}`} />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 sm:space-y-3">
            <p className={`text-[10px] font-bold uppercase tracking-[0.2em] ${theme.accentLabel}`}>
              Admin control center
            </p>
            <h2 className={`font-display text-2xl font-black md:text-3xl ${theme.heading}`}>
              {getGreeting()}, {firstName}
            </h2>
            <p className={`max-w-xl text-sm ${theme.subtext}`}>
              Revenue, enrollments, and student activity at a glance.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${theme.syncBtn}`}
              >
                <RefreshCw size={13} />
                Sync data
              </button>
            )}
            {(
              [
                { tab: 'students-add' as AdminTab, label: 'Add student', icon: UserPlus },
                { tab: 'courses-add' as AdminTab, label: 'Add course', icon: BookOpen },
                { tab: 'orders-all' as AdminTab, label: 'Orders', icon: Receipt },
              ] as const
            ).map(({ tab, label, icon: Icon }) => (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(tab)}
                className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${theme.quickBtn}`}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard
          label="Total revenue"
          value={formatINR(metrics.totalRevenue)}
          sub={`${metrics.capturedCount} captured`}
          icon={IndianRupee}
          accent={ACCENT}
          theme={theme}
        />
        <StatCard
          label="GST collected"
          value={formatINR(Math.round(metrics.totalTax))}
          sub="18% inclusive"
          icon={TrendingUp}
          accent="#22C55E"
          theme={theme}
        />
        <StatCard
          label="Active students"
          value={students.length}
          sub={`${metrics.totalEnrollments} enrollments`}
          icon={Users}
          accent="#3B82F6"
          theme={theme}
        />
        <StatCard
          label="Catalog"
          value={`${courses.length} courses`}
          sub={`${modules.length} modules`}
          icon={Layers}
          accent="#A855F7"
          theme={theme}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
        <div className={`xl:col-span-7 rounded-2xl border p-4 sm:p-5 ${theme.card}`}>
          <h3 className={`mb-4 font-display text-sm font-bold ${theme.cardTitle}`}>Revenue trend</h3>
          {metrics.revenueTrend.length === 0 ? (
            <div className={`flex h-48 sm:h-52 items-center justify-center rounded-xl border text-xs ${theme.empty}`}>
              No captured payments yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={metrics.revenueTrend}>
                <defs>
                  <linearGradient id="adminRevGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={theme.chartGrid} strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fill: theme.chartAxis, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme.chartAxis, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={theme.tooltip}
                  formatter={(value: number) => [formatINR(value), 'Revenue']}
                />
                <Area type="monotone" dataKey="revenue" stroke={ACCENT} strokeWidth={2} fill="url(#adminRevGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={`xl:col-span-5 rounded-2xl border p-4 sm:p-5 ${theme.card}`}>
          <h3 className={`mb-4 font-display text-sm font-bold ${theme.cardTitle}`}>Payment status</h3>
          {metrics.statusCounts.length === 0 ? (
            <div className={`flex h-48 sm:h-52 items-center justify-center rounded-xl border text-xs ${theme.empty}`}>
              No payment records
            </div>
          ) : (
            <>
              <div className="relative flex h-[220px] items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.statusCounts}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={78}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {metrics.statusCounts.map((entry, i) => (
                        <Cell key={entry.name} fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={theme.tooltip}
                      formatter={(value: number, name: string) => [value, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`font-display text-2xl font-black sm:text-3xl ${theme.statValue}`}>
                    {metrics.statusCounts.reduce((sum, s) => sum + s.value, 0)}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${theme.muted}`}>Payments</span>
                </div>
              </div>
              <div
                className={`mt-3 grid gap-2 text-center ${
                  metrics.statusCounts.length === 1
                    ? 'grid-cols-1'
                    : metrics.statusCounts.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                }`}
              >
                {metrics.statusCounts.map((s) => (
                  <div key={s.name} className={`rounded-xl border py-2.5 ${theme.insightCard}`}>
                    <p className="font-display text-lg font-black" style={{ color: s.color }}>
                      {s.value}
                    </p>
                    <p className={`text-[8px] font-bold uppercase tracking-wider ${theme.muted}`}>{s.name}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {metrics.topCourses.length > 0 && (
        <div className={`rounded-2xl border p-4 sm:p-5 ${theme.card}`}>
          <h3 className={`mb-4 font-display text-sm font-bold ${theme.cardTitle}`}>Top courses by revenue</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.topCourses} layout="vertical" margin={{ left: 4, right: 8 }}>
              <CartesianGrid stroke={theme.chartGrid} strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fill: theme.chartAxis, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={88}
                tick={{ fill: theme.chartTickY, fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip contentStyle={theme.tooltip} formatter={(v: number) => [formatINR(v), 'Revenue']} />
              <Bar dataKey="revenue" fill={ACCENT} radius={[0, 6, 6, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
        <div className={`rounded-2xl border p-4 sm:p-5 ${theme.cardSolid}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className={`font-display text-sm font-bold ${theme.cardTitle}`}>Recent payments</h3>
            <button type="button" onClick={() => onNavigate('orders-all')} className={`text-[10px] font-bold uppercase tracking-wider ${theme.link}`}>
              View all
            </button>
          </div>
          <div className="-mx-1 overflow-x-auto">
            <table className={`w-full min-w-[280px] text-left text-xs ${theme.tableText}`}>
              <thead>
                <tr className={`border-b text-[10px] uppercase ${theme.tableHead}`}>
                  <th className="pb-3 pr-2">Student</th>
                  <th className="pb-3 pr-2">Course</th>
                  <th className="pb-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {metrics.recentPayments.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`py-8 text-center ${theme.muted}`}>
                      No payments recorded
                    </td>
                  </tr>
                ) : (
                  metrics.recentPayments.map((p) => (
                    <tr key={p.id} className={`border-b ${theme.tableRow}`}>
                      <td className={`py-3 pr-2 font-medium ${theme.tableName}`}>{p.userName}</td>
                      <td className="py-3 pr-2">{p.courseTitle}</td>
                      <td className="py-3 text-right font-mono font-semibold text-[#F89A15]">
                        {formatINR(p.amountPaid)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 sm:p-5 ${theme.cardSolid}`}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className={`font-display text-sm font-bold ${theme.cardTitle}`}>Top students</h3>
            <button type="button" onClick={() => onNavigate('students-all')} className={`text-[10px] font-bold uppercase tracking-wider ${theme.link}`}>
              View all
            </button>
          </div>
          <div className="-mx-1 overflow-x-auto">
            <table className={`w-full min-w-[280px] text-left text-xs ${theme.tableText}`}>
              <thead>
                <tr className={`border-b text-[10px] uppercase ${theme.tableHead}`}>
                  <th className="pb-3 pr-2">Name</th>
                  <th className="pb-3 text-center">Courses</th>
                  <th className="pb-3 text-right">Spent</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topStudents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className={`py-8 text-center ${theme.muted}`}>
                      No students yet
                    </td>
                  </tr>
                ) : (
                  metrics.topStudents.map((st) => (
                    <tr key={st.id} className={`border-b ${theme.tableRow}`}>
                      <td className="py-3 pr-2">
                        <p className={`font-medium ${theme.tableName}`}>{st.name}</p>
                        <p className={`font-mono text-[10px] ${theme.tableMuted}`}>{st.email}</p>
                      </td>
                      <td className={`py-3 text-center ${theme.tableName}`}>{st.enrollmentsCount || 0}</td>
                      <td className="py-3 text-right font-mono font-semibold text-[#F89A15]">
                        {formatINR(st.totalSpent || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { icon: ShieldCheck, label: 'Administrators', hint: 'Manage access', tab: 'admins-all' as AdminTab },
          { icon: Award, label: 'Certificates', hint: `${certificates.length} issued`, tab: 'courses-cert-template' as AdminTab },
          { icon: Receipt, label: 'Orders', hint: 'Payment ledger', tab: 'orders-all' as AdminTab },
        ].map(({ icon: Icon, label, hint, tab }) => (
          <button
            key={tab}
            type="button"
            onClick={() => onNavigate(tab)}
            className={`flex items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${theme.insightCard}`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${theme.insightIcon}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0">
              <p className={`text-sm font-bold ${theme.cardTitle}`}>{label}</p>
              <p className={`text-[10px] ${theme.muted}`}>{hint}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
