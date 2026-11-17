import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Enrollment, StudentRegistrationProfile, User } from '../../types';
import { apiFetch } from '../../api/client';
import { enrollmentAccessLabel } from '../../utils/courseValidity';
import {
  HIGHEST_QUALIFICATIONS,
  PASSOUT_YEARS,
  REGISTRATION_BRANCHES,
  REGISTRATION_SOURCES,
  REQUIRED_COURSES,
} from '../../constants/registrationForm';

export interface AdminStudent extends User {
  enrollmentsCount?: number;
  totalSpent?: number;
}

const emptyProfile = (): Record<keyof StudentRegistrationProfile, string> => ({
  branch: '',
  dateOfBirth: '',
  highestQualification: '',
  stream: '',
  collegeName: '',
  yearOfPassout: '',
  knownTechnologies: '',
  requiredCourse: '',
  placementRequired: '',
  preferredCallbackTime: '',
  hasWorkExperience: '',
  address: '',
  panNo: '',
  aadharNo: '',
  source: '',
});

function profileFromStudent(student: AdminStudent): Record<keyof StudentRegistrationProfile, string> {
  const base = emptyProfile();
  const p = student.registrationProfile;
  if (!p) {
    base.collegeName = student.companyOrCollege ?? '';
    base.requiredCourse = student.areaOfInterest ?? '';
    return base;
  }
  return {
    branch: p.branch ?? '',
    dateOfBirth: p.dateOfBirth ?? '',
    highestQualification: p.highestQualification ?? '',
    stream: p.stream ?? '',
    collegeName: p.collegeName ?? '',
    yearOfPassout: p.yearOfPassout ?? '',
    knownTechnologies: p.knownTechnologies ?? '',
    requiredCourse: p.requiredCourse ?? '',
    placementRequired: p.placementRequired ?? '',
    preferredCallbackTime: p.preferredCallbackTime ?? '',
    hasWorkExperience: p.hasWorkExperience ?? '',
    address: p.address ?? '',
    panNo: p.panNo ?? '',
    aadharNo: p.aadharNo ?? '',
    source: p.source ?? '',
  };
}

function applyStudentToForm(student: AdminStudent) {
  return {
    firstName: student.firstName ?? student.name.split(' ')[0] ?? '',
    lastName: student.lastName ?? student.name.split(' ').slice(1).join(' ') ?? '',
    email: student.email,
    phone: student.phone ?? '',
    profile: profileFromStudent(student),
  };
}

interface StudentEditModalProps {
  student: AdminStudent;
  onClose: () => void;
  onSaved: () => void;
  notify: (msg: string) => void;
}

interface AdminStudentEnrollment extends Enrollment {
  courseTitle: string;
  courseValidityDays?: number;
}

const fieldClass =
  'w-full bg-black border border-[#222222] focus:border-[#F89A15] outline-none text-xs text-white p-2.5 rounded-lg';

