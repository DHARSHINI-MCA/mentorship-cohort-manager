import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { 
  BookOpen, PlusCircle, Trash2, Clock, Layers, Plus, 
  ChevronDown, ChevronUp, Eye, Sparkles, Edit3
} from 'lucide-react';

export function TrainingTemplates() {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [isEditingTemplate, setIsEditingTemplate] = useState(false);
  const [showAddTalentNextCourse, setShowAddTalentNextCourse] = useState(false);
  const [newTalentNextCourseName, setNewTalentNextCourseName] = useState('');

  // Builder State
  const [name, setName] = useState('');
  const [weeks, setWeeks] = useState([
    {
      weekNumber: 1,
      title: 'Week 1: Fundamentals',
      courses: [
        { title: 'Orientation & Git Setup', description: 'Environment config and branching strategy', durationHrs: 3.0 }
      ]
    }
  ]);
  const [talentnextCourses, setTalentnextCourses] = useState([]);

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['trainingTemplates'],
    queryFn: async () => {
      const res = await api.get('/training-templates?limit=50');
      return res.data;
    },
  });

  const { data: talentNextCatalog = [] } = useQuery({
    queryKey: ['talentnextCoursesList'],
    queryFn: async () => (await api.get('/talentnext-courses')).data || [],
  });

  const createTalentNextCourseMutation = useMutation({
    mutationFn: async (courseName) => (await api.post('/talentnext-courses', { name: courseName })).data,
    onSuccess: (course) => {
      queryClient.setQueryData(['talentnextCoursesList'], (current = []) => [
        ...current.filter((item) => item.id !== course.id),
        course,
      ]);
      queryClient.invalidateQueries({ queryKey: ['talentnextCoursesList'] });
    },
    onError: (err) => showToast(err.response?.data?.detail || 'Could not add TalentNext course', 'error'),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.post('/training-templates', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingTemplates'] });
      showToast('Training template created successfully');
      setIsBuilderOpen(false);
      resetBuilder();
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to create template', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await api.delete(`/training-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingTemplates'] });
      showToast('Training template deleted');
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to delete template', 'error');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.put(`/training-templates/${previewTemplate.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainingTemplates'] });
      showToast('Training template updated successfully');
      setIsEditingTemplate(false);
      setIsPreviewOpen(false);
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to update template', 'error');
    },
  });

  const resetBuilder = () => {
    setName('');
    setTalentnextCourses([]);
    setWeeks([
      {
        weekNumber: 1,
        title: 'Week 1: Fundamentals',
        courses: [
          { title: 'Orientation & Git Setup', description: 'Environment config and branching strategy', durationHrs: 3.0 }
        ]
      }
    ]);
  };

  const addWeek = () => {
    const nextNum = weeks.length + 1;
    setWeeks([
      ...weeks,
      {
        weekNumber: nextNum,
        title: `Week ${nextNum}: Core Concepts`,
        courses: [
          { title: 'Module 1', description: '', durationHrs: 2.0 }
        ]
      }
    ]);
  };

  const removeWeek = (index) => {
    if (weeks.length <= 1) {
      showToast('A template must have at least one week', 'warning');
      return;
    }
    const updated = weeks.filter((_, i) => i !== index).map((w, idx) => ({
      ...w,
      weekNumber: idx + 1
    }));
    setWeeks(updated);
  };

  const updateWeekTitle = (index, title) => {
    const updated = [...weeks];
    updated[index].title = title;
    setWeeks(updated);
  };

  const addCourse = (weekIndex) => {
    const updated = [...weeks];
    updated[weekIndex].courses.push({
      title: 'New Course Module',
      description: '',
      durationHrs: 2.0
    });
    setWeeks(updated);
  };

  const removeCourse = (weekIndex, courseIndex) => {
    const updated = [...weeks];
    if (updated[weekIndex].courses.length <= 1) {
      showToast('Each week must have at least one course', 'warning');
      return;
    }
    updated[weekIndex].courses = updated[weekIndex].courses.filter((_, i) => i !== courseIndex);
    setWeeks(updated);
  };

  const updateCourse = (weekIndex, courseIndex, field, value) => {
    const updated = [...weeks];
    updated[weekIndex].courses[courseIndex][field] = value;
    setWeeks(updated);
  };

  const handleSubmitBuilder = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Template name is required', 'warning');
      return;
    }
    createMutation.mutate({
      name,
      totalWeeks: weeks.length,
      weeks,
      talentnextCourses
    });
  };

  const renderTalentNextEditor = (assignments, onChange) => (
    <section className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">TalentNext courses</h3>
          <p className="mt-1 text-xs text-slate-500">Selected courses are included when this training plan is applied to a cohort.</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddTalentNextCourse((shown) => !shown);
            setNewTalentNextCourseName('');
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
        >
          <Plus className="h-3.5 w-3.5" /> Add TalentNext course
        </button>
      </div>
      {showAddTalentNextCourse && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white p-2.5">
          <input
            type="text"
            value={newTalentNextCourseName}
            onChange={(event) => setNewTalentNextCourseName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                event.currentTarget.closest('div')?.querySelector('[data-create-talentnext]')?.click();
              }
            }}
            placeholder="Course name"
            aria-label="New TalentNext course name"
            className="min-w-48 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          <button
            type="button"
            data-create-talentnext
            disabled={!newTalentNextCourseName.trim() || createTalentNextCourseMutation.isPending}
            onClick={async () => {
              const courseName = newTalentNextCourseName.trim();
              if (!courseName) return;
              const existing = talentNextCatalog.find((course) => course.name.trim().toLocaleLowerCase() === courseName.toLocaleLowerCase());
              try {
                const course = existing || await createTalentNextCourseMutation.mutateAsync(courseName);
                if (!assignments.some((item) => item.courseId === course.id)) {
                  onChange([...assignments, { courseId: course.id, isMandatory: true }]);
                }
                setNewTalentNextCourseName('');
                setShowAddTalentNextCourse(false);
                showToast(existing ? 'Existing TalentNext course added to this template' : 'TalentNext course created and added to this template');
              } catch {
                // The mutation displays the API error in a toast.
              }
            }}
            className="rounded-lg bg-amber-700 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createTalentNextCourseMutation.isPending ? 'Adding…' : 'Add to template'}
          </button>
        </div>
      )}
      {talentNextCatalog.length ? (
        <div className="divide-y divide-amber-100 rounded-lg border border-amber-100 bg-white">
          {talentNextCatalog.map((course) => {
            const assignment = assignments.find((item) => item.courseId === course.id);
            return (
              <div key={course.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5">
                <label className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={Boolean(assignment)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...assignments, { courseId: course.id, isMandatory: true }]
                        : assignments.filter((item) => item.courseId !== course.id);
                      onChange(next);
                    }}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="truncate">{course.name}</span>
                </label>
                {assignment && (
                  <select
                    aria-label={`${course.name} requirement`}
                    value={assignment.isMandatory ? 'required' : 'optional'}
                    onChange={(event) => onChange(assignments.map((item) => item.courseId === course.id
                      ? { ...item, isMandatory: event.target.value === 'required' }
                      : item))}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
                  >
                    <option value="required">Required</option>
                    <option value="optional">Optional</option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      ) : <p className="rounded-lg border border-dashed border-amber-200 bg-white px-3 py-4 text-center text-xs text-slate-500">No TalentNext courses are available yet.</p>}
    </section>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between py-2 border-b border-slate-200">
        <div>
          <h1 className="text-sm font-bold text-slate-900 tracking-tight">Training Track Templates</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-week training curricula. When applied to a cohort, a fresh independent copy is generated.
          </p>
        </div>
        <button
          onClick={() => {
            resetBuilder();
            setIsBuilderOpen(true);
          }}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 transition-all shrink-0"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>New Training Template</span>
        </button>
      </div>

      {/* Templates Table */}
      {isLoading ? (
        <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading templates...</div>
      ) : templatesData?.items?.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No training templates created"
          description="Create your first training template with weeks and course modules."
          action={
            <button
              onClick={() => {
                resetBuilder();
                setIsBuilderOpen(true);
              }}
              className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create Template</span>
            </button>
          }
        />
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="py-2 px-4 text-left font-bold uppercase tracking-wider text-slate-500 text-[11px]">Template Name</th>
                <th className="py-2 px-4 text-center font-bold uppercase tracking-wider text-slate-500 text-[11px]">Weeks</th>
                <th className="py-2 px-4 text-center font-bold uppercase tracking-wider text-slate-500 text-[11px]">Courses</th>
                <th className="py-2 px-4 text-center font-bold uppercase tracking-wider text-slate-500 text-[11px]">Total Hours</th>
                <th className="py-2 px-4 text-right font-bold uppercase tracking-wider text-slate-500 text-[11px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {templatesData?.items?.map((tpl) => {
                const totalCourses = tpl.weeks?.reduce((acc, w) => acc + (w.courses?.length || 0), 0) || 0;
                const totalHours = tpl.weeks?.reduce(
                  (acc, w) => acc + (w.courses?.reduce((cAcc, c) => cAcc + (c.durationHrs || 0), 0) || 0),
                  0
                ) || 0;

                return (
                  <tr key={tpl.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{tpl.name}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="text-[11px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {tpl.totalWeeks}w
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-600">
                      <span className="flex items-center justify-center gap-1">
                        <Layers className="w-3 h-3 text-emerald-500" />
                        {totalCourses}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-600">
                      <span className="flex items-center justify-center gap-1">
                        <Clock className="w-3 h-3 text-blue-500" />
                        {totalHours}h
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => {
                            setPreviewTemplate(tpl);
                            setIsEditingTemplate(false);
                            setIsPreviewOpen(true);
                          }}
                          className="text-xs font-semibold text-emerald-700 hover:underline flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          View Curriculum
                        </button>
                        <button
                          onClick={() => {
                            setPreviewTemplate(tpl);
                            setIsEditingTemplate(true);
                            setIsPreviewOpen(true);
                          }}
                          className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1"
                        >
                          <Edit3 className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete training template "${tpl.name}"?`)) {
                              deleteMutation.mutate(tpl.id);
                            }
                          }}
                          className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Interactive Builder Modal */}
      <Modal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        title="Training Template Builder"
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleSubmitBuilder} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Template Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Full-Stack Engineering Track (4 Weeks)"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 font-semibold"
            />
          </div>

          {/* Weeks Accordion / List */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Track Weeks ({weeks.length})
              </span>
              <button
                type="button"
                onClick={addWeek}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Week</span>
              </button>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {week.weekNumber}
                      </span>
                      <input
                        type="text"
                        required
                        value={week.title}
                        onChange={(e) => updateWeekTitle(wIdx, e.target.value)}
                        placeholder="Week Title"
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWeek(wIdx)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Remove week"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Courses in this week */}
                  <div className="pl-9 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Courses ({week.courses.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => addCourse(wIdx)}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Course</span>
                      </button>
                    </div>

                    {week.courses.map((course, cIdx) => (
                      <div key={cIdx} className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            required
                            value={course.title}
                            onChange={(e) => updateCourse(wIdx, cIdx, 'title', e.target.value)}
                            placeholder="Course Module Title"
                            className="flex-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={course.durationHrs}
                              onChange={(e) => updateCourse(wIdx, cIdx, 'durationHrs', parseFloat(e.target.value) || 1)}
                              className="w-16 px-2 py-1 text-xs text-right rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                            <span className="text-xs text-slate-400">hrs</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCourse(wIdx, cIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={course.description}
                          onChange={(e) => updateCourse(wIdx, cIdx, 'description', e.target.value)}
                          placeholder="Brief module description or learning goals..."
                          className="w-full px-2.5 py-1 text-xs text-slate-500 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {renderTalentNextEditor(talentnextCourses, setTalentnextCourses)}

          <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setIsBuilderOpen(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving Template...' : 'Save Training Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Full Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setIsEditingTemplate(false);
        }}
        title={`${isEditingTemplate ? 'Edit' : 'Preview'}: ${previewTemplate?.name}`}
        maxWidth="max-w-2xl"
      >
        {isEditingTemplate ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateMutation.mutate({
                name: previewTemplate.name,
                totalWeeks: previewTemplate.totalWeeks,
                weeks: previewTemplate.weeks,
                talentnextCourses: previewTemplate.talentnextCourses || []
              });
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Template Name
              </label>
              <input
                type="text"
                value={previewTemplate.name}
                onChange={(e) => setPreviewTemplate({ ...previewTemplate, name: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 font-semibold"
              />
            </div>

            {/* Weeks Editor */}
            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {previewTemplate.weeks?.map((week, wIdx) => (
                <div key={wIdx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {week.weekNumber}
                      </span>
                      <input
                        type="text"
                        value={week.title}
                        onChange={(e) => {
                          const updated = [...previewTemplate.weeks];
                          updated[wIdx].title = e.target.value;
                          setPreviewTemplate({ ...previewTemplate, weeks: updated });
                        }}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold bg-white focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = previewTemplate.weeks.filter((_, i) => i !== wIdx).map((w, idx) => ({
                          ...w,
                          weekNumber: idx + 1
                        }));
                        setPreviewTemplate({
                          ...previewTemplate,
                          weeks: updated,
                          totalWeeks: updated.length
                        });
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Courses in this week */}
                  <div className="pl-9 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        Courses ({week.courses.length})
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...previewTemplate.weeks];
                          updated[wIdx].courses.push({
                            title: 'New Course Module',
                            description: '',
                            durationHrs: 2.0
                          });
                          setPreviewTemplate({ ...previewTemplate, weeks: updated });
                        }}
                        className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Course</span>
                      </button>
                    </div>

                    {week.courses.map((course, cIdx) => (
                      <div key={cIdx} className="p-3 bg-white rounded-xl border border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <input
                            type="text"
                            value={course.title}
                            onChange={(e) => {
                              const updated = [...previewTemplate.weeks];
                              updated[wIdx].courses[cIdx].title = e.target.value;
                              setPreviewTemplate({ ...previewTemplate, weeks: updated });
                            }}
                            className="flex-1 px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500"
                          />
                          <div className="flex items-center gap-1 shrink-0">
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              value={course.durationHrs}
                              onChange={(e) => {
                                const updated = [...previewTemplate.weeks];
                                updated[wIdx].courses[cIdx].durationHrs = parseFloat(e.target.value) || 1;
                                setPreviewTemplate({ ...previewTemplate, weeks: updated });
                              }}
                              className="w-16 px-2 py-1 text-xs text-right rounded-lg border border-slate-200 focus:ring-1 focus:ring-emerald-500 font-mono"
                            />
                            <span className="text-xs text-slate-400">hrs</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...previewTemplate.weeks];
                              updated[wIdx].courses = updated[wIdx].courses.filter((_, i) => i !== cIdx);
                              setPreviewTemplate({ ...previewTemplate, weeks: updated });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input
                          type="text"
                          value={course.description}
                          onChange={(e) => {
                            const updated = [...previewTemplate.weeks];
                            updated[wIdx].courses[cIdx].description = e.target.value;
                            setPreviewTemplate({ ...previewTemplate, weeks: updated });
                          }}
                          placeholder="Brief module description or learning goals..."
                          className="w-full px-2.5 py-1 text-xs text-slate-500 rounded-lg border border-slate-100 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {renderTalentNextEditor(
              previewTemplate.talentnextCourses || [],
              (assignments) => setPreviewTemplate({ ...previewTemplate, talentnextCourses: assignments })
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsEditingTemplate(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving Template...' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Badge variant="primary">{previewTemplate?.totalWeeks} Weeks Total</Badge>
              {(previewTemplate?.talentnextCourses || []).length > 0 && (
                <Badge variant="warning">{previewTemplate.talentnextCourses.length} TalentNext courses</Badge>
              )}
              <button
                onClick={() => setIsEditingTemplate(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors"
              >
                <Edit3 className="w-3 h-3" />
                <span>Edit Template</span>
              </button>
            </div>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {previewTemplate?.weeks?.map((w) => (
                <div key={w.weekNumber} className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                    <span>{w.title}</span>
                    <span className="text-slate-400">{w.courses?.length || 0} courses</span>
                  </div>
                  <div className="space-y-2 pt-1 pl-2">
                    {w.courses?.map((c, idx) => (
                      <div key={idx} className="p-2.5 bg-white rounded-lg border border-slate-100 flex justify-between items-start text-xs">
                        <div>
                          <span className="font-bold text-slate-800">{c.title}</span>
                          {c.description && <p className="text-slate-500 mt-0.5">{c.description}</p>}
                        </div>
                        <span className="font-mono text-slate-400 shrink-0 ml-2">{c.durationHrs} hrs</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <section className="border-t border-slate-200 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">TalentNext courses</h3>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTemplate(true);
                    setShowAddTalentNextCourse(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add courses
                </button>
              </div>
              {(previewTemplate?.talentnextCourses || []).length > 0 ? (
                <ul className="mt-2 divide-y divide-slate-100 border-y border-slate-100">
                  {previewTemplate.talentnextCourses.map((assignment) => (
                    <li key={assignment.courseId} className="flex items-center justify-between gap-3 py-2 text-xs">
                      <span className="font-medium text-slate-800">{talentNextCatalog.find((course) => course.id === assignment.courseId)?.name || 'Course unavailable'}</span>
                      <span className={assignment.isMandatory ? 'font-semibold text-amber-700' : 'text-slate-500'}>{assignment.isMandatory ? 'Required' : 'Optional'}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="mt-2 rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-500">No TalentNext courses are attached to this template.</p>}
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
