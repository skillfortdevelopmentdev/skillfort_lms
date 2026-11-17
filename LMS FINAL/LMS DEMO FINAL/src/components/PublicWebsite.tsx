import React, { useState, useEffect } from 'react';
import { Course, User, CourseModule, Lesson, Enrollment } from '../types';
import { apiFetch } from '../api/client';
import { resolveMediaUrl } from '../api/config';
import { useSearch } from '../hooks/useSearch';
import { SkillFortLogo } from './SkillFortLogo';
import MobileNavSheet from './ui/MobileNavSheet';
import SkillFortInstituteHome from './SkillFortInstituteHome';
import SkillFortInstituteAbout from './SkillFortInstituteAbout';
import CourseCatalog from './CourseCatalog';
import PublicCourseDetailPage from '../pages/PublicCourseDetailPage';
import { 
  Play, BookOpen, Clock, Star, ArrowRight, Shield, 
  HelpCircle, Sparkles, MessageSquare, Check, Phone, Mail, MapPin, Code, Award,
  Search, X, Sun, Moon, ShoppingCart, Trash2, Menu
} from 'lucide-react';
import { INSTITUTE_CONTACT } from '../data/skillfortInstituteLanding';

interface PublicWebsiteProps {
  courses: Course[];
  modules: CourseModule[];
  lessons: Lesson[];
  onSelectCourse: (courseId: string) => void;
  onNavigateToAuth: (mode: 'login' | 'register') => void;
  currentUser: User | null;
  onLogout: () => void;
  onEnterPortal: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  cartCount?: number;
  cartItems?: Course[];
  enrolledCourseIds?: string[];
  enrollments?: Enrollment[];
  browseCourseId?: string | null;
  initialTab?: 'home' | 'about' | 'courses' | 'contact';
  onNavigateToTab?: (tab: 'home' | 'about' | 'courses' | 'contact') => void;
  onCloseCourseBrowse?: () => void;
  onCoursePurchase?: (course: Course) => void | Promise<void>;
  onCourseContinue?: (course: Course) => void | Promise<void>;
  onCourseSignIn?: (course: Course) => void;
  onCourseRegister?: (course: Course) => void;
  onCourseCheckout?: (course: Course) => void | Promise<void>;
  onAddToCart?: (courseId: string) => Promise<void>;
  onRemoveFromCart?: (courseId: string) => Promise<void>;
  onCheckout?: () => void;
}

