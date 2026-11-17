import type { DBStore, PaymentReport } from '../../src/types';
import { createRefund, resolvePaymentMode } from './razorpayService';

export async function refundCapturedPayment(
  db: DBStore,
  paymentRecordId: string
): Promise<{ payment: PaymentReport; mode: 'live' | 'simulator' }> {
  const payment = db.payments.find((p) => p.id === paymentRecordId);
  if (!payment) {
    throw new Error('Payment not found');
  }
  if (payment.status === 'refunded') {
    throw new Error('Payment is already refunded');
  }
  if (payment.status !== 'captured') {
    throw new Error('Only captured payments can be refunded');
  }

  const mode = resolvePaymentMode(db.settings);
  await createRefund(db.settings, payment.razorpayPaymentId, payment.amountPaid);

  payment.status = 'refunded';

  db.enrollments = db.enrollments.filter(
    (e) => !(e.userId === payment.userId && e.courseId === payment.courseId)
  );

  return { payment, mode };
}
