import React, { useState } from 'react';
import { Star, X } from 'lucide-react';
import type { Course } from '../types';

interface CourseReviewModalProps {
  course: Course;
  initialRating?: number;
  initialComment?: string;
  isResubmit?: boolean;
  onClose: () => void;
  onSubmit: (payload: { rating: number; comment: string }) => Promise<void>;
}

export default function CourseReviewModal({
  course,
  initialRating = 5,
  initialComment = '',
  isResubmit = false,
  onClose,
  onSubmit,
}: CourseReviewModalProps) {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState(initialComment);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (comment.trim().length < 10) {
      setError('Please write at least 10 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({ rating, comment: comment.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#111111] border border-[#222222] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222222]">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-[#F89A15] font-bold">
              {isResubmit ? 'Update review' : 'Course review'}
            </p>
            <h3 className="font-display font-bold text-white text-sm">{course.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#222222] transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="p-6 space-y-5">
          <div className="space-y-2">
            <p className="text-xs text-gray-400">How would you rate this course?</p>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onMouseEnter={() => setHoverRating(value)}
                  onMouseLeave={() => setHoverRating(0)}
                  onClick={() => setRating(value)}
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`Rate ${value} stars`}
                >
                  <Star
                    size={24}
                    className={
                      value <= (hoverRating || rating)
                        ? 'text-[#F89A15] fill-[#F89A15]'
                        : 'text-gray-600'
                    }
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-mono text-[#F89A15]">{rating}/5</span>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="course-review-comment" className="text-xs text-gray-400">
              Share your experience
            </label>
            <textarea
              id="course-review-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="What did you learn? How was the instruction and placement support?"
              className="w-full bg-black border border-[#222222] rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-[#F89A15]/50 resize-none"
            />
            <p className="text-[10px] text-gray-500 text-right">{comment.length}/2000</p>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <p className="text-[10px] text-gray-500 leading-relaxed">
            Reviews are moderated before they appear on the public course page.
          </p>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-[#F89A15] hover:bg-white text-black text-xs font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : isResubmit ? 'Resubmit review' : 'Submit review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