export default function StudentEditModal({
  student,
  onClose,
  onSaved,
  notify,
}: StudentEditModalProps) {
  const initial = applyStudentToForm(student);
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [profile, setProfile] = useState(initial.profile);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [studentEnrollments, setStudentEnrollments] = useState<AdminStudentEnrollment[]>([]);
  const [extendDaysByCourse, setExtendDaysByCourse] = useState<Record<string, string>>({});
  const [accessBusyCourseId, setAccessBusyCourseId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        const resp = await apiFetch(`/api/admin/students/${student.id}`);
        const data = await resp.json().catch(() => null);
        if (cancelled) {
          return;
        }
        if (!resp.ok || !data) {
          setLoadError(data?.error || 'Could not load the latest student record.');
          return;
        }

        const fresh = data as AdminStudent;
        const form = applyStudentToForm(fresh);
        setFirstName(form.firstName);
        setLastName(form.lastName);
        setEmail(form.email);
        setPhone(form.phone);
        setProfile(form.profile);
        const enrollments = Array.isArray((data as any).enrollments)
          ? ((data as any).enrollments as AdminStudentEnrollment[])
          : [];
        setStudentEnrollments(enrollments);
      } catch {
        if (!cancelled) {
          setLoadError('Network error while loading student record.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [student.id]);

  const setProfileField = (field: keyof StudentRegistrationProfile, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const setExtendDays = (courseId: string, value: string) => {
    setExtendDaysByCourse((prev) => ({ ...prev, [courseId]: value }));
  };

  const refreshStudentDetails = async () => {
    const resp = await apiFetch(`/api/admin/students/${student.id}`);
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) return;
    const enrollments = Array.isArray((data as any).enrollments)
      ? ((data as any).enrollments as AdminStudentEnrollment[])
      : [];
    setStudentEnrollments(enrollments);
  };

  const handleExtendAccess = async (courseId: string) => {
    const raw = (extendDaysByCourse[courseId] || '').trim();
    const days = Number(raw);
    if (!Number.isFinite(days) || days <= 0) {
      notify('Enter valid positive days to extend access.');
      return;
    }
    setAccessBusyCourseId(courseId);
    try {
      const resp = await apiFetch(`/api/admin/students/${student.id}/enrollments/${courseId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extendDays: days }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        notify(data.error || 'Could not extend enrollment access.');
        return;
      }
      notify('Enrollment access extended.');
      setExtendDays(courseId, '');
      await refreshStudentDetails();
      onSaved();
    } catch {
      notify('Network error while extending access.');
    } finally {
      setAccessBusyCourseId(null);
    }
  };

  const handleSetLifetime = async (courseId: string) => {
    if (!window.confirm('Set this enrollment to lifetime access (no expiry)?')) {
      return;
    }
    setAccessBusyCourseId(courseId);
    try {
      const resp = await apiFetch(`/api/admin/students/${student.id}/enrollments/${courseId}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ makeLifetime: true }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        notify(data.error || 'Could not update enrollment access.');
        return;
      }
      notify('Enrollment set to lifetime access.');
      await refreshStudentDetails();
      onSaved();
    } catch {
      notify('Network error while updating access.');
    } finally {
      setAccessBusyCourseId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const resp = await apiFetch(`/api/admin/students/${student.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          name: `${firstName} ${lastName}`.trim() || student.name,
          newPassword: newPassword.trim() || undefined,
          registrationProfile: {
            branch: profile.branch.trim(),
            dateOfBirth: profile.dateOfBirth,
            highestQualification: profile.highestQualification.trim(),
            stream: profile.stream.trim(),
            collegeName: profile.collegeName.trim(),
            yearOfPassout: profile.yearOfPassout.trim(),
            knownTechnologies: profile.knownTechnologies.trim() || undefined,
            requiredCourse: profile.requiredCourse.trim(),
            placementRequired: profile.placementRequired as 'yes' | 'no',
            preferredCallbackTime: profile.preferredCallbackTime.trim() || undefined,
            hasWorkExperience: profile.hasWorkExperience as 'yes' | 'no',
            address: profile.address.trim(),
            panNo: profile.panNo.trim() || undefined,
            aadharNo: profile.aadharNo.trim() || undefined,
            source: profile.source.trim(),
          },
        }),
      });

      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        setError(data.error || 'Could not save student record.');
        return;
      }

      notify('Student record updated successfully.');
      onSaved();
      onClose();
    } catch {
      setError('Network error while saving student record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <div className="bg-[#0A0A0A] border border-[#222222] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-[#222222]">
          <div>
            <h3 className="font-display font-bold text-white">Edit student</h3>
            <p className="text-[10px] text-gray-500 font-mono mt-1">{student.email}</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white p-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5">
          {loadError && (
            <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">{loadError}</p>
          )}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">{error}</p>
          )}

          <section className="space-y-3">
            <h4 className="text-[10px] font-bold text-[#F89A15] uppercase tracking-wider">Account</h4>
            {loading ? (
              <p className="text-xs text-gray-500">Loading latest registration data…</p>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">First name</span>
                <input className={fieldClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Last name</span>
                <input className={fieldClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Email</span>
                <input type="email" className={fieldClass} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Phone</span>
                <input className={fieldClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="space-y-1 block sm:col-span-2">
                <span className="text-[10px] text-gray-500 uppercase">Reset password (optional)</span>
                <input
                  type="password"
                  className={fieldClass}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Leave blank to keep current password"
                />
              </label>
            </div>
            )}
          </section>

          <section className="space-y-3">
            <h4 className="text-[10px] font-bold text-[#F89A15] uppercase tracking-wider">Registration details</h4>
            {loading ? (
              <p className="text-xs text-gray-500">Loading registration profile…</p>
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Branch</span>
                <select className={fieldClass} value={profile.branch} onChange={(e) => setProfileField('branch', e.target.value)}>
                  <option value="">Select branch</option>
                  {REGISTRATION_BRANCHES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Date of birth</span>
                <input type="date" className={`${fieldClass} date-picker-full`} value={profile.dateOfBirth} onChange={(e) => setProfileField('dateOfBirth', e.target.value)} />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Highest qualification</span>
                <select className={fieldClass} value={profile.highestQualification} onChange={(e) => setProfileField('highestQualification', e.target.value)}>
                  <option value="">Select qualification</option>
                  {HIGHEST_QUALIFICATIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Stream</span>
                <input className={fieldClass} value={profile.stream} onChange={(e) => setProfileField('stream', e.target.value)} placeholder="ARTS / ENGINEER & DEPARTMENT" />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">College name</span>
                <input className={fieldClass} value={profile.collegeName} onChange={(e) => setProfileField('collegeName', e.target.value)} />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Year of passout</span>
                <select className={fieldClass} value={profile.yearOfPassout} onChange={(e) => setProfileField('yearOfPassout', e.target.value)}>
                  <option value="">Select year</option>
                  {PASSOUT_YEARS.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 block sm:col-span-2">
                <span className="text-[10px] text-gray-500 uppercase">Known technologies</span>
                <textarea rows={2} className={`${fieldClass} resize-none`} value={profile.knownTechnologies} onChange={(e) => setProfileField('knownTechnologies', e.target.value)} />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Required course</span>
                <select className={fieldClass} value={profile.requiredCourse} onChange={(e) => setProfileField('requiredCourse', e.target.value)}>
                  <option value="">Select course</option>
                  {REQUIRED_COURSES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Preferred callback time</span>
                <input className={fieldClass} value={profile.preferredCallbackTime} onChange={(e) => setProfileField('preferredCallbackTime', e.target.value)} />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Placement required</span>
                <div className="flex gap-4 pt-2">
                  {(['yes', 'no'] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 text-xs text-gray-300">
                      <input type="radio" name="editPlacement" checked={profile.placementRequired === v} onChange={() => setProfileField('placementRequired', v)} className="accent-[#F89A15]" />
                      {v === 'yes' ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Work experience</span>
                <div className="flex gap-4 pt-2">
                  {(['yes', 'no'] as const).map((v) => (
                    <label key={v} className="flex items-center gap-2 text-xs text-gray-300">
                      <input type="radio" name="editExperience" checked={profile.hasWorkExperience === v} onChange={() => setProfileField('hasWorkExperience', v)} className="accent-[#F89A15]" />
                      {v === 'yes' ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </label>
              <label className="space-y-1 block sm:col-span-2">
                <span className="text-[10px] text-gray-500 uppercase">Address</span>
                <textarea rows={2} className={`${fieldClass} resize-none`} value={profile.address} onChange={(e) => setProfileField('address', e.target.value)} />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">PAN (optional)</span>
                <input className={fieldClass} value={profile.panNo} onChange={(e) => setProfileField('panNo', e.target.value.toUpperCase())} />
              </label>
              <label className="space-y-1 block">
                <span className="text-[10px] text-gray-500 uppercase">Aadhar (optional)</span>
                <input className={fieldClass} value={profile.aadharNo} onChange={(e) => setProfileField('aadharNo', e.target.value.replace(/\D/g, ''))} />
              </label>
              <label className="space-y-1 block sm:col-span-2">
                <span className="text-[10px] text-gray-500 uppercase">Source</span>
                <select className={fieldClass} value={profile.source} onChange={(e) => setProfileField('source', e.target.value)}>
                  <option value="">Select source</option>
                  {REGISTRATION_SOURCES.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
            )}
          </section>

          <section className="space-y-3">
            <h4 className="text-[10px] font-bold text-[#F89A15] uppercase tracking-wider">Course access management</h4>
            {loading ? (
              <p className="text-xs text-gray-500">Loading enrollments…</p>
            ) : studentEnrollments.length === 0 ? (
              <p className="text-xs text-gray-500">No enrollments found for this student.</p>
            ) : (
              <div className="space-y-3">
                {studentEnrollments.map((enrollment) => (
                  <div
                    key={`${enrollment.userId}-${enrollment.courseId}`}
                    className="border border-[#222222] bg-black/40 rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-white font-semibold">{enrollment.courseTitle}</p>
                        <p className="text-[10px] text-gray-500">{enrollmentAccessLabel(enrollment)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={accessBusyCourseId === enrollment.courseId}
                        onClick={() => void handleSetLifetime(enrollment.courseId)}
                        className="px-2.5 py-1.5 border border-[#222222] hover:border-[#F89A15]/40 text-gray-300 hover:text-[#F89A15] text-[10px] font-bold uppercase rounded-lg disabled:opacity-60"
                      >
                        Lifetime
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        className={fieldClass}
                        value={extendDaysByCourse[enrollment.courseId] || ''}
                        onChange={(e) => setExtendDays(enrollment.courseId, e.target.value)}
                        placeholder="Add days (e.g. 30)"
                        type="number"
                        min={1}
                      />
                      <button
                        type="button"
                        disabled={accessBusyCourseId === enrollment.courseId}
                        onClick={() => void handleExtendAccess(enrollment.courseId)}
                        className="px-3 py-2 bg-[#F89A15] hover:bg-white text-black text-[10px] font-bold uppercase rounded-lg disabled:opacity-60"
                      >
                        Extend
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="flex gap-3 pt-2 border-t border-[#222222]">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-[#222222] text-gray-400 hover:text-white rounded-xl text-xs font-bold uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="flex-1 py-2.5 bg-[#F89A15] hover:bg-white text-black rounded-xl text-xs font-bold uppercase disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
