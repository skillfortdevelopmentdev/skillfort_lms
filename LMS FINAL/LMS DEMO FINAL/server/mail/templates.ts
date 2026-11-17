import type { Certificate, Course, PaymentReport, User } from '../../src/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(title: string, body: string): string {
  return `
    <div style="font-family: 'Poppins', sans-serif; max-width: 640px; margin: 0 auto; background: #0a0a0a; color: #f5f5f5; border: 1px solid #222; border-radius: 12px; overflow: hidden;">
      <div style="background: #F89A15; color: #000; padding: 16px 24px; font-weight: bold; font-size: 18px;">SkillFort LMS</div>
      <div style="padding: 24px;">
        <h2 style="margin: 0 0 16px; color: #F89A15; font-size: 20px;">${title}</h2>
        ${body}
        <p style="margin-top: 24px; font-size: 11px; color: #888;">This is an automated message from SkillFort LMS. Please do not reply directly unless instructed.</p>
      </div>
    </div>
  `;
}

export function welcomeStudentEmail(
  user: User,
  systemName: string,
  loginUrl: string
): { subject: string; html: string } {
  return {
    subject: `Welcome to ${systemName}!`,
    html: layout(
      'Welcome aboard',
      `
        <p>Hi <strong>${escapeHtml(user.name)}</strong>,</p>
        <p>Your student account has been created successfully with email <strong>${escapeHtml(user.email)}</strong>.</p>
        <p>You can browse courses, track lesson progress, and earn verified certificates.</p>
        <p style="margin-top: 20px;">
          <a href="${loginUrl}" style="display: inline-block; background: #F89A15; color: #000; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none;">
            Sign in to ${escapeHtml(systemName)}
          </a>
        </p>
        <p style="margin-top: 12px; font-size: 12px; color: #aaa;">
          Or copy this link: <a href="${loginUrl}" style="color: #F89A15;">${loginUrl}</a>
        </p>
        <p style="margin-top: 20px;">Happy learning!</p>
      `
    ),
  };
}

export function adminNewRegistrationEmail(user: User): { subject: string; html: string } {
  const profile = user.registrationProfile;
  const profileRows = profile
    ? `
        <li><strong>Branch:</strong> ${escapeHtml(profile.branch)}</li>
        <li><strong>Date of birth:</strong> ${escapeHtml(profile.dateOfBirth)}</li>
        <li><strong>Qualification:</strong> ${escapeHtml(profile.highestQualification)}</li>
        <li><strong>Stream:</strong> ${escapeHtml(profile.stream)}</li>
        <li><strong>College:</strong> ${escapeHtml(profile.collegeName)}</li>
        <li><strong>Year of passout:</strong> ${escapeHtml(profile.yearOfPassout)}</li>
        <li><strong>Required course:</strong> ${escapeHtml(profile.requiredCourse)}</li>
        <li><strong>Placement required:</strong> ${escapeHtml(profile.placementRequired)}</li>
        <li><strong>Work experience:</strong> ${escapeHtml(profile.hasWorkExperience)}</li>
        <li><strong>Address:</strong> ${escapeHtml(profile.address)}</li>
        <li><strong>Source:</strong> ${escapeHtml(profile.source)}</li>
        ${profile.knownTechnologies ? `<li><strong>Known technologies:</strong> ${escapeHtml(profile.knownTechnologies)}</li>` : ''}
        ${profile.preferredCallbackTime ? `<li><strong>Callback time:</strong> ${escapeHtml(profile.preferredCallbackTime)}</li>` : ''}
        ${profile.panNo ? `<li><strong>PAN:</strong> ${escapeHtml(profile.panNo)}</li>` : ''}
        ${profile.aadharNo ? `<li><strong>Aadhar:</strong> ${escapeHtml(profile.aadharNo)}</li>` : ''}
      `
    : `<li><strong>Interest:</strong> ${escapeHtml(user.areaOfInterest || 'Not specified')}</li>`;

  return {
    subject: `[Admin] New student registration: ${user.name}`,
    html: layout(
      'New student registered',
      `
        <p>A new student account was created:</p>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(user.name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(user.email)}</li>
          <li><strong>Phone:</strong> ${escapeHtml(user.phone || 'Not specified')}</li>
          ${profileRows}
          <li><strong>Registered:</strong> ${new Date(user.createdAt).toLocaleString()}</li>
        </ul>
      `
    ),
  };
}

export function paymentSuccessStudentEmail(
  user: User,
  course: Course,
  payment: PaymentReport
): { subject: string; html: string } {
  return {
    subject: `Payment successful — enrolled in ${course.title}`,
    html: layout(
      'Payment received & enrollment confirmed',
      `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>Your payment for <strong>${course.title}</strong> was successful. You are now enrolled.</p>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-top: 16px;">
          <tr><td style="padding: 6px 0; color: #aaa;">Invoice</td><td style="text-align: right;">${payment.invoiceId}</td></tr>
          <tr><td style="padding: 6px 0; color: #aaa;">Amount paid</td><td style="text-align: right; color: #34d399; font-weight: bold;">₹${payment.amountPaid}</td></tr>
          <tr><td style="padding: 6px 0; color: #aaa;">GST included</td><td style="text-align: right;">₹${payment.taxAmount}</td></tr>
        </table>
        <p style="margin-top: 20px;">Open your student dashboard and launch the course player to begin learning.</p>
      `
    ),
  };
}