export default function PublicWebsite({ 
  courses,
  modules,
  lessons,
  onSelectCourse, 
  onNavigateToAuth, 
  currentUser, 
  onLogout,
  onEnterPortal,
  isDarkMode,
  onToggleDarkMode,
  cartCount = 0,
  cartItems = [],
  enrolledCourseIds = [],
  enrollments = [],
  browseCourseId = null,
  initialTab = 'home',
  onNavigateToTab,
  onCloseCourseBrowse,
  onCoursePurchase,
  onCourseContinue,
  onCourseSignIn,
  onCourseRegister,
  onCourseCheckout,
  onAddToCart,
  onRemoveFromCart,
  onCheckout,
 }: PublicWebsiteProps) {
  const [activeTab, setActiveTab] = useState<'home' | 'about' | 'courses' | 'contact'>(initialTab);
  const [showLegalModal, setShowLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [submittedContact, setSubmittedContact] = useState(false);
  const [contactSubmitting, setContactSubmitting] = useState(false);
  const [contactError, setContactError] = useState('');
  const [cartFeedback, setCartFeedback] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [coursesTabSearch, setCoursesTabSearch] = useState('');

  const isStudent = currentUser?.role === 'student';

  const [homeLandingSection, setHomeLandingSection] = useState<'about' | 'contact' | null>(null);

  useEffect(() => {
    if (initialTab === 'about' || initialTab === 'contact') {
      setActiveTab('home');
      setHomeLandingSection(initialTab);
      const timer = window.setTimeout(() => {
        document.getElementById(initialTab)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
      return () => clearTimeout(timer);
    }
    setActiveTab(initialTab);
    setHomeLandingSection(null);
  }, [initialTab]);

  useEffect(() => {
    if (browseCourseId) {
      setActiveTab('courses');
      setHomeLandingSection(null);
    }
  }, [browseCourseId]);

  const scrollToHomeSection = (section: 'about' | 'contact') => {
    setActiveTab('home');
    setHomeLandingSection(section);
    window.setTimeout(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  };

  const goToTab = (tab: 'home' | 'about' | 'courses' | 'contact') => {
    if (tab === 'about' || tab === 'contact') {
      if (onNavigateToTab) {
        onNavigateToTab(tab);
      }
      scrollToHomeSection(tab);
      return;
    }
    setHomeLandingSection(null);
    if (onNavigateToTab) {
      onNavigateToTab(tab);
    } else {
      setActiveTab(tab);
    }
  };

  const browseCourse = browseCourseId
    ? courses.find((course) => course.id === browseCourseId) ?? null
    : null;
  const browseEnrollment = browseCourse
    ? enrollments.find((entry) => entry.courseId === browseCourse.id) ?? null
    : null;
  const browseIsEnrolled = browseEnrollment != null;

  const showCartFeedback = (message: string) => {
    setCartFeedback(message);
    window.setTimeout(() => setCartFeedback(null), 2500);
  };

  const { searchQuery, setSearchQuery, globalSearchResults } = useSearch(courses);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setContactError('');
    setContactSubmitting(true);

    try {
      const resp = await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify(contactForm),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setContactError(data.error || 'Unable to send your message. Please try again.');
        return;
      }

      setSubmittedContact(true);
      setTimeout(() => {
        setSubmittedContact(false);
        setContactForm({ name: '', email: '', message: '' });
      }, 3000);
    } catch {
      setContactError('Network error. Please check your connection and try again.');
    } finally {
      setContactSubmitting(false);
    }
  };

  // Dynamic UI theme config
  const theme = {
    bg: isDarkMode ? "bg-black text-gray-100" : "bg-slate-50/70 text-slate-800",
    navBg: isDarkMode ? "bg-[#0A0A0A] border-[#222222]" : "bg-white border-slate-200 shadow-sm",
    navLink: (active: boolean) => active 
      ? 'text-[#F89A15]' 
      : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-950 font-semibold'),
    card: isDarkMode ? "bg-[#111111] border-[#222222]" : "bg-white border-slate-200/80 shadow-xs",
    cardHover: isDarkMode ? "hover:border-[#F89A15]/40" : "hover:border-[#F89A15]/50",
    innerCard: isDarkMode ? "bg-black/40 border-[#222222]" : "bg-slate-100/50 border-slate-200/60",
    textWhite: isDarkMode ? "text-white" : "text-slate-950",
    textMuted: isDarkMode ? "text-gray-400" : "text-slate-500",
    textMutedSecondary: isDarkMode ? "text-gray-500" : "text-slate-400",
    border: isDarkMode ? "border-[#222222]" : "border-slate-200/80",
    borderStrong: isDarkMode ? "border-[#222222]" : "border-slate-300",
    input: isDarkMode ? "bg-black border-[#222222] text-white focus:border-[#F89A15]" : "bg-slate-100/80 border-slate-200 text-slate-950 focus:border-[#F89A15] focus:bg-white",
    footerBg: isDarkMode ? "bg-[#0A0A0A] border-[#222222]" : "bg-white border-slate-200",
    modalBg: isDarkMode ? "bg-[#0A0A0A] border-[#222222]" : "bg-white border-slate-200/90 shadow-2xl",
  };

  return (
    <div className={`min-h-screen ${theme.bg} font-sans flex flex-col justify-between transition-colors duration-300`}>
      {cartFeedback && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 bg-[#111111] border border-[#F89A15]/30 text-white text-xs font-semibold rounded-xl shadow-xl max-w-sm text-center">
          {cartFeedback}
        </div>
      )}
      
      {/* Dynamic Nav Header */}
      <nav className={`border-b ${theme.navBg} sticky top-0 z-40 transition-colors duration-300`}>
        <div className="flex h-16 lg:h-20 items-center justify-between gap-2 px-3 sm:px-12">
          <div className="cursor-pointer shrink-0 min-w-0" onClick={() => { goToTab('home'); setSearchQuery(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
            <SkillFortLogo />
          </div>

          {/* Desktop search */}
          <div className="relative hidden lg:block flex-1 max-w-sm z-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                type="text"
                placeholder="Search curriculum..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab !== 'home' && activeTab !== 'courses' && e.target.value.trim().length > 0) {
                    goToTab('courses');
                  }
                }}
                className={`w-full ${theme.input} focus:ring-1 focus:ring-[#F89A15]/20 text-xs pl-9 pr-8 h-9 rounded-lg font-medium outline-none transition-all placeholder:text-gray-500`}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className={`absolute top-11 left-0 right-0 ${theme.modalBg} border rounded-xl shadow-2xl p-2 max-h-[350px] overflow-y-auto space-y-1`}>
                <div className={`p-1 px-2 border-b ${theme.border} pb-1.5 flex justify-between items-center text-[10px]`}>
                  <span className="uppercase tracking-wider text-gray-500 font-bold">Search matches ({globalSearchResults.length})</span>
                  {globalSearchResults.length > 0 && (
                    <button 
                      onClick={() => goToTab('courses')}
                      className="text-[#F89A15] hover:underline font-bold uppercase cursor-pointer"
                    >
                      View All
                    </button>
                  )}
                </div>
                {globalSearchResults.length > 0 ? (
                  globalSearchResults.map(course => (
                    <button
                      key={course.id}
                      onClick={() => {
                        onSelectCourse(course.id);
                        setSearchQuery('');
                      }}
                      className="w-full text-left p-2 hover:bg-[#F89A15]/10 rounded-lg transition-all flex gap-3 items-center group/search-item cursor-pointer"
                    >
                      <img src={resolveMediaUrl(course.coverImage)} className={`w-10 h-7 object-cover rounded border ${theme.border} shrink-0`} alt="" />
                      <div className="min-w-0 flex-1">
                        <p className={`text-xs font-bold ${theme.textWhite} group-hover/search-item:text-[#F89A15] transition-colors truncate`}>{course.title}</p>
                        <p className="text-[9px] text-gray-500 truncate">{course.category} • {course.level}</p>
                      </div>
                      <span className={`text-[11px] font-mono font-bold ${theme.textWhite} shrink-0 text-right`}>₹{course.price}</span>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-center text-xs text-gray-500">No courses match your search.</div>
                )}
              </div>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-8">
            <button onClick={() => goToTab('home')} className={`text-sm font-semibold transition-all ${theme.navLink(activeTab === 'home' && !homeLandingSection)}`}>Home</button>
            <button onClick={() => goToTab('courses')} className={`text-sm font-semibold transition-all ${theme.navLink(activeTab === 'courses')}`}>Our Courses</button>
            <button onClick={() => goToTab('about')} className={`text-sm font-semibold transition-all ${theme.navLink(activeTab === 'home' && homeLandingSection === 'about')}`}>About Us</button>
            <button onClick={() => goToTab('contact')} className={`text-sm font-semibold transition-all ${theme.navLink(activeTab === 'home' && homeLandingSection === 'contact')}`}>Contact Us</button>
          </div>

          <div className="hidden lg:flex items-center gap-4 shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className={`relative p-2 border ${theme.border} hover:border-[#F89A15]/40 rounded-lg transition-all cursor-pointer ${isDarkMode ? 'text-gray-300 hover:text-[#F89A15]' : 'text-slate-600 hover:text-[#F89A15]'}`}
              title="View cart"
            >
              <ShoppingCart size={16} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 bg-[#F89A15] text-black text-[9px] font-black rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
            <button 
              onClick={onToggleDarkMode}
              className={`p-1.5 px-2.5 border ${theme.border} hover:border-[#F89A15]/40 rounded-lg ${isDarkMode ? 'bg-[#111111] text-gray-200' : 'bg-slate-100 text-slate-700'} hover:text-black dark:hover:text-[#F89A15] transition-all cursor-pointer flex items-center gap-1.5 font-mono text-[10px]`}
              title={isDarkMode ? "Switch to Light theme" : "Switch to Dark mode"}
            >
              {isDarkMode ? '☀️ LIGHT' : '🌙 DARK'}
            </button>
            {currentUser ? (
              <div className="flex items-center gap-4 font-sans">
                <span className={`text-xs ${theme.textMuted} ${theme.card} px-3 py-1 rounded-full border text-center hidden sm:inline`}>
                  Active as <b className={theme.textWhite}>{currentUser.name}</b>
                </span>
                <button onClick={onEnterPortal} className="px-4 py-2 bg-[#F89A15] text-black text-xs font-bold rounded-lg hover:bg-neutral-900 hover:text-white transition-all shadow-md cursor-pointer">
                  Go to Workspace
                </button>
                <button onClick={onLogout} className={`text-xs ${theme.textMuted} hover:${theme.textWhite} font-medium cursor-pointer`}>Logout</button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button onClick={() => onNavigateToAuth('login')} className={`text-xs font-bold ${theme.textMuted} hover:${theme.textWhite} transition-colors cursor-pointer`}>Login</button>
                <button onClick={() => onNavigateToAuth('register')} className="px-4 py-2 bg-[#F89A15] text-black text-xs font-bold rounded-lg hover:bg-neutral-900 hover:text-white transition-all shadow-md shadow-[#F89A15]/10 cursor-pointer">
                  Enroll Now
                </button>
              </div>
            )}
          </div>

          {/* Mobile header actions */}
          <div className="flex lg:hidden items-center gap-1 shrink-0 ml-auto">
            <button
              type="button"
              aria-label="Search"
              onClick={() => setMobileSearchOpen(v => !v)}
              className={`p-2 border ${theme.border} rounded-lg ${mobileSearchOpen ? 'text-[#F89A15]' : isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}
            >
              <Search size={18} />
            </button>
            <button
              type="button"
              aria-label="View cart"
              onClick={() => setCartOpen(true)}
              className={`relative p-2 border ${theme.border} rounded-lg ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}
            >
              <ShoppingCart size={18} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 px-0.5 bg-[#F89A15] text-black text-[8px] font-black rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMobileNavOpen(true)}
              className={`p-2 border ${theme.border} rounded-lg ${isDarkMode ? 'text-gray-300' : 'text-slate-600'} hover:text-[#F89A15]`}
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        {/* Mobile expandable search */}
        {mobileSearchOpen && (
          <div className={`lg:hidden px-3 pb-3 border-t ${theme.border} pt-3`}>
            <div className="relative z-50">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input 
                type="text"
                placeholder="Search curriculum..."
                value={searchQuery}
                autoFocus
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (activeTab !== 'home' && activeTab !== 'courses' && e.target.value.trim().length > 0) {
                    goToTab('courses');
                  }
                }}
                className={`w-full ${theme.input} focus:ring-1 focus:ring-[#F89A15]/20 text-sm pl-9 pr-8 h-10 rounded-lg font-medium outline-none placeholder:text-gray-500`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className={`mt-2 ${theme.modalBg} border rounded-xl shadow-xl p-2 max-h-[40vh] overflow-y-auto space-y-1`}>
                {globalSearchResults.length > 0 ? globalSearchResults.map(course => (
                  <button
                    key={course.id}
                    onClick={() => { onSelectCourse(course.id); setSearchQuery(''); setMobileSearchOpen(false); }}
                    className="w-full text-left p-2 hover:bg-[#F89A15]/10 rounded-lg flex gap-3 items-center"
                  >
                    <img src={resolveMediaUrl(course.coverImage)} className={`w-10 h-7 object-cover rounded border ${theme.border} shrink-0`} alt="" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs font-bold ${theme.textWhite} truncate`}>{course.title}</p>
                      <p className="text-[9px] text-gray-500 truncate">{course.category}</p>
                    </div>
                    <span className={`text-[11px] font-mono font-bold ${theme.textWhite} shrink-0`}>₹{course.price}</span>
                  </button>
                )) : (
                  <div className="p-3 text-center text-xs text-gray-500">No courses match your search.</div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      <MobileNavSheet open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Menu" isDarkMode={isDarkMode}>
        <div className="space-y-1">
          {([['home', 'Home'], ['courses', 'Our Courses'], ['about', 'About Us'], ['contact', 'Contact Us']] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => { goToTab(tab); setMobileNavOpen(false); }}
              className={`w-full rounded-xl px-4 py-3 text-left text-sm font-semibold transition-colors ${
                activeTab === tab
                  ? 'bg-[#F89A15]/15 text-[#F89A15] border border-[#F89A15]/40'
                  : isDarkMode
                    ? 'text-gray-200 hover:bg-white/5'
                    : 'text-slate-800 hover:bg-slate-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className={`mt-6 space-y-2 border-t pt-4 ${isDarkMode ? 'border-[#222222]' : 'border-slate-200'}`}>
          <button
            type="button"
            onClick={() => { onToggleDarkMode(); }}
            className={`flex w-full items-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
              isDarkMode
                ? 'border-[#222222] bg-[#111111] text-white hover:border-[#F89A15]/40'
                : 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
            }`}
          >
            {isDarkMode ? '☀️ Light mode' : '🌙 Dark mode'}
          </button>
          {currentUser ? (
            <>
              <button type="button" onClick={() => { onEnterPortal(); setMobileNavOpen(false); }} className="w-full rounded-xl bg-[#F89A15] px-4 py-3 text-sm font-bold text-black hover:bg-[#e08d12]">
                Go to Workspace
              </button>
              <button
                type="button"
                onClick={() => { onLogout(); setMobileNavOpen(false); }}
                className={`w-full rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                  isDarkMode
                    ? 'border-[#222222] text-gray-300 hover:text-white'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                }`}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { onNavigateToAuth('login'); setMobileNavOpen(false); }}
                className={`w-full rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${
                  isDarkMode
                    ? 'border-[#222222] bg-[#111111] text-white hover:border-[#F89A15]/40'
                    : 'border-slate-300 bg-slate-100 text-slate-900 hover:bg-slate-200'
                }`}
              >
                Login
              </button>
              <button type="button" onClick={() => { onNavigateToAuth('register'); setMobileNavOpen(false); }} className="w-full rounded-xl bg-[#F89A15] px-4 py-3 text-sm font-bold text-black hover:bg-[#e08d12]">
                Enroll Now
              </button>
            </>
          )}
        </div>
      </MobileNavSheet>

      {/* Main Container Views Switching */}
      <main className="flex-1">
        {activeTab === 'home' && (
          <SkillFortInstituteHome
            courses={courses}
            theme={theme}
            onSelectCourse={onSelectCourse}
            onGoToCourses={(search) => {
              goToTab('courses');
              setCoursesTabSearch(search || '');
              if (search) setSearchQuery(search);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onGoToContact={() => scrollToHomeSection('contact')}
            onEnrollNow={() => onNavigateToAuth('register')}
          />
        )}

        {/* CURRICULUM/COURSES LISTING VIEW */}
        {activeTab === 'courses' && (
          <div className="max-w-7xl mx-auto px-6 sm:px-12 py-16">
            {browseCourse ? (
              <PublicCourseDetailPage
                embedded
                course={browseCourse}
                modules={modules}
                lessons={lessons}
                isDarkMode={isDarkMode}
                onToggleDarkMode={onToggleDarkMode}
                currentUser={currentUser}
                isEnrolled={browseIsEnrolled}
                enrollment={browseEnrollment}
                cartCount={cartCount}
                onBack={() => onCloseCourseBrowse?.()}
                onPurchase={() => onCoursePurchase?.(browseCourse)}
                onAddToCart={
                  onAddToCart
                    ? async () => {
                        try {
                          await onAddToCart(browseCourse.id);
                          showCartFeedback(`Added "${browseCourse.title}" to your cart.`);
                        } catch (err: unknown) {
                          const message =
                            err instanceof Error ? err.message : 'Could not add to cart';
                          showCartFeedback(message);
                          throw err;
                        }
                      }
                    : undefined
                }
                onCheckout={() => onCourseCheckout?.(browseCourse)}
                onContinueLearning={() => onCourseContinue?.(browseCourse)}
                onSignInToPurchase={() => onCourseSignIn?.(browseCourse)}
                onRegisterToPurchase={() => onCourseRegister?.(browseCourse)}
              />
            ) : (
              <CourseCatalog
                courses={courses}
                isDarkMode={isDarkMode}
                initialSearchQuery={coursesTabSearch}
                enrolledCourseIds={enrolledCourseIds}
                onViewCourse={onSelectCourse}
                onContinueCourse={() => onEnterPortal()}
                onAddToCart={
                  onAddToCart
                    ? async (courseId) => {
                        const course = courses.find((c) => c.id === courseId);
                        if (!course) return;
                        try {
                          await onAddToCart(courseId);
                          showCartFeedback(`Added "${course.title}" to your cart.`);
                        } catch (err: unknown) {
                          const message =
                            err instanceof Error ? err.message : 'Could not add to cart';
                          showCartFeedback(message);
                          throw err;
                        }
                      }
                    : undefined
                }
                onEnrollFree={(course) => onSelectCourse(course.id)}
              />
            )}
          </div>
        )}

        {activeTab === 'about' && <SkillFortInstituteAbout />}

        {/* SUPPORT / CONTACT PAGE */}
        {activeTab === 'contact' && (
          <div className="max-w-4xl mx-auto px-6 py-16 space-y-12 text-left">
            <div className="text-center space-y-3">
              <h1 className={`text-3xl font-display font-black ${theme.textWhite}`}>Contact Us</h1>
              <p className={`${theme.textMuted} text-sm`}>Kickstart your IT career today — we are happy to help you.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              <div className={`md:col-span-5 ${theme.card} p-6 rounded-2xl space-y-6`}>
                <div>
                  <h4 className={`text-sm font-bold ${theme.textWhite} uppercase tracking-wider mb-4`}>Contact Information</h4>
                  <div className={`space-y-4 text-xs ${theme.textMuted}`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${theme.innerCard} text-[#F89A15] flex items-center justify-center shrink-0`}>
                        <MapPin size={14} />
                      </div>
                      <span className={theme.textWhite}>{INSTITUTE_CONTACT.address}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${theme.innerCard} text-[#F89A15] flex items-center justify-center`}>
                        <Phone size={14} />
                      </div>
                      <a href={`tel:${INSTITUTE_CONTACT.phone.replace(/\s/g, '')}`} className={`${theme.textWhite} hover:text-[#F89A15]`}>{INSTITUTE_CONTACT.phone}</a>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${theme.innerCard} text-[#F89A15] flex items-center justify-center`}>
                        <Mail size={14} />
                      </div>
                      <a href={`mailto:${INSTITUTE_CONTACT.email}`} className={`${theme.textWhite} hover:text-[#F89A15]`}>{INSTITUTE_CONTACT.email}</a>
                    </div>
                  </div>
                </div>

                <div className={`border-t ${theme.border} pt-4 text-[10px] ${theme.textMuted}`}>
                  <p className="font-bold uppercase tracking-wider text-[#F89A15] mb-1">Working Hours</p>
                  <p>{INSTITUTE_CONTACT.hours}</p>
                </div>
              </div>

              <div className={`md:col-span-7 ${theme.card} p-8 rounded-2xl`}>
                <h4 className={`text-sm font-bold ${theme.textWhite} uppercase tracking-wider mb-6`}>Send Enquiry</h4>
                
                {submittedContact ? (
                  <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-6 rounded-xl text-center space-y-3">
                    <Check size={28} className="mx-auto" />
                    <h5 className="font-bold text-sm">Message Dispatched Hook</h5>
                    <p className="text-xs">Your inquiry was received. An operations expert will contact you shortly.</p>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={`text-[10px] font-bold ${theme.textMuted} uppercase`}>Your Name</label>
                        <input 
                          type="text" 
                          required
                          value={contactForm.name}
                          onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                          className={`w-full ${theme.input} outline-none text-xs p-3 rounded-lg min-h-[40px]`}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={`text-[10px] font-bold ${theme.textMuted} uppercase`}>Email Address</label>
                        <input 
                          type="email" 
                          required
                          value={contactForm.email}
                          onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                          className={`w-full ${theme.input} outline-none text-xs p-3 rounded-lg min-h-[40px]`}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-bold ${theme.textMuted} uppercase`}>Detailed Message / System Bug Description</label>
                      <textarea 
                        rows={4}
                        required
                        value={contactForm.message}
                        onChange={e => setContactForm({ ...contactForm, message: e.target.value })}
                        className={`w-full ${theme.input} outline-none text-xs p-3 rounded-lg resize-none`}
                      ></textarea>
                    </div>

                    {contactError && (
                      <p className="text-xs text-red-400 font-medium">{contactError}</p>
                    )}

                    <button 
                      type="submit"
                      disabled={contactSubmitting}
                      className="w-full py-3.5 bg-[#F89A15] text-black font-bold text-xs rounded-xl hover:bg-neutral-900 hover:text-white active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {contactSubmitting ? 'Sending…' : 'Submit Enquiry'}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className={`border-t ${theme.border} ${isDarkMode ? 'bg-[#0A0A0A] text-gray-400' : 'bg-slate-150/80 text-slate-700'} pt-16 pb-12 px-6 sm:px-12 text-xs transition-all`}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 mb-12 text-left">
          {/* Brand Info */}
          <div className="md:col-span-4 space-y-4">
            <SkillFortLogo />
            <p className={`${theme.textMuted} text-xs leading-relaxed max-w-xs`}>
              At SkillFort Software Training &amp; Placement, we bridge the gap between education and employment by providing industry-focused software training and assured placement support.
            </p>
          </div>

          {/* Quick Links Column */}
          <div className="md:col-span-2 space-y-3">
            <h4 className={`${theme.textWhite} font-bold uppercase tracking-wider text-[11px]`}>Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={() => { goToTab('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`hover:text-[#F89A15] transition-colors cursor-pointer`}>
                  Home
                </button>
              </li>
              <li>
                <button onClick={() => { goToTab('about'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`hover:text-[#F89A15] transition-colors cursor-pointer`}>
                  About Us
                </button>
              </li>
              <li>
                <button onClick={() => { goToTab('courses'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`hover:text-[#F89A15] transition-colors cursor-pointer`}>
                  Our Courses
                </button>
              </li>
              <li>
                <button onClick={() => { goToTab('contact'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className={`hover:text-[#F89A15] transition-colors cursor-pointer`}>
                  Contact Us
                </button>
              </li>
            </ul>
          </div>

          {/* Courses (Footer) Column */}
          <div className="md:col-span-3 space-y-3">
            <h4 className={`${theme.textWhite} font-bold uppercase tracking-wider text-[11px]`}>Courses</h4>
            <ul className="space-y-2">
              <li>
                <button 
                  onClick={() => { 
                    setActiveTab('courses'); 
                    setSearchQuery('Data'); 
                    window.scrollTo({ top: 0, behavior: 'smooth' }); 
                  }} 
                  className="hover:text-[#F89A15] text-left transition-colors cursor-pointer"
                >
                  Data Science / Data Analyst
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { 
                    setActiveTab('courses'); 
                    setSearchQuery('Java'); 
                    window.scrollTo({ top: 0, behavior: 'smooth' }); 
                  }} 
                  className="hover:text-[#F89A15] text-left transition-colors cursor-pointer"
                >
                  Java Full Stack
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { 
                    setActiveTab('courses'); 
                    setSearchQuery('Python'); 
                    window.scrollTo({ top: 0, behavior: 'smooth' }); 
                  }} 
                  className="hover:text-[#F89A15] text-left transition-colors cursor-pointer"
                >
                  Python Full Stack
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { 
                    setActiveTab('courses'); 
                    setSearchQuery('Oracle'); 
                    window.scrollTo({ top: 0, behavior: 'smooth' }); 
                  }} 
                  className="hover:text-[#F89A15] text-left transition-colors cursor-pointer"
                >
                  Oracle &amp; Database Technologies
                </button>
              </li>
              <li>
                <button 
                  onClick={() => { 
                    setActiveTab('courses'); 
                    setSearchQuery('Testing'); 
                    window.scrollTo({ top: 0, behavior: 'smooth' }); 
                  }} 
                  className="hover:text-[#F89A15] text-left transition-colors cursor-pointer"
                >
                  Software Testing
                </button>
              </li>
            </ul>
          </div>

          {/* Contact Column */}
          <div className="md:col-span-3 space-y-3">
            <h4 className={`${theme.textWhite} font-bold uppercase tracking-wider text-[11px]`}>Contact Information</h4>
            <ul className={`space-y-2 text-xs ${theme.textMuted}`}>
              <li className="flex gap-2"><MapPin size={12} className="text-[#F89A15] shrink-0 mt-0.5" /><span>{INSTITUTE_CONTACT.address}</span></li>
              <li className="flex gap-2"><Phone size={12} className="text-[#F89A15] shrink-0" /><span>{INSTITUTE_CONTACT.phone}</span></li>
              <li className="flex gap-2"><Mail size={12} className="text-[#F89A15] shrink-0" /><span>{INSTITUTE_CONTACT.email}</span></li>
            </ul>
            <h4 className={`${theme.textWhite} font-bold uppercase tracking-wider text-[11px] pt-2`}>Working Hours</h4>
            <p className={`text-xs ${theme.textMuted}`}>{INSTITUTE_CONTACT.hours}</p>
            <ul className="space-y-2 pt-2">
              <li>
                <button onClick={() => setShowLegalModal('terms')} className="hover:text-[#F89A15] transition-colors cursor-pointer">
                  Terms &amp; Conditions
                </button>
              </li>
              <li>
                <button onClick={() => setShowLegalModal('privacy')} className="hover:text-[#F89A15] transition-colors cursor-pointer">
                  Privacy Policy
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Brand Bottom line */}
        <div className={`border-t ${theme.border} pt-8 max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-center`}>
          <p>© 2026 SkillFort Software Training and Placements. All Rights Reserved.</p>
          <p className="font-mono text-[9px] text-[#F89A15] opacity-80">ISO 9001:2015 Certified Educational Workspace • GST IN Listed</p>
        </div>
      </footer>

      {cartOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex justify-end">
          <button
            type="button"
            className="absolute inset-0 cursor-default"
            aria-label="Close cart"
            onClick={() => setCartOpen(false)}
          />
          <div className={`relative w-full max-w-md h-full ${isDarkMode ? 'bg-[#0A0A0A] border-[#222222]' : 'bg-white border-slate-200'} border-l shadow-2xl flex flex-col`}>
            <div className={`flex items-center justify-between p-5 border-b ${theme.border}`}>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#F89A15] font-bold font-mono">Your cart</p>
                <h3 className={`font-display font-black text-lg ${theme.textWhite}`}>
                  {cartCount} {cartCount === 1 ? 'course' : 'courses'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                className={`p-2 rounded-lg ${theme.textMuted} hover:text-[#F89A15]`}
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {cartItems.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <ShoppingCart className="mx-auto text-gray-500" size={32} />
                  <p className={`text-sm font-bold ${theme.textWhite}`}>Your cart is empty</p>
                  <p className={`text-xs ${theme.textMuted}`}>Browse courses and add them here. Sign in only when you checkout.</p>
                </div>
              ) : (
                cartItems.map((course) => (
                  <div key={course.id} className={`${theme.card} border rounded-xl p-4 flex items-start justify-between gap-3`}>
                    <div className="min-w-0 space-y-1">
                      <p className={`text-sm font-bold ${theme.textWhite} line-clamp-2`}>{course.title}</p>
                      <p className={`text-[10px] ${theme.textMuted}`}>{course.category}</p>
                      <p className="font-mono text-sm font-bold text-[#F89A15]">₹{course.price}</p>
                    </div>
                    {onRemoveFromCart && (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await onRemoveFromCart(course.id);
                            showCartFeedback('Removed from cart.');
                          } catch (err: unknown) {
                            const message = err instanceof Error ? err.message : 'Could not remove item';
                            showCartFeedback(message);
                          }
                        }}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg shrink-0"
                        title="Remove"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className={`p-5 border-t ${theme.border} space-y-3`}>
              <div className="flex justify-between items-center">
                <span className={`text-xs ${theme.textMuted}`}>Subtotal</span>
                <span className={`font-mono font-bold ${theme.textWhite}`}>
                  ₹{cartItems.reduce((sum, course) => sum + course.price, 0)}
                </span>
              </div>
              <p className={`text-[10px] ${theme.textMuted}`}>
                {isStudent
                  ? 'Proceed to secure checkout and payment.'
                  : 'Sign in or register when you checkout — no login needed to add items.'}
              </p>
              <button
                type="button"
                disabled={cartItems.length === 0}
                onClick={() => {
                  setCartOpen(false);
                  onCheckout?.();
                }}
                className="w-full py-3 bg-[#F89A15] hover:bg-white text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Proceed to checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEGAL DOCUMENTATION DIALOGUE MODAL */}
      {showLegalModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className={`${theme.modalBg} border ${theme.borderStrong} rounded-2xl w-full max-w-xl p-8 space-y-6 relative max-h-[85vh] overflow-y-auto`}>
            <button 
              onClick={() => setShowLegalModal(null)}
              className={`absolute top-4 right-4 ${theme.textMuted} hover:${theme.textWhite} transition-colors cursor-pointer`}
            >
              <X size={18} />
            </button>
            
            <div className="space-y-1 text-left">
              <span className="text-[10px] text-[#F89A15] tracking-widest uppercase font-bold font-mono">Verified Legal Agreement</span>
              <h3 className={`font-display font-black text-xl ${theme.textWhite}`}>
                {showLegalModal === 'terms' ? 'Terms & Conditions of Service' : 'Corporate Privacy Policy Statement'}
              </h3>
              <p className={`text-[10px] ${theme.textMuted} font-mono`}>Last adjusted: June 07, 2026</p>
            </div>

            <div className={`text-xs ${theme.textMuted} leading-relaxed space-y-4 font-sans text-left ${isDarkMode ? 'bg-black/40 border-[#222222]' : 'bg-slate-50 border-slate-200'} p-4 rounded-xl overflow-y-auto max-h-[45vh]`}>
              {showLegalModal === 'terms' ? (
                <>
                  <p className={`font-bold ${theme.textWhite} text-sm`}>1. Terms of Enrollment</p>
                  <p>By registering on this portal or completing payment orders for courses such as Java Full Stack, Python Full Stack, Oracle, AWS Cloud, or Data Science, you express intent to access the SkillFort Educational Hub. Access credentials are strictly personal and non-transferable under strict token verification.</p>
                  
                  <p className={`font-bold ${theme.textWhite} text-sm`}>2. Student Dashboard Usage</p>
                  <p>Students must utilize the dashboard responsibly. Attempts to intercept Vimeo video playback logs, forge automated credential keys, copy or scrape static content, and bypass JWT constraints will result in immediate profile suspension and termination of placements privileges.</p>

                  <p className={`font-bold ${theme.textWhite} text-sm`}>3. Billing & Refunds</p>
                  <p>All fees are denominated in Indian Rupees (₹) with static CGST/SGST calculations computed recursively. Academic course contents are accessible immediately upon check out verification—as such, payments are non-refundable after standard billing capture.</p>

                  <p className={`font-bold ${theme.textWhite} text-sm`}>4. Placement Guidelines</p>
                  <p>While SkillFort provides comprehensive training and strategic placement assistance partner linkages, placement outcomes are contingent upon Student performance, attendance, and technical interview completion checks.</p>
                </>
              ) : (
                <>
                  <p className={`font-bold ${theme.textWhite} text-sm`}>1. Identity and Security Keys</p>
                  <p>We respect critical user privacy parameters. Your personal coordinates including Registered Name, Email Credentials, Profile Pictures, and billing checkout parameters are secured within isolated sandbox servers. We do not distribute private information to secondary platforms.</p>
                  
                  <p className={`font-bold ${theme.textWhite} text-sm`}>2. Video Player Cookies</p>
                  <p>SkillFort uses persistent local browser files (such as localStorage) solely to record playback percentages, resume points, curriculum marks, and to coordinate dark theme toggles securely without telemetry logs.</p>

                  <p className={`font-bold ${theme.textWhite} text-sm`}>3. Verification Codes</p>
                  <p>Your Issued Certificates carry custom QR Code records mapped publicly for MNC audit validation. Placing this credential on resumes allows corporate hiring officers to check your skill matrix details under our standard verification indices.</p>

                  <p className={`font-bold ${theme.textWhite} text-sm`}>4. Data Erasure Requests</p>
                  <p>You may initiate profile deletion at any moment. Student records, course completions, and past invoices will be permanently deactivated.</p>
                </>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button 
                onClick={() => setShowLegalModal(null)}
                className="px-5 py-2.5 bg-[#F89A15] hover:bg-neutral-900 hover:text-white text-black font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
