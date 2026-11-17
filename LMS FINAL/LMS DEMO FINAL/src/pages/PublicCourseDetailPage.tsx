import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, ShoppingCart, Clock, Star } from 'lucide-react';
import { Course, CourseModule, Lesson, User, Enrollment } from '../types';
import { getPreviewLesson } from '../utils/courseProgress';
import {
  enrollmentAccessLabel,
  formatValidityLabel,
  isEnrollmentExpired,
} from '../utils/courseValidity';
import { fetchCourseReviews, type PublicCourseReview } from '../api/courseReviews';
import { resolveMediaUrl } from '../api/config';

interface PublicCourseDetailPageProps {
  course: Course;
  modules: CourseModule[];
  lessons: Lesson[];
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  currentUser?: User | null;
  isEnrolled?: boolean;
  enrollment?: Enrollment | null;
  onAddToCart?: () => void | Promise<void>;
  cartCount?: number;
  onPurchase?: () => void;
  onCheckout?: () => void;
  onContinueLearning?: () => void;
  onSignInToPurchase?: () => void;
  onRegisterToPurchase?: () => void;
  embedded?: boolean;
  onBack?: () => void;
}

export default function PublicCourseDetailPage({
  course,
  modules,
  lessons,
  isDarkMode,
  onToggleDarkMode,
  currentUser,
  isEnrolled = false,
  enrollment = null,
  onPurchase,
  onCheckout,
  onContinueLearning,
  onSignInToPurchase,
  onRegisterToPurchase,
  onAddToCart,
  cartCount = 0,
  embedded = false,
  onBack,
}: PublicCourseDetailPageProps) {
  const navigate = useNavigate();
  const courseModules = modules
    .filter((m) => m.courseId === course.id)
    .sort((a, b) => a.order - b.order);
  const lessonCount = lessons.filter((l) =>
    courseModules.some((m) => m.id === l.moduleId)
  ).length;
  const previewLesson = !isEnrolled
    ? getPreviewLesson(course.id, modules, lessons)
    : null;
  const previewModule = previewLesson
    ? courseModules.find((m) => m.id === previewLesson.moduleId)
    : null;
  const isFreeCourse = course.price <= 0;
  const hasActiveAccess = isEnrolled && enrollment && !isEnrollmentExpired(enrollment);
  const accessSummary = enrollment
    ? enrollmentAccessLabel(enrollment)
    : formatValidityLabel(course.validityDays);
  const [reviews, setReviews] = useState<PublicCourseReview[]>([]);

  useEffect(() => {
    void fetchCourseReviews(course.id).then(setReviews);
  }, [course.id]);

  return (
    <div
      className={
        embedded
          ? 'space-y-8'
          : 'min-h-screen bg-black text-white py-12 px-6 sm:px-12 max-w-5xl mx-auto space-y-12'
      }
    >
      <div
        className={
          embedded
            ? 'flex items-center'
            : 'flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-[#0A0A0A] p-4 rounded-xl border border-[#222222]'
        }
      >
        {embedded && onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#F89A15] hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft size={14} /> Back to courses
          </button>
        ) : (
          <>
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-xs font-bold text-[#F89A15] hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} /> Back to course listing
            </Link>
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="p-1 px-3 border border-[#222222] hover:border-[#F89A15]/40 rounded-lg bg-black text-xs font-mono flex items-center gap-2 text-white hover:text-[#F89A15] transition-all cursor-pointer"
            >
              {isDarkMode ? '☀️ Light theme' : '🌙 Dark mode'}
            </button>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
        <div className="md:col-span-8 space-y-6">
          <span className="text-[10px] uppercase font-bold text-[#F89A15] tracking-widest bg-[#F89A15]/10 border border-[#F89A15]/20 px-3 py-1 rounded-full">
            TECHNICAL SYLLABUS REQUISITE
          </span>
          <h1 className="text-3xl md:text-4xl font-display font-black leading-tight">
            {course.title}
          </h1>
          <p className="text-gray-400 text-sm leading-relaxed">{course.description}</p>
          <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
            {courseModules.length} modules · {lessonCount} lessons · {course.duration}
          </p>
          {course.reviewsCount > 0 && (
            <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
              <Star size={12} className="text-[#F89A15] fill-[#F89A15]" />
              {course.rating} · {course.reviewsCount} student review{course.reviewsCount === 1 ? '' : 's'}
            </p>
          )}
          <p className="text-[10px] text-gray-400 font-mono flex items-center gap-1.5">
            <Clock size={12} className="text-[#F89A15]" />
            {accessSummary}
          </p>

          {previewLesson && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display font-bold text-lg text-white">
                  Free preview
                </h3>
                <span className="text-[9px] uppercase font-bold text-[#F89A15] tracking-wider">
                  No enrollment required
                </span>
              </div>
              <div className="bg-[#111111] border border-[#222222] rounded-2xl overflow-hidden">
                <div className="aspect-video bg-black">
                  <iframe
                    title={`Preview: ${previewLesson.title}`}
                    src={`https://player.vimeo.com/video/${previewLesson.vimeoId}?autoplay=0&loop=0&autopause=0`}
                    className="w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="p-4 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                    {previewModule?.title ?? 'Introduction'}
                  </p>
                  <p className="text-sm font-semibold text-white">{previewLesson.title}</p>
                  <p className="text-[10px] text-gray-500 font-mono">
                    Watch this sample lesson before you enroll.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 pt-4">
            <h3 className="font-display font-bold text-lg text-white">
              Course Curriculum breakups:
            </h3>
            <div className="space-y-4">
              {courseModules.map((mod, id) => {
                const modLessons = lessons.filter((l) => l.moduleId === mod.id);
                return (
                  <div
                    key={mod.id}
                    className="bg-[#111111] p-5 rounded-xl border border-[#222222] space-y-3"
                  >
                    <h4 className="font-display font-bold text-sm text-white">
                      Module {id + 1}: {mod.title}
                    </h4>
                    <p className="text-xs text-gray-400">{mod.description}</p>

                    <div className="space-y-2 mt-2">
                      {modLessons.map((l) => (
                        <div
                          key={l.id}
                          className="p-2.5 bg-black/60 rounded-lg text-xs text-gray-300 font-mono flex justify-between items-center"
                        >
                          <span>• {l.title}</span>
                          <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                            {l.type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {reviews.length > 0 && (
            <div className="space-y-4 pt-8 border-t border-[#222222]">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display font-bold text-lg text-white">Student reviews</h3>
                <span className="text-[10px] text-gray-500 font-mono">
                  {reviews.length} approved review{reviews.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div
                    key={review.id}
                    className="bg-[#111111] border border-[#222222] rounded-xl p-5 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{review.studentName}</span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                      <span className="text-[#F89A15] text-xs font-mono">
                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                      </span>
                      {review.isPinned && (
                        <span className="text-[9px] uppercase font-bold text-[#F89A15] bg-[#F89A15]/10 px-2 py-0.5 rounded">
                          Featured
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="md:col-span-4 bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-6 sticky top-6">
          <div className="aspect-video rounded-xl overflow-hidden border border-[#222222]">
            <img
              src={resolveMediaUrl(course.coverImage)}
              className="w-full h-full object-cover"
              alt=""
            />
          </div>
          <div className="space-y-2">
            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-mono">
              {isFreeCourse ? 'COURSE ACCESS' : 'FINANCIAL INVESTMENT SUMMARY'}
            </span>
            <p className="text-3xl font-mono font-bold text-white">
              {isFreeCourse ? 'FREE' : `₹${course.price}`}
            </p>
            <p className="text-[9px] text-[#F89A15] font-semibold uppercase">
              {isFreeCourse
                ? 'NO PAYMENT REQUIRED · INSTANT ACCESS AFTER ENROLLMENT'
                : 'INCLUSIVE 18% GST · INSTANT ACCESS AFTER PAYMENT'}
            </p>
            {!isEnrolled && (
              <p className="text-[10px] text-gray-500">{formatValidityLabel(course.validityDays)}</p>
            )}
          </div>

          {currentUser?.role === 'student' && hasActiveAccess ? (
            <>
              <button
                type="button"
                onClick={onContinueLearning}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Play size={14} fill="currentColor" /> Continue learning
              </button>
              <p className="text-[10px] text-emerald-400/80 text-center">
                You are enrolled in this course.
              </p>
              <p className="text-[10px] text-gray-500 text-center">{accessSummary}</p>
            </>
          ) : currentUser?.role === 'student' && isEnrolled ? (
            <>
              <div className="w-full py-4 bg-red-500/10 border border-red-500/30 text-red-300 font-bold text-xs uppercase tracking-wider rounded-xl text-center">
                Access expired
              </div>
              <p className="text-[10px] text-red-300/80 text-center">{accessSummary}</p>
              <p className="text-[10px] text-gray-500 text-center">
                Contact support if you need your access renewed.
              </p>
            </>
          ) : currentUser?.role === 'student' ? (
            <>
              <button
                type="button"
                onClick={onPurchase}
                className="w-full py-4 bg-[#F89A15] hover:bg-white text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <ShoppingCart size={14} />
                {isFreeCourse ? 'Enroll for free' : `Buy now — ₹${course.price}`}
              </button>
              {!isFreeCourse && onAddToCart && (
                <button
                  type="button"
                  onClick={() => void onAddToCart()}
                  className="w-full py-3 border border-[#222222] hover:border-[#F89A15]/40 text-gray-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={14} /> Add to cart
                  {cartCount > 0 && (
                    <span className="bg-[#F89A15] text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {cartCount}
                    </span>
                  )}
                </button>
              )}
              <p className="text-[10px] text-gray-500 text-center">
                {isFreeCourse
                  ? 'Click Enroll → Start learning immediately.'
                  : 'Click Purchase → Pay → Start learning immediately.'}
              </p>
            </>
          ) : (
            <>
              {!isFreeCourse && onAddToCart && (
                <button
                  type="button"
                  onClick={() => void onAddToCart()}
                  className="w-full py-3 border border-[#222222] hover:border-[#F89A15]/40 text-gray-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ShoppingCart size={14} /> Add to cart
                  {cartCount > 0 && (
                    <span className="bg-[#F89A15] text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">
                      {cartCount}
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                onClick={isFreeCourse ? onSignInToPurchase : onCheckout}
                className="w-full py-4 bg-[#F89A15] hover:bg-white text-black font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <ShoppingCart size={14} />
                {isFreeCourse ? 'Sign in to enroll free' : 'Proceed to checkout'}
              </button>
              <button
                type="button"
                onClick={onRegisterToPurchase}
                className="w-full py-3 border border-[#222222] hover:border-[#F89A15]/40 text-gray-300 hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Create free account
              </button>
              <p className="text-[10px] text-gray-500 text-center">
                {isFreeCourse
                  ? 'Free courses require a student account to enroll.'
                  : 'Add courses to your cart freely. Sign in only when you pay.'}
              </p>
            </>
          )}

          {currentUser?.role === 'student' && !isEnrolled && (
            <button
              type="button"
              onClick={() => navigate('/student/dashboard')}
              className="w-full text-[10px] text-gray-500 hover:text-[#F89A15] transition-colors"
            >
              Go to student dashboard →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
