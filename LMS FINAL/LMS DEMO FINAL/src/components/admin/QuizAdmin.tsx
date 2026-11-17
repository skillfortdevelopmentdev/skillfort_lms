import React, { useState } from 'react';
import { Award, Plus, Trash2, HelpCircle, Save } from 'lucide-react';
import { Course } from '../../types';
import { setPlatformValue } from '../../api/platformKv';

interface QuizAdminProps {
  courses: Course[];
  quizzes: any[];
  setQuizzes: React.Dispatch<React.SetStateAction<any[]>>;
  quizQuestions: any[];
  setQuizQuestions: React.Dispatch<React.SetStateAction<any[]>>;
  notify: (msg: string) => void;
}

export default function QuizAdmin({
  courses,
  quizzes,
  setQuizzes,
  quizQuestions,
  setQuizQuestions,
  notify
}: QuizAdminProps) {
  const [activeSubTab, setActiveSubTab] = useState<'list' | 'add' | 'questions'>('list');

  // Forms state
  const [quizForm, setQuizForm] = useState({ title: '', courseTitle: courses[0]?.title || 'Java Full Stack Academy', passingScore: '80' });
  const [questionForm, setQuestionForm] = useState({ quizId: quizzes[0]?.id || 'quiz-1', questionText: '', optA: '', optB: '', optC: '', optD: '', correct: 'A' });

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizForm.title) return;
    const newQuiz = {
      id: `quiz-${Date.now()}`,
      title: quizForm.title,
      courseTitle: quizForm.courseTitle,
      passingScore: Number(quizForm.passingScore) || 80
    };
    const updated = [...quizzes, newQuiz];
    setQuizzes(updated);
    await setPlatformValue('skillfort_quizzes_mgmt', updated);
    notify("Academic dynamic quiz published");
    setQuizForm({ title: '', courseTitle: courses[0]?.title || 'Java Full Stack Academy', passingScore: '80' });
    setActiveSubTab('list');
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!window.confirm("Delete this quiz completely?")) return;
    const updated = quizzes.filter(q => q.id !== id);
    setQuizzes(updated);
    await setPlatformValue('skillfort_quizzes_mgmt', updated);
    notify("Quiz entry ejected");
  };

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionForm.questionText || !questionForm.optA || !questionForm.optB) return;
    const newQuestion = {
      id: `q-${Date.now()}`,
      quizId: questionForm.quizId,
      questionText: questionForm.questionText,
      optA: questionForm.optA,
      optB: questionForm.optB,
      optC: questionForm.optC,
      optD: questionForm.optD,
      correct: questionForm.correct
    };
    const updated = [...quizQuestions, newQuestion];
    setQuizQuestions(updated);
    await setPlatformValue('skillfort_questions_mgmt', updated);
    notify("Question nodes logged to quiz pool!");
    setQuestionForm({
      quizId: questionForm.quizId,
      questionText: '',
      optA: '',
      optB: '',
      optC: '',
      optD: '',
      correct: 'A'
    });
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!window.confirm("Discard this question?")) return;
    const updated = quizQuestions.filter(q => q.id !== id);
    setQuizQuestions(updated);
    await setPlatformValue('skillfort_questions_mgmt', updated);
    notify("Question node discarded");
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-[#222222] pb-4">
        <button
          onClick={() => setActiveSubTab('list')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${activeSubTab === 'list' ? 'bg-[#F89A15] text-black' : 'bg-[#111111] text-gray-400 hover:text-white'}`}
        >
          All Quizzes ({quizzes.length})
        </button>
        <button
          onClick={() => setActiveSubTab('add')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${activeSubTab === 'add' ? 'bg-[#F89A15] text-black' : 'bg-[#111111] text-gray-400 hover:text-white'}`}
        >
          Add Quiz
        </button>
        <button
          onClick={() => setActiveSubTab('questions')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${activeSubTab === 'questions' ? 'bg-[#F89A15] text-black' : 'bg-[#111111] text-gray-400 hover:text-white'}`}
        >
          Configure Questions Pool
        </button>
      </div>

      {activeSubTab === 'list' && (
        <div className="bg-[#111111] border border-[#222222] rounded-2xl p-6 space-y-4">
          <h3 className="font-display font-medium text-xs text-[#F89A15] uppercase tracking-wider">Active Academic Quizzes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quizzes.map((q) => {
              const qCount = quizQuestions.filter((qw) => qw.quizId === q.id).length;
              return (
                <div key={q.id} className="p-4 rounded-xl border border-[#222222] bg-black/40 flex justify-between items-center">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-mono tracking-widest text-[#F89A15] block">{q.courseTitle}</span>
                    <h4 className="text-xs font-bold text-white font-display">{q.title}</h4>
                    <span className="text-[10px] text-gray-400 block font-mono">Passing Grade: {q.passingScore}% • Total items: {qCount}</span>
                  </div>
                  <button
                    onClick={() => handleDeleteQuiz(q.id)}
                    className="p-2 text-red-400 hover:text-white hover:bg-red-500 rounded-lg transition-all"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeSubTab === 'add' && (
        <div className="max-w-md bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
          <h3 className="font-display font-bold text-xs text-[#F89A15] uppercase tracking-wider">Configure New Quiz Challenge</h3>
          <form onSubmit={handleCreateQuiz} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-bold text-gray-400 block">Quiz Title Headline</label>
              <input
                type="text" required
                value={quizForm.title} onChange={e => setQuizForm({ ...quizForm, title: e.target.value })}
                className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                placeholder="e.g. Docker Containerization exam"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="space-y-1.5 block">
                <span className="text-[10px] uppercase font-bold text-gray-400">Target Curriculum</span>
                <select
                  value={quizForm.courseTitle} onChange={e => setQuizForm({ ...quizForm, courseTitle: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                >
                  {courses.map(c => <option key={c.id} value={c.title}>{c.title}</option>)}
                  <option value="Java Full Stack Academy">Java Full Stack Academy</option>
                  <option value="Data Science & Visual Analytics">Data Science & Visual Analytics</option>
                  <option value="AWS Cloud Development">AWS Cloud Development</option>
                </select>
              </label>
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Passing score percentage</label>
                <input
                  type="number" required min="10" max="100"
                  value={quizForm.passingScore} onChange={e => setQuizForm({ ...quizForm, passingScore: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white font-mono"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-[#F89A15] hover:bg-white text-black transition-colors text-xs font-bold uppercase rounded-xl"
            >
              Save Quiz Template
            </button>
          </form>
        </div>
      )}

      {activeSubTab === 'questions' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
            <h3 className="font-display font-bold text-xs text-[#F89A15] uppercase tracking-wider">Append Question Node</h3>
            <form onSubmit={handleCreateQuestion} className="space-y-3.5 text-xs">
              <label className="space-y-1.5 block">
                <span className="text-[10px] uppercase font-bold text-gray-400">Parent Quiz Target</span>
                <select
                  value={questionForm.quizId} onChange={e => setQuestionForm({ ...questionForm, quizId: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white"
                >
                  {quizzes.map(q => <option key={q.id} value={q.id}>{q.title}</option>)}
                </select>
              </label>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-gray-400 block">Question Query Text</label>
                <textarea
                  required rows={2}
                  value={questionForm.questionText} onChange={e => setQuestionForm({ ...questionForm, questionText: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-3 rounded-lg text-white resize-none"
                  placeholder="e.g. How does garbage collector determine unreferenced memory nodes?"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] uppercase text-gray-400 block font-mono">Option A</label>
                  <input type="text" required value={questionForm.optA} onChange={e => setQuestionForm({ ...questionForm, optA: e.target.value })} className="w-full bg-black border border-[#222222] text-[11px] p-2 rounded text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase text-gray-400 block font-mono">Option B</label>
                  <input type="text" required value={questionForm.optB} onChange={e => setQuestionForm({ ...questionForm, optB: e.target.value })} className="w-full bg-black border border-[#222222] text-[11px] p-2 rounded text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase text-gray-400 block font-mono">Option C</label>
                  <input type="text" value={questionForm.optC} onChange={e => setQuestionForm({ ...questionForm, optC: e.target.value })} className="w-full bg-black border border-[#222222] text-[11px] p-2 rounded text-white" placeholder="Optional" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] uppercase text-gray-400 block font-mono">Option D</label>
                  <input type="text" value={questionForm.optD} onChange={e => setQuestionForm({ ...questionForm, optD: e.target.value })} className="w-full bg-black border border-[#222222] text-[11px] p-2 rounded text-white" placeholder="Optional" />
                </div>
              </div>

              <label className="space-y-1.5 block">
                <span className="text-[10px] uppercase font-bold text-gray-400">Correct Answer Option</span>
                <select
                  value={questionForm.correct} onChange={e => setQuestionForm({ ...questionForm, correct: e.target.value })}
                  className="w-full bg-black border border-[#222222] text-xs p-2.5 rounded-lg text-white font-bold"
                >
                  <option value="A">Option A</option>
                  <option value="B">Option B</option>
                  <option value="C">Option C</option>
                  <option value="D">Option D</option>
                </select>
              </label>

              <button
                type="submit"
                className="w-full py-2.5 bg-[#F89A15] hover:bg-white text-black transition-colors text-xs font-bold uppercase rounded-lg"
              >
                Log Question Node
              </button>
            </form>
          </div>

          <div className="lg:col-span-7 bg-[#111111] border border-[#222222] p-6 rounded-2xl space-y-4">
            <h3 className="font-display font-bold text-sm">Question Pool Matrix</h3>
            <div className="space-y-4 overflow-y-auto max-h-[500px]">
              {quizzes.map(q => {
                const qItems = quizQuestions.filter(qw => qw.quizId === q.id);
                return (
                  <div key={q.id} className="space-y-2 border-b border-[#222222]/60 pb-3">
                    <h4 className="text-xs font-bold text-[#F89A15] font-display">{q.title} pool</h4>
                    {qItems.length > 0 ? (
                      <div className="space-y-2">
                        {qItems.map((qw, index) => (
                          <div key={qw.id} className="p-3 bg-black/40 border border-[#222222] rounded-lg text-[11px] flex justify-between items-center gap-3">
                            <div className="space-y-1">
                              <p className="font-bold text-white">Q{index + 1}: {qw.questionText}</p>
                              <div className="grid grid-cols-2 gap-x-4 text-gray-400 font-mono text-[9px]">
                                <span>A. {qw.optA}</span>
                                <span>B. {qw.optB}</span>
                                {qw.optC && <span>C. {qw.optC}</span>}
                                {qw.optD && <span>D. {qw.optD}</span>}
                              </div>
                              <span className="text-[9px] text-emerald-400 font-bold block">Correct: Option {qw.correct}</span>
                            </div>
                            <button
                              onClick={() => handleDeleteQuestion(qw.id)}
                              className="p-1 px-2 border border-[#222222] hover:bg-red-500 rounded text-[9px] text-red-400 hover:text-white"
                            >
                              Trash
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] italic text-gray-600">No questions mapped to this quiz pool.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
