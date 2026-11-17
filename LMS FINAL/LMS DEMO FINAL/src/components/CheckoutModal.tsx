import React, { Fragment, useEffect, useState } from 'react';
import { CheckCircle, Lock, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { Course, CheckoutSession } from '../types';
import { openRazorpayCheckout } from '../lib/razorpayCheckout';
import { apiUrl } from '../api/config';
import { ToastAction, ToastType } from './ui/Toast';

type CheckoutStep = 'summary' | 'payment' | 'success';

interface CheckoutModalProps {
  open: boolean;
  items: Course[];
  onClose: () => void;
  onTriggerCheckout: (courseIds: string[], couponCode?: string) => Promise<CheckoutSession>;
  onCapturePayment: (payload: {
    userId: string;
    courseIds: string[];
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature?: string;
    couponApplied?: string | null;
    lineItems: CheckoutSession['lineItems'];
  }) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onSuccessNavigate: (items: Course[]) => void;
  userId: string;
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void;
}

const STEPS: CheckoutStep[] = ['summary', 'payment', 'success'];

export default function CheckoutModal({
  open,
  items,
  onClose,
  onTriggerCheckout,
  onCapturePayment,
  onRefreshData,
  onSuccessNavigate,
  userId,
  showToast,
}: CheckoutModalProps) {
  const [step, setStep] = useState<CheckoutStep>('summary');
  const [session, setSession] = useState<CheckoutSession | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discountPercent: number } | null>(
    null
  );
  const [couponError, setCouponError] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (open) {
      setStep('summary');
      setSession(null);
      setCouponCode('');
      setAppliedCoupon(null);
      setCouponError('');
      setProcessing(false);
    }
  }, [open, items.map((i) => i.id).join(',')]);

  if (!open || items.length === 0) return null;

  const subtotal = items.reduce((sum, c) => sum + c.price, 0);
  const payable = appliedCoupon
    ? Math.round(subtotal * (1 - appliedCoupon.discountPercent / 100))
    : subtotal;
  const stepIndex = STEPS.indexOf(step);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponError('');
    try {
      const resp = await fetch(apiUrl('/api/coupons/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode,
          cartAmount: subtotal,
          courseIds: items.map((item) => item.id),
        }),
      });
      const data = await resp.json();
      if (resp.ok) {
        setAppliedCoupon(data);
        setCouponError('');
      } else {
        setAppliedCoupon(null);
        setCouponError(data.error || 'Invalid coupon');
      }
    } catch {
      setCouponError('Could not validate coupon');
    }
  };

  const startCheckout = async () => {
    try {
      setProcessing(true);
      const courseIds = items.map((c) => c.id);
      const config = await onTriggerCheckout(courseIds, appliedCoupon?.code);
      setSession(config);
      setStep('payment');

      if (config.mode === 'live') {
        await openRazorpayCheckout(
          config,
          async (result) => {
            try {
              setProcessing(true);
              await onCapturePayment({
                userId,
                courseIds: config.courseIds,
                razorpayOrderId: result.razorpay_order_id,
                razorpayPaymentId: result.razorpay_payment_id,
                razorpaySignature: result.razorpay_signature,
                couponApplied: config.couponApplied,
                lineItems: config.lineItems,
              });
              await onRefreshData();
              setStep('success');
              showToast('Payment successful! Your courses are now unlocked.', 'success');
            } catch (e: any) {
              showToast(e.message || 'Payment capture failed', 'error');
            } finally {
              setProcessing(false);
            }
          },
          () => setProcessing(false)
        );
      }
    } catch (e: any) {
      showToast(e.message || 'Checkout failed', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const simulateCapture = async () => {
    if (!session) return;
    try {
      setProcessing(true);
      const payId = `pay_${Math.random().toString(36).substring(2, 12)}`;
      await onCapturePayment({
        userId,
        courseIds: session.courseIds,
        razorpayOrderId: session.orderId,
        razorpayPaymentId: payId,
        couponApplied: session.couponApplied,
        lineItems: session.lineItems,
      });
      await onRefreshData();
      setStep('success');
      showToast('Payment successful! Your courses are now unlocked.', 'success');
    } catch (e: any) {
      showToast(e.message || 'Payment capture failed', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-[#0A0A0A] border border-[#222222] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0A0A0A] border-b border-[#222222] px-6 py-4 flex items-center justify-between z-10">
          <div>
            <span className="text-[10px] tracking-wider uppercase font-bold text-[#F89A15]">
              Secure checkout
            </span>
            <h3 className="font-display font-bold text-lg text-white">
              {items.length === 1 ? items[0].title : `${items.length} courses`}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <Fragment key={s}>
                <div
                  className={`flex-1 h-1 rounded-full ${
                    i <= stepIndex ? 'bg-[#F89A15]' : 'bg-[#222222]'
                  }`}
                />
              </Fragment>
            ))}
          </div>
          <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-4">
            Step {stepIndex + 1} of {STEPS.length}:{' '}
            {step === 'summary' ? 'Order summary' : step === 'payment' ? 'Payment' : 'Complete'}
          </p>
        </div>

        <div className="px-6 pb-6 space-y-5">
          {step === 'summary' && (
            <>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {items.map((course) => (
                  <div
                    key={course.id}
                    className="flex justify-between gap-3 text-xs bg-[#111111] border border-[#222222] rounded-lg p-3"
                  >
                    <span className="text-white font-medium line-clamp-2">{course.title}</span>
                    <span className="font-mono text-gray-300 shrink-0">₹{course.price}</span>
                  </div>
                ))}
              </div>

              {!appliedCoupon ? (
                <div className="space-y-2">
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
                    Coupon code
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. FORT30"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      className="bg-black border border-[#222222] rounded-lg text-xs p-2.5 text-white outline-none focus:border-[#F89A15] flex-1 uppercase font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="px-3 bg-[#222222] hover:bg-white hover:text-black transition-colors text-xs font-bold rounded-lg"
                    >
                      Apply
                    </button>
                  </div>
                  {couponError && <p className="text-[10px] text-red-400">{couponError}</p>}
                </div>
              ) : (
                <p className="text-xs text-emerald-400">
                  Coupon {appliedCoupon.code} applied (−{appliedCoupon.discountPercent}%)
                </p>
              )}

              <div className="bg-[#111111] border border-[#222222] rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-gray-400">
                  <span>Subtotal</span>
                  <span className="font-mono">₹{subtotal}</span>
                </div>
                <div className="flex justify-between font-bold text-white pt-2 border-t border-[#222222]">
                  <span>Total (incl. 18% GST)</span>
                  <span className="font-mono text-[#F89A15]">₹{payable}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[9px] text-gray-500 justify-center flex-wrap">
                <span className="flex items-center gap-1">
                  <Lock size={10} /> SSL secured
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck size={10} /> Razorpay verified
                </span>
              </div>
              <p className="text-[9px] text-gray-600 text-center leading-relaxed">
                Instant access after payment. 7-day refund policy on unused course access — contact
                support@skillfort.com.
              </p>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 border border-[#222222] text-gray-400 rounded-lg text-xs font-bold hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={startCheckout}
                  disabled={processing}
                  className="flex-1 py-3 bg-[#F89A15] text-black font-extrabold rounded-lg text-xs uppercase tracking-wider hover:bg-white disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing ? <RefreshCw size={14} className="animate-spin" /> : null}
                  Proceed to pay
                </button>
              </div>
            </>
          )}

          {step === 'payment' && session?.mode === 'simulator' && (
            <>
              <div className="text-center space-y-3 py-4">
                <div className="w-14 h-14 rounded-full bg-[#F89A15]/10 border border-[#F89A15]/30 flex items-center justify-center mx-auto text-[#F89A15]">
                  <ShieldCheck size={28} />
                </div>
                <h4 className="font-display font-bold text-white">Razorpay Checkout Simulator</h4>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  Live keys not configured — simulating payment for ₹{session.amountToPay}. Add{' '}
                  <code className="text-[#F89A15]">RAZORPAY_KEY_SECRET</code> in admin settings or
                  .env for real payments.
                </p>
                <div className="bg-black/50 border border-[#222222] rounded-lg p-3 text-[10px] font-mono text-left space-y-1 text-gray-400">
                  <p>Order: {session.orderId}</p>
                  <p>Courses: {session.lineItems.map((l) => l.courseTitle).join(', ')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={simulateCapture}
                disabled={processing}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-widest rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {processing ? <RefreshCw size={14} className="animate-spin" /> : null}
                Simulate successful payment
              </button>
            </>
          )}

          {step === 'payment' && session?.mode === 'live' && (
            <div className="text-center py-8 space-y-3">
              <RefreshCw size={32} className="animate-spin text-[#F89A15] mx-auto" />
              <p className="text-sm text-gray-400">Complete payment in the Razorpay window…</p>
            </div>
          )}

          {step === 'success' && (
            <>
              <div className="text-center space-y-4 py-4">
                <CheckCircle size={48} className="text-emerald-400 mx-auto" />
                <h4 className="font-display font-black text-xl text-white">Payment captured!</h4>
                <p className="text-xs text-gray-400">
                  {items.length === 1
                    ? `"${items[0].title}" is now in your library.`
                    : `${items.length} courses unlocked.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSuccessNavigate(items);
                  onClose();
                }}
                className="w-full py-3.5 bg-[#F89A15] hover:bg-white text-black font-black text-xs uppercase tracking-widest rounded-lg"
              >
                Start learning
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
