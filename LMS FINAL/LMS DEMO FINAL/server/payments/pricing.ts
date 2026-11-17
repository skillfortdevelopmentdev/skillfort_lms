import { Coupon, Course } from '../../src/types';

export interface PricedLineItem {
  courseId: string;
  courseTitle: string;
  originalAmount: number;
  amountToPay: number;
  taxAmount: number;
}

export interface CartPricing {
  lineItems: PricedLineItem[];
  originalAmount: number;
  amountToPay: number;
  taxAmount: number;
  discountAmount: number;
  couponApplied: string | null;
}

export function computeInclusiveGst(amount: number, rate = 1.18): number {
  return Math.round((amount - amount / rate) * 100) / 100;
}

export function isCouponApplicableToCart(coupon: Coupon, courses: Course[]): boolean {
  if (!coupon.courseId) return true;
  return courses.some((course) => course.id === coupon.courseId);
}

export function priceCartLines(
  courses: Course[],
  coupons: Coupon[],
  couponCode?: string | null
): CartPricing {
  const originalAmount = courses.reduce((sum, c) => sum + c.price, 0);
  let discountAmount = 0;
  let couponApplied: string | null = null;

  if (couponCode) {
    const coupon = coupons.find(
      (c) => c.code.toUpperCase() === couponCode.toUpperCase() && c.isActive
    );
    if (
      coupon &&
      originalAmount >= coupon.minAmount &&
      isCouponApplicableToCart(coupon, courses)
    ) {
      discountAmount = Math.round((originalAmount * coupon.discountPercent) / 100);
      couponApplied = coupon.code;
    }
  }

  const amountToPay = Math.max(0, originalAmount - discountAmount);
  const taxAmount = computeInclusiveGst(amountToPay);

  const lineItems: PricedLineItem[] = courses.map((course) => {
    const share = originalAmount > 0 ? course.price / originalAmount : 0;
    const lineOriginal = course.price;
    const linePaid = Math.round(amountToPay * share);
    return {
      courseId: course.id,
      courseTitle: course.title,
      originalAmount: lineOriginal,
      amountToPay: linePaid,
      taxAmount: computeInclusiveGst(linePaid),
    };
  });

  // Fix rounding drift on last line
  const paidSum = lineItems.reduce((s, l) => s + l.amountToPay, 0);
  if (lineItems.length > 0 && paidSum !== amountToPay) {
    lineItems[lineItems.length - 1].amountToPay += amountToPay - paidSum;
    lineItems[lineItems.length - 1].taxAmount = computeInclusiveGst(
      lineItems[lineItems.length - 1].amountToPay
    );
  }

  return {
    lineItems,
    originalAmount,
    amountToPay,
    taxAmount,
    discountAmount,
    couponApplied,
  };
}
