import { CheckoutSession } from '../types';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout'));
    document.body.appendChild(script);
  });
  return scriptPromise;
}

export interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export async function openRazorpayCheckout(
  session: CheckoutSession,
  onSuccess: (result: RazorpaySuccess) => void,
  onDismiss?: () => void
): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) throw new Error('Razorpay SDK unavailable');

  const rzp = new window.Razorpay({
    key: session.razorpayKeyId,
    amount: Math.round(session.amountToPay * 100),
    currency: 'INR',
    name: 'SkillFort Academy',
    description:
      session.lineItems.length === 1
        ? session.lineItems[0].courseTitle
        : `${session.lineItems.length} courses`,
    order_id: session.orderId,
    prefill: {
      name: session.customer.name,
      email: session.customer.email,
    },
    theme: { color: '#F89A15' },
    handler: (response: RazorpaySuccess) => onSuccess(response),
    modal: {
      ondismiss: () => onDismiss?.(),
    },
  });

  rzp.open();
}