export function paymentSuccessAdminEmail(
  user: User,
  course: Course,
  payment: PaymentReport
): { subject: string; html: string } {
  return {
    subject: `[Admin] Payment success — ${user.name} enrolled in ${course.title}`,
    html: layout(
      'Payment captured & student enrolled',
      `
        <ul>
          <li><strong>Student:</strong> ${user.name} (${user.email})</li>
          <li><strong>Course:</strong> ${course.title}</li>
          <li><strong>Amount:</strong> ₹${payment.amountPaid}</li>
          <li><strong>Invoice:</strong> ${payment.invoiceId}</li>
          <li><strong>Payment ID:</strong> ${payment.razorpayPaymentId}</li>
        </ul>
      `
    ),
  };
}

export function paymentFailedStudentEmail(
  user: User,
  course: Course,
  reason?: string
): { subject: string; html: string } {
  return {
    subject: `Payment failed for ${course.title}`,
    html: layout(
      'Payment could not be completed',
      `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>We could not complete your payment for <strong>${course.title}</strong>.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>Please try again from your student dashboard or contact support if the issue continues.</p>
      `
    ),
  };
}

export function paymentFailedAdminEmail(
  user: User,
  course: Course,
  reason?: string
): { subject: string; html: string } {
  return {
    subject: `[Admin] Payment failed — ${user.name} / ${course.title}`,
    html: layout(
      'Student payment failed',
      `
        <ul>
          <li><strong>Student:</strong> ${user.name} (${user.email})</li>
          <li><strong>Course:</strong> ${course.title}</li>
          ${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ''}
        </ul>
        <p>The student may need assistance completing checkout.</p>
      `
    ),
  };
}

export function manualEnrollmentStudentEmail(user: User, course: Course): { subject: string; html: string } {
  return {
    subject: `You have been enrolled in ${course.title}`,
    html: layout(
      'Manual enrollment confirmed',
      `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>An administrator has enrolled you in <strong>${course.title}</strong>.</p>
        <p>Visit your student dashboard and open <strong>My Courses</strong> to start learning.</p>
      `
    ),
  };
}

export function manualEnrollmentAdminEmail(user: User, course: Course): { subject: string; html: string } {
  return {
    subject: `[Admin] Manual enrollment — ${user.name} → ${course.title}`,
    html: layout(
      'Manual enrollment recorded',
      `
        <p><strong>${user.name}</strong> (${user.email}) was manually enrolled in <strong>${course.title}</strong>.</p>
      `
    ),
  };
}

export function certificateEarnedStudentEmail(
  user: User,
  cert: Certificate,
  verifyUrl: string
): { subject: string; html: string } {
  return {
    subject: `Certificate earned — ${cert.courseTitle}`,
    html: layout(
      'Congratulations! Certificate issued',
      `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>You completed <strong>${cert.courseTitle}</strong>. Your certificate is ready.</p>
        <p><strong>Certificate number:</strong> ${cert.certificateNumber}</p>
        <p><strong>Verify online:</strong> <a href="${verifyUrl}" style="color: #F89A15;">${verifyUrl}</a></p>
      `
    ),
  };
}

export function certificateEarnedAdminEmail(user: User, cert: Certificate): { subject: string; html: string } {
  return {
    subject: `[Admin] Certificate issued — ${user.name} / ${cert.courseTitle}`,
    html: layout(
      'Student earned a certificate',
      `
        <ul>
          <li><strong>Student:</strong> ${user.name} (${user.email})</li>
          <li><strong>Course:</strong> ${cert.courseTitle}</li>
          <li><strong>Certificate #:</strong> ${cert.certificateNumber}</li>
        </ul>
      `
    ),
  };
}

export function passwordChangedStudentEmail(user: User): { subject: string; html: string } {
  return {
    subject: 'Your SkillFort password was changed',
    html: layout(
      'Password updated',
      `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>This confirms your account password was changed on <strong>${new Date().toLocaleString()}</strong>.</p>
        <p>If you did not make this change, contact support immediately.</p>
      `
    ),
  };
}

export function passwordResetRequestEmail(
  user: User,
  resetUrl: string,
  systemName: string
): { subject: string; html: string } {
  return {
    subject: `Reset your ${systemName} password`,
    html: layout(
      'Password reset requested',
      `
        <p>Hi <strong>${escapeHtml(user.name)}</strong>,</p>
        <p>We received a request to reset the password for <strong>${escapeHtml(user.email)}</strong>.</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="display: inline-block; background: #F89A15; color: #000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
            Reset your password
          </a>
        </p>
        <p>This link expires in <strong>1 hour</strong>. If you did not request a reset, you can safely ignore this email.</p>
        <p style="font-size: 12px; color: #888; word-break: break-all;">Or copy this link: ${resetUrl}</p>
      `
    ),
  };
}

