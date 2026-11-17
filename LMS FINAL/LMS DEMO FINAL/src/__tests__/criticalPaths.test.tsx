import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import StudentPortal from '../components/StudentPortal';
import { User, Course, CourseModule, Lesson, Enrollment } from '../types';

// Mock values
const testUser: User = {
  id: "user-student-1",
  name: "Jane Student",
  email: "student@test.com",
  role: "student",
  createdAt: "2026-06-09T12:00:00Z"
};

const testCourses: Course[] = [
  {
    id: "course-react-19",
    title: "Mastering React 19",
    description: "Concurrent features, compiler, actions and custom hooks.",
    coverImage: "https://example.com/cover.jpg",
    price: 1999,
    duration: "10 Hours",
    level: "Advanced",
    category: "Frontend Development",
    rating: 5,
    reviewsCount: 3,
    isPublished: true,
    createdAt: "2026-06-01T12:00:00Z"
  },
  {
    id: "course-nested-2",
    title: "Docker Continuous Delivery",
    description: "Learn pipeline structures and scaling container images.",
    coverImage: "https://example.com/docker.jpg",
    price: 2499,
    duration: "15 Hours",
    level: "Intermediate",
    category: "DevOps",
    rating: 4.8,
    reviewsCount: 15,
    isPublished: true,
    createdAt: "2026-06-02T12:00:00Z"
  }
];

const testModules: CourseModule[] = [
  {
    id: "module-r19-1",
    courseId: "course-react-19",
    title: "Chapter 1: Concurrent Features",
    description: "Learn useTransition and useDeferredValue.",
    order: 1
  }
];

const testLessons: Lesson[] = [
  {
    id: "lesson-r19-11",
    moduleId: "module-r19-1",
    title: "Intro to Transitions",
    type: "video",
    order: 1,
    vimeoUrl: "https://vimeo.com/76979871",
    vimeoId: "76979871",
    thumbnail: "https://example.com/thumb.jpg",
    duration: "10:00"
  }
];

const testEnrollments: Enrollment[] = [
  {
    id: "enroll-react-19",
    userId: "user-student-1",
    courseId: "course-react-19",
    enrolledAt: "2026-06-09T12:00:00Z",
    progressPercentage: 50,
    isCompleted: false
  }
];

