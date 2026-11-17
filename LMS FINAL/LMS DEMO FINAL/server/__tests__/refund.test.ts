import { refundCapturedPayment } from '../payments/refund';
import type { DBStore, PaymentReport } from '../../src/types';
import { INITIAL_SETTINGS } from '../../src/data';

function makeStore(payment: PaymentReport): DBStore {
  return {
    settings: { ...INITIAL_SETTINGS },
    users: [
      {
        id: payment.userId,
        email: payment.userEmail,
        name: payment.userName,
        role: 'student',
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
    passwords: {},
    courses: [
      {
        id: payment.courseId,
        title: payment.courseTitle,
        description: 'Test',
        coverImage: '',
        price: payment.amountPaid,
        duration: '1h',
        level: 'Beginner',
        category: 'Test',
        rating: 5,
        reviewsCount: 0,
        isPublished: true,
        createdAt: '2026-01-01T00:00:00Z',
      },
    ],
    modules: [],
    lessons: [],
    progress: [],
    enrollments: [
      {
        id: 'enroll-1',
        userId: payment.userId,
        courseId: payment.courseId,
        enrolledAt: '2026-01-02T00:00:00Z',
        progressPercentage: 10,
        isCompleted: false,
      },
    ],
    coupons: [],
    payments: [payment],
    certificates: [],
    platformKv: {},
  };
}

describe('refundCapturedPayment', () => {
  const basePayment: PaymentReport = {
    id: 'pmt-1',
    userId: 'user-student-1',
    userEmail: 'student@test.com',
    userName: 'Test Student',
    courseId: 'course-1',
    courseTitle: 'Test Course',
    amountPaid: 1000,
    originalAmount: 1000,
    taxAmount: 152,
    invoiceId: 'SF-INV-2026-1001',
    razorpayPaymentId: 'pay_test_123',
    razorpayOrderId: 'order_test_123',
    status: 'captured',
    createdAt: '2026-06-01T00:00:00Z',
  };

  test('refunds captured payment and revokes enrollment in simulator mode', async () => {
    const db = makeStore(basePayment);
    const result = await refundCapturedPayment(db, basePayment.id);

    expect(result.payment.status).toBe('refunded');
    expect(result.mode).toBe('simulator');
    expect(db.enrollments).toHaveLength(0);
  });

  test('rejects already refunded payment', async () => {
    const db = makeStore({ ...basePayment, status: 'refunded' });
    await expect(refundCapturedPayment(db, basePayment.id)).rejects.toThrow(
      /already refunded/
    );
  });

  test('rejects unknown payment id', async () => {
    const db = makeStore(basePayment);
    await expect(refundCapturedPayment(db, 'missing')).rejects.toThrow(/not found/);
  });
});