export function contactFormAdminEmail(
  name: string,
  email: string,
  message: string
): { subject: string; html: string } {
  return {
    subject: `[Contact] Message from ${name}`,
    html: layout(
      'New contact form submission',
      `
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(email)}</li>
        </ul>
        <p style="margin-top: 16px; white-space: pre-wrap;">${escapeHtml(message)}</p>
      `
    ),
  };
}

export function abandonedCartStudentEmail(
  user: User,
  courses: Course[],
  appUrl: string
): { subject: string; html: string } {
  const list = courses
    .map((c) => `<li><strong>${c.title}</strong> — ₹${c.price}</li>`)
    .join('');
  return {
    subject: 'Your SkillFort cart is waiting for you',
    html: layout(
      'Complete your checkout',
      `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>You still have courses in your cart:</p>
        <ul>${list}</ul>
        <p style="margin-top: 16px;">
          <a href="${appUrl}/student/cart" style="color: #F89A15; font-weight: bold;">Return to your cart</a>
          to finish enrollment.
        </p>
      `
    ),
  };
}

export function abandonedWishlistStudentEmail(
  user: User,
  courses: Course[],
  appUrl: string
): { subject: string; html: string } {
  const list = courses
    .map((c) => `<li><strong>${c.title}</strong> — ₹${c.price}</li>`)
    .join('');
  return {
    subject: 'Courses on your SkillFort wishlist',
    html: layout(
      'Your saved courses are still available',
      `
        <p>Hi <strong>${user.name}</strong>,</p>
        <p>You saved these courses for later:</p>
        <ul>${list}</ul>
        <p style="margin-top: 16px;">
          <a href="${appUrl}/student/wishlist" style="color: #F89A15; font-weight: bold;">View your wishlist</a>
          and enroll when you are ready.
        </p>
      `
    ),
  };
}

export function welcomeAdminEmail(
  user: User,
  systemName: string,
  loginUrl: string,
  createdByName: string,
  temporaryPassword: string
): { subject: string; html: string } {
  return {
    subject: `Your ${systemName} admin account is ready`,
    html: layout(
      'Admin access granted',
      `
        <p>Hi <strong>${escapeHtml(user.name)}</strong>,</p>
        <p>You have been added as an <strong>administrator</strong> on <strong>${escapeHtml(systemName)}</strong> by <strong>${escapeHtml(createdByName)}</strong>.</p>
        <p>Use the credentials below to sign in to the admin portal:</p>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse; margin-top: 16px;">
          <tr><td style="padding: 6px 0; color: #aaa;">Login email</td><td style="text-align: right; font-weight: bold;">${escapeHtml(user.email)}</td></tr>
          <tr><td style="padding: 6px 0; color: #aaa;">Temporary password</td><td style="text-align: right; font-family: monospace;">${escapeHtml(temporaryPassword)}</td></tr>
        </table>
        <p style="margin-top: 20px;">
          <a href="${loginUrl}" style="display: inline-block; background: #F89A15; color: #000; padding: 12px 24px; border-radius: 8px; font-weight: bold; text-decoration: none;">
            Open admin login
          </a>
        </p>
        <p style="margin-top: 12px; font-size: 12px; color: #aaa;">
          Or copy this link: <a href="${loginUrl}" style="color: #F89A15;">${loginUrl}</a>
        </p>
        <p style="margin-top: 20px; font-size: 12px; color: #fbbf24;">For security, change your password after your first login if your organization requires it.</p>
      `
    ),
  };
}

export function adminNewAdminCreatedEmail(
  newAdmin: User,
  createdBy: User
): { subject: string; html: string } {
  return {
    subject: `[Admin] New administrator added: ${newAdmin.name}`,
    html: layout(
      'New admin account created',
      `
        <p>A new administrator account was created on the platform:</p>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(newAdmin.name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(newAdmin.email)}</li>
          <li><strong>Created by:</strong> ${escapeHtml(createdBy.name)} (${escapeHtml(createdBy.email)})</li>
          <li><strong>Created at:</strong> ${new Date(newAdmin.createdAt).toLocaleString()}</li>
        </ul>
        <p style="margin-top: 16px; font-size: 12px; color: #aaa;">Login credentials were emailed to the new administrator.</p>
      `
    ),
  };
}

export function testEmailHtml(): { subject: string; html: string } {
  return {
    subject: 'SkillFort LMS — SMTP test email',
    html: layout(
      'SMTP configuration test',
      `
        <p>If you received this message, your SMTP settings are working correctly.</p>
        <p>Sent at: ${new Date().toLocaleString()}</p>
      `
    ),
  };
}