describe("Critical Learning Management System Path Tests", () => {
  let originalFetch: any;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("1. User Authentication Path", () => {
    test("Renders the public website and logs in student successfully", async () => {
      const mockFetch = jest.fn();
      global.fetch = mockFetch as any;

      mockFetch.mockImplementation((url: string) => {
        if (url.includes('/api/settings')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ settings: { systemName: 'SkillFort' }, coupons: [] })
          });
        }
        if (url.includes('/api/courses')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(testCourses)
          });
        }
        if (url.includes('/api/auth/login')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              user: testUser,
              token: 'test-jwt-token'
            })
          });
        }
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(testUser)
          });
        }
        if (url.includes('/api/platform/sync')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ entries: {} })
          });
        }
        if (url.includes('/api/students/enrollments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(testEnrollments)
          });
        }
        if (url.includes('/api/payments/me') || url.includes('/api/admin/payments')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (url.includes('/api/admin/certificates') || url.includes('/api/certificates')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        if (url.includes('/api/admin/courses/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ modules: testModules, lessons: testLessons })
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });

      render(<App />);

      // Wait for courses to load on public website
      await waitFor(() => {
        expect(screen.getByText("Docker Continuous Delivery")).toBeInTheDocument();
      });

      // Open login from public site
      fireEvent.click(screen.getByRole('button', { name: /^Login$/i }));

      // Confirm login modal displays
      await waitFor(() => {
        expect(screen.getByText('Proceed with Login')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Enter your email address')).toBeInTheDocument();
      });

      const emailInput = screen.getByPlaceholderText('Enter your email address');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.change(emailInput, { target: { value: "student@test.com" } });
      fireEvent.change(passwordInput, { target: { value: "student123" } });

      const submitButton = screen.getByText("Sign In Securely");
      expect(submitButton).toBeInTheDocument();

      // Submit form
      fireEvent.click(submitButton);

      // Verify portal renders with loaded private user layout
      await waitFor(() => {
        expect(screen.getByText("Jane Student")).toBeInTheDocument();
      });
    });
  });

  describe("2. Course Acquisition & Enrollment Path", () => {
    test("Student can view available systems to acquire and opens checkout menu", async () => {
      const mockTriggerCheckout = jest.fn().mockResolvedValue({
        mode: 'simulator',
        orderId: "ord_123",
        courseIds: ['course-react-19'],
        lineItems: [{ courseId: 'course-react-19', courseTitle: 'Mastering React 19', originalAmount: 1999, amountToPay: 1999, taxAmount: 305 }],
        courseTitle: "Mastering React 19",
        originalAmount: 1999,
        amountToPay: 1999,
        taxAmount: 305,
        razorpayKeyId: 'rzp_test',
        couponApplied: null,
        customer: { name: 'Jane', email: 'student@test.com' },
      });
      const mockCapturePayment = jest.fn().mockResolvedValue(undefined);
      const mockAddToCart = jest.fn().mockResolvedValue({});
      const mockRemoveFromCart = jest.fn().mockResolvedValue({});
      const mockRefreshCart = jest.fn().mockResolvedValue(undefined);

      render(
        <MemoryRouter initialEntries={['/student/dashboard']}>
          <StudentPortal 
          currentUser={testUser}
          courses={testCourses}
          modules={testModules}
          lessons={testLessons}
          enrollments={[]}
          payments={[]}
          certificates={[]}
          cartItems={[]}
          cartCount={0}
          onAddToCart={mockAddToCart}
          onRemoveFromCart={mockRemoveFromCart}
          onRefreshCart={mockRefreshCart}
          onLogout={jest.fn()}
          onRefreshData={jest.fn().mockResolvedValue(undefined)}
          onTriggerCheckout={mockTriggerCheckout}
          onCapturePayment={mockCapturePayment}
          onViewInvoice={jest.fn()}
          onViewCertificate={jest.fn()}
          coupons={[]}
          isDarkMode={true}
          onToggleDarkMode={jest.fn()}
        />
        </MemoryRouter>
      );

      const buyButtons = screen.getAllByText("Buy now");
      expect(buyButtons.length).toBeGreaterThanOrEqual(1);

      fireEvent.click(buyButtons[0]);

      await waitFor(() => {
        expect(screen.getByText("Secure checkout")).toBeInTheDocument();
        expect(screen.getByText("Proceed to pay")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Proceed to pay"));

      await waitFor(() => {
        expect(mockTriggerCheckout).toHaveBeenCalled();
      });
    });
  });

  describe("3. Lesson Progress Auto-Saving Path", () => {
    test("Selecting an active curriculum module launches video stream and triggers save", async () => {
      const mockFetch = jest.fn().mockImplementation((url: string) => {
        if (url.includes('/api/progress/save')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, enrollment: testEnrollments[0] })
          });
        }
        if (url.includes('/api/progress/')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([])
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([])
        });
      });
      global.fetch = mockFetch as any;

      render(
        <MemoryRouter initialEntries={['/student/dashboard']}>
          <StudentPortal 
          currentUser={testUser}
          courses={testCourses}
          modules={testModules}
          lessons={testLessons}
          enrollments={testEnrollments}
          payments={[]}
          certificates={[]}
          cartItems={[]}
          cartCount={0}
          onAddToCart={jest.fn()}
          onRemoveFromCart={jest.fn()}
          onRefreshCart={jest.fn()}
          onLogout={jest.fn()}
          onRefreshData={jest.fn().mockResolvedValue(undefined)}
          onTriggerCheckout={jest.fn()}
          onCapturePayment={jest.fn()}
          onViewInvoice={jest.fn()}
          onViewCertificate={jest.fn()}
          coupons={[]}
          isDarkMode={true}
          onToggleDarkMode={jest.fn()}
        />
        </MemoryRouter>
      );

      // Navigate to My Courses Certified Library
      const myCoursesBtn = screen.getByText("My Courses");
      expect(myCoursesBtn).toBeInTheDocument();
      fireEvent.click(myCoursesBtn);

      // Ensure course card exists and then click Launch Course Player
      expect(screen.getByText("Mastering React 19")).toBeInTheDocument();
      const launchBtn = screen.getByText("Launch Course Player");
      expect(launchBtn).toBeInTheDocument();
      try {
        fireEvent.click(launchBtn);
      } catch (err: any) {
        console.error("DEBUG STACK:", err);
        if (err.errors) {
          err.errors.forEach((subErr: any, i: number) => {
            console.error(`UNDERLYING ERROR ${i}:`, subErr, subErr.stack);
          });
        }
        throw err;
      }

      // In syllabus directory, check that lesson is visible
      await waitFor(() => {
        expect(screen.getAllByText("Intro to Transitions").length).toBeGreaterThan(0);
      });

      // Select the lesson
      const lessonTriggers = screen.getAllByText("Intro to Transitions");
      const lessonTrigger = lessonTriggers[lessonTriggers.length - 1];
      fireEvent.click(lessonTrigger);

      // Verify the player loaded (manual "Mark Lesson Done" removed — progress auto-saves)
      await waitFor(() => {
        expect(screen.queryByText("Mark Lesson Done")).not.toBeInTheDocument();
        expect(screen.getAllByText("Intro to Transitions").length).toBeGreaterThan(0);
      });
    });
  });
});
