import { DBStore, PaymentReport, User, CheckoutLineItem } from '../../src/types';
import { notifyPaymentSuccess } from '../mail/send';
import { clearPurchasedFromCart } from '../cart';
import { createEnrollmentRecord } from '../enrollmentAccess';

export async function captureLineItems(
  db: DBStore,
  userObj: User,
  lineItems: CheckoutLineItem[],
  razorpayOrderId: string,
  razorpayPaymentId: string,
  couponApplied?: string | null
): Promise<PaymentReport[]> {
  const payments: PaymentReport[] = [];

  for (const line of lineItems) {
    const courseObj = db.courses.find((c) => c.id === line.courseId);
    if (!courseObj) continue;

    const alreadyEnrolled = db.enrollments.some(
      (e) => e.userId === userObj.id && e.courseId === line.courseId
    );
    if (alreadyEnrolled) continue;

    const invNo = `SF-INV-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const paymentReport: PaymentReport = {
      id: `pmt-${Math.random().toString(36).substring(2, 11)}`,
      userId: userObj.id,
      userEmail: userObj.email,
      userName: userObj.name,
      courseId: line.courseId,
      courseTitle: line.courseTitle,
      originalAmount: line.originalAmount,
      amountPaid: line.amountToPay,
      taxAmount: line.taxAmount,
      couponApplied: couponApplied || undefined,
      invoiceId: invNo,
      razorpayPaymentId,
      razorpayOrderId,
      status: 'captured',
      createdAt: new Date().toISOString(),
    };

    db.payments.push(paymentReport);
    payments.push(paymentReport);

    db.enrollments.push(createEnrollmentRecord(db, userObj.id, line.courseId));

    void notifyPaymentSuccess(db.settings, userObj, courseObj, paymentReport).catch((err) =>
      console.error('[MAIL] payment success notify failed:', err)
    );
  }

  clearPurchasedFromCart(
    db,
    userObj.id,
    lineItems.map((l) => l.courseId)
  );

  return payments;
}
