import React, { useState } from 'react';
import { Pencil, Ban, CheckCircle } from 'lucide-react';
import { apiFetch } from '../../api/client';
import { setPlatformValue } from '../../api/platformKv';
import { type AdminTab } from '../../routes/adminRoutes';
import StudentEditModal, { AdminStudent } from './StudentEditModal';
import PasswordInput from '../ui/PasswordInput';

interface PeopleAdminProps {
  activeTab: AdminTab;
  onNavigate: (tab: AdminTab) => void;
  students: AdminStudent[];
  onRefreshData: () => Promise<void>;
  instructors: any[];
  setInstructors: React.Dispatch<React.SetStateAction<any[]>>;
  notify: (msg: string) => void;
}

export default function PeopleAdmin({
  activeTab,
  onNavigate,
  students,
  onRefreshData,
  instructors,
  setInstructors,
  notify
}: PeopleAdminProps) {

  // Form states
  const [studentForm, setStudentForm] = useState({ name: '', email: '', password: '' });
  const [instructorForm, setInstructorForm] = useState({ name: '', email: '', expertise: '', bio: '' });
  const [editingStudent, setEditingStudent] = useState<AdminStudent | null>(null);
  const [blockingId, setBlockingId] = useState<string | null>(null);

  const handleToggleBlock = async (student: AdminStudent) => {
    const nextBlocked = !student.isBlocked;
    const action = nextBlocked ? 'block' : 'unblock';
    if (!window.confirm(`${nextBlocked ? 'Block' : 'Unblock'} ${student.name}? They ${nextBlocked ? 'will not' : 'will'} be able to sign in.`)) {
      return;
    }

    setBlockingId(student.id);
    try {
      const resp = await apiFetch(`/api/admin/students/${student.id}/block`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: nextBlocked }),
      });
      if (resp.ok) {
        notify(`Student ${action}ed successfully.`);
        await onRefreshData();
      } else {
        const data = await resp.json().catch(() => ({}));
        notify(data.error || `Could not ${action} student.`);
      }
    } catch {
      notify(`Network error while trying to ${action} student.`);
    } finally {
      setBlockingId(null);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentForm.name || !studentForm.email || !studentForm.password) return;

    try {
      const resp = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...studentForm,
          role: 'student'
        })
      });
      if (resp.ok) {
        notify("Student record manually instantiated in database.");
        setStudentForm({ name: '', email: '', password: '' });
        await onRefreshData();
        onNavigate('students-all');
      } else {
        const errData = await resp.json();
        alert(errData.message || "Could not instantiate student record.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateInstructor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instructorForm.name || !instructorForm.email) return;

    const newInst = {
      id: `inst-${Date.now()}`,
      name: instructorForm.name,
      email: instructorForm.email,
      expertise: instructorForm.expertise,
      bio: instructorForm.bio
    };

    const updated = [...instructors, newInst];
    setInstructors(updated);
    await setPlatformValue('skillfort_instructors', updated);
    notify("Faculty academic advisor registered successfully");
    setInstructorForm({ name: '', email: '', expertise: '', bio: '' });
    onNavigate('instructors-all');
  };

  const handleDeleteInstructor = async (id: string) => {
    if (!window.confirm("Verify you request to delete this expert faculty node?")) return;
    const updated = instructors.filter(i => i.id !== id);
    setInstructors(updated);
    await setPlatformValue('skillfort_instructors', updated);
    notify("Faculty expert node removed");
  };

  return (
    <div className="space-y-6">
      {activeTab === 'students-all' && (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-display font-bold text-xs uppercase tracking-wide text-[#F89A15]">Student Registry ledger listings</h3>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#222222]">
            <table className="w-full text-left text-xs border-collapse text-gray-300">
              <thead>
                <tr className="bg-black/40 border-b border-[#222222] text-gray-400 uppercase">
                  <th className="p-4">Full Student Name & Profile</th>
                  <th className="p-4 font-mono">Mail & Contact</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-center">Active Curriculums Linked</th>
                  <th className="p-4 text-right">Transactions volume</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-gray-500">
                      No students registered yet.
                    </td>
                  </tr>
                ) : (
                students.map((st) => (
                  <tr key={st.id} className={`border-b border-[#222222]/50 hover:bg-black/20 ${st.isBlocked ? 'opacity-60' : ''}`}>
                    <td className="p-4 font-semibold text-white">
                      <div>{st.name}</div>
                      {(st.registrationProfile || st.companyOrCollege || st.areaOfInterest) && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {st.registrationProfile?.branch && (
                            <span className="px-1.5 py-0.5 bg-[#F89A15]/10 text-[#F89A15] border border-[#F89A15]/20 rounded text-[9px] font-mono font-bold uppercase tracking-wider">
                              {st.registrationProfile.branch}
                            </span>
                          )}
                          {(st.registrationProfile?.collegeName || st.companyOrCollege) && (
                            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded text-[9px] font-medium">
                              🏢 {st.registrationProfile?.collegeName || st.companyOrCollege}
                            </span>
                          )}
                          {(st.registrationProfile?.requiredCourse || st.areaOfInterest) && (
                            <span className="px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/10 rounded text-[9px] font-bold">
                              🎯 {st.registrationProfile?.requiredCourse || st.areaOfInterest}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-gray-400 font-mono">
                      <div className="text-white font-sans text-xs">{st.email}</div>
                      {st.phone && (
                        <div className="text-[10px] text-gray-500 mt-1 flex items-center gap-1 font-mono">
                          📞 {st.phone}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {st.isBlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold uppercase">
                          <Ban size={10} /> Blocked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase">
                          <CheckCircle size={10} /> Active
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center text-white font-bold">{st.enrollmentsCount || 0} items</td>
                    <td className="p-4 text-right text-[#F89A15] font-mono font-semibold">₹{st.totalSpent || 0}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingStudent(st)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#222222] hover:border-[#F89A15]/40 text-gray-300 hover:text-[#F89A15] text-[10px] font-bold uppercase"
                          title="Edit student"
                        >
                          <Pencil size={12} /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={blockingId === st.id}
                          onClick={() => void handleToggleBlock(st)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold uppercase disabled:opacity-50 ${
                            st.isBlocked
                              ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                              : 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                          }`}
                          title={st.isBlocked ? 'Unblock student' : 'Block student'}
                        >
                          {st.isBlocked ? (
                            <>
                              <CheckCircle size={12} /> Unblock
                            </>
                          ) : (
                            <>
                              <Ban size={12} /> Block
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editingStudent && (
        <StudentEditModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSaved={onRefreshData}
          notify={notify}
        />
      )}

      {activeTab === 'students-add' && (
        <div className="max-w-md bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
          <h3 className="font-display font-medium text-xs text-[#F89A15] uppercase tracking-wide">Register New Student Record</h3>
          <form onSubmit={handleCreateStudent} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">Full Name</label>
              <input
                type="text" required
                value={studentForm.name} onChange={e => setStudentForm({ ...studentForm, name: e.target.value })}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                placeholder="Rohan Sharma"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">Email Address</label>
              <input
                type="email" required
                value={studentForm.email} onChange={e => setStudentForm({ ...studentForm, email: e.target.value })}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                placeholder="rohan@gmail.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">Initial Security Password</label>
              <PasswordInput
                required
                value={studentForm.password}
                onChange={(e) => setStudentForm({ ...studentForm, password: e.target.value })}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[#F89A15] hover:bg-white text-black transition-colors text-xs font-bold uppercase rounded-xl"
            >
              Verify & Instantiate Workspace Access
            </button>
          </form>
        </div>
      )}

      {activeTab === 'instructors-all' && (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <h3 className="font-display font-bold text-xs uppercase text-[#F89A15]">Active Certified Expert Faculty advisors</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instructors.map((inst) => (
              <div key={inst.id} className="p-4 bg-black/40 border border-[#222222] rounded-xl flex justify-between items-start">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wide font-display">{inst.name}</h4>
                  <span className="text-[9px] font-mono text-gray-400 block">{inst.email}</span>
                  <span className="text-[10px] text-[#F89A15] font-bold block">Expertise: {inst.expertise}</span>
                  <p className="text-[10px] text-gray-400 leading-relaxed font-sans">{inst.bio}</p>
                </div>
                <button
                  onClick={() => handleDeleteInstructor(inst.id)}
                  className="p-1 px-2 border border-[#222222] text-red-400 hover:text-white hover:bg-red-500 rounded text-[9px] transition-all"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'instructors-add' && (
        <div className="max-w-md bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
          <h3 className="font-display font-semibold text-xs text-[#F89A15] uppercase tracking-wider">Recruit Certified Faculty Member</h3>
          <form onSubmit={handleCreateInstructor} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Faculty Full Name</label>
                <input
                  type="text" required
                  value={instructorForm.name} onChange={e => setInstructorForm({ ...instructorForm, name: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                  placeholder="Prof. Rajesh Kumar"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Expert Email Address</label>
                <input
                  type="email" required
                  value={instructorForm.email} onChange={e => setInstructorForm({ ...instructorForm, email: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                  placeholder="rajesh@skillfort.co"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">Professional Area/Domain Expertise</label>
              <input
                type="text" required
                value={instructorForm.expertise} onChange={e => setInstructorForm({ ...instructorForm, expertise: e.target.value })}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                placeholder="Enterprise Java / microservice orchestration"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">Certified Biography Details</label>
              <textarea
                required rows={3}
                value={instructorForm.bio} onChange={e => setInstructorForm({ ...instructorForm, bio: e.target.value })}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white resize-none"
                placeholder="Describe academic credentials and background achievements..."
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[#F89A15] hover:bg-white text-black transition-colors text-xs font-bold uppercase rounded-xl"
            >
              Recruit & Instantiate Professional Faculty
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
