import type { StudentRegistrationProfile, User } from '../src/types';
import { hashPassword } from './auth';

export function buildStudentDisplayName(
  firstName?: string,
  lastName?: string,
  fallbackName?: string
): string {
  const combined = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  return combined || fallbackName?.trim() || 'Student';
}

export function normalizeRegistrationProfile(
  profile: StudentRegistrationProfile
): StudentRegistrationProfile {
  return {
    branch: profile.branch.trim(),
    dateOfBirth: profile.dateOfBirth,
    highestQualification: profile.highestQualification.trim(),
    stream: profile.stream.trim(),
    collegeName: profile.collegeName.trim(),
    yearOfPassout: profile.yearOfPassout.trim(),
    knownTechnologies: profile.knownTechnologies?.trim() || undefined,
    requiredCourse: profile.requiredCourse.trim(),
    placementRequired: profile.placementRequired,
    preferredCallbackTime: profile.preferredCallbackTime?.trim() || undefined,
    hasWorkExperience: profile.hasWorkExperience,
    address: profile.address.trim(),
    panNo: profile.panNo?.trim() || undefined,
    aadharNo: profile.aadharNo?.trim() || undefined,
    source: profile.source.trim(),
  };
}

/** Keep existing profile values when the admin form sends blank fields (avoids accidental wipe). */
export function mergeRegistrationProfile(
  existing: StudentRegistrationProfile | undefined,
  incoming: StudentRegistrationProfile
): StudentRegistrationProfile {
  const next = normalizeRegistrationProfile(incoming);
  if (!existing) {
    return next;
  }

  const merged: StudentRegistrationProfile = { ...existing };
  (Object.keys(next) as (keyof StudentRegistrationProfile)[]).forEach((key) => {
    const value = next[key];
    if (value !== undefined && value !== '') {
      (merged as Record<keyof StudentRegistrationProfile, string | undefined>)[key] = value;
    }
  });
  return merged;
}

export async function applyStudentAdminUpdate(
  user: User,
  payload: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    name?: string;
    registrationProfile?: StudentRegistrationProfile;
    newPassword?: string;
  },
  passwords: Record<string, string>
): Promise<void> {
  if (payload.firstName !== undefined) user.firstName = payload.firstName.trim();
  if (payload.lastName !== undefined) user.lastName = payload.lastName.trim();
  if (payload.phone !== undefined) user.phone = payload.phone.trim();

  if (payload.email !== undefined) {
    user.email = payload.email.trim().toLowerCase();
  }

  if (payload.registrationProfile) {
    user.registrationProfile = mergeRegistrationProfile(
      user.registrationProfile,
      payload.registrationProfile
    );
    user.areaOfInterest = user.registrationProfile.requiredCourse;
    user.companyOrCollege = user.registrationProfile.collegeName;
  }

  user.name =
    payload.name?.trim() ||
    buildStudentDisplayName(user.firstName, user.lastName, user.name);

  if (payload.newPassword?.trim()) {
    passwords[user.id] = await hashPassword(payload.newPassword.trim());
  }
}
