import crypto from 'crypto';
import Razorpay from 'razorpay';
import { SystemSettings } from '../../src/types';

export type PaymentMode = 'live' | 'simulator';

export function getRazorpaySecret(settings: SystemSettings): string {
  return settings.razorpayKeySecret || process.env.RAZORPAY_KEY_SECRET || '';
}

export function resolvePaymentMode(settings: SystemSettings): PaymentMode {
  const keyId = settings.razorpayKeyId?.trim();
  const secret = getRazorpaySecret(settings);
  if (keyId && secret) return 'live';
  return 'simulator';
}

export function createRazorpayClient(settings: SystemSettings): Razorpay | null {
  const keyId = settings.razorpayKeyId?.trim();
  const secret = getRazorpaySecret(settings);
  if (!keyId || !secret) return null;
  return new Razorpay({ key_id: keyId, key_secret: secret });
}

export async function createPaymentOrder(
  settings: SystemSettings,
  amountRupees: number,
  receipt: string,
  notes?: Record<string, string>
): Promise<{ mode: PaymentMode; orderId: string }> {
  const mode = resolvePaymentMode(settings);
  if (mode === 'simulator') {
    return {
      mode,
      orderId: `order_${Math.random().toString(36).substring(2, 15)}`,
    };
  }

  const client = createRazorpayClient(settings);
  if (!client) {
    return {
      mode: 'simulator',
      orderId: `order_${Math.random().toString(36).substring(2, 15)}`,
    };
  }

  const order = await client.orders.create({
    amount: Math.round(amountRupees * 100),
    currency: 'INR',
    receipt,
    notes,
  });

  return { mode: 'live', orderId: order.id };
}

export function verifyRazorpaySignature(
  settings: SystemSettings,
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = getRazorpaySecret(settings);
  if (!secret || !signature) return false;
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return expected === signature;
}

export function verifyWebhookSignature(
  settings: SystemSettings,
  rawBody: string,
  signature: string
): boolean {
  const secret = getRazorpaySecret(settings);
  if (!secret || !signature) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  return expected === signature;
}

export async function createRefund(
  settings: SystemSettings,
  razorpayPaymentId: string,
  amountRupees: number
): Promise<{ mode: PaymentMode; refundId: string }> {
  const mode = resolvePaymentMode(settings);

  if (mode === 'simulator') {
    return {
      mode: 'simulator',
      refundId: `rfnd_sim_${Math.random().toString(36).substring(2, 12)}`,
    };
  }

  const client = createRazorpayClient(settings);
  if (!client) {
    return {
      mode: 'simulator',
      refundId: `rfnd_sim_${Math.random().toString(36).substring(2, 12)}`,
    };
  }

  const refund = await client.payments.refund(razorpayPaymentId, {
    amount: Math.round(amountRupees * 100),
  });

  return { mode: 'live', refundId: refund.id };
}
