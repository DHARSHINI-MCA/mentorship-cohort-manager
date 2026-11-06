import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { SkeletonCard } from '../../components/SkeletonCard';
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

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['trainingTemplates'],
    queryFn: async () => {
      const res = await api.get('/training-templates?limit=50');
      return res.data;
    },
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
      weeks
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Training Track Templates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Build multi-week training curricula with structured courses. When applied to a cohort, a fresh independent copy is generated.
          </p>
        </div>
        <button
          onClick={() => {
            resetBuilder();
            setIsBuilderOpen(true);
          }}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-sm flex items-center gap-2 transition-all shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Training Template</span>
        </button>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard count={3} />
        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templatesData?.items?.map((tpl) => {
            const totalCourses = tpl.weeks?.reduce((acc, w) => acc + (w.courses?.length || 0), 0) || 0;
            const totalHours = tpl.weeks?.reduce(
              (acc, w) => acc + (w.courses?.reduce((cAcc, c) => cAcc + (c.durationHrs || 0), 0) || 0),
              0
            ) || 0;

            return (
              <Card key={tpl.id} hover className="flex flex-col justify-between">
                <CardBody className="p-6">
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <h3 className="font-bold text-slate-800 text-base line-clamp-1">{tpl.name}</h3>
                    <Badge variant="primary">{tpl.totalWeeks} Weeks</Badge>
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-600" />
                      <span>{totalCourses} Courses</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span>{totalHours} Total Hours</span>
                    </div>
                  </div>

                  {/* Weeks list preview */}
                  <div className="mt-4 space-y-1.5">
                    {tpl.weeks?.slice(0, 3).map((w) => (
                      <div key={w.weekNumber} className="text-xs p-2 bg-slate-50 rounded-lg flex justify-between items-center text-slate-600">
                        <span className="font-semibold line-clamp-1">{w.title}</span>
                        <span className="text-slate-400 shrink-0">{w.courses?.length || 0} modules</span>
                      </div>
                    ))}
                    {tpl.weeks?.length > 3 && (
                      <p className="text-[11px] text-slate-400 italic text-center">
                        +{tpl.weeks.length - 3} more weeks...
                      </p>
                    )}
                  </div>
                </CardBody>

                <CardFooter className="bg-slate-50/50">
                  <button
                    onClick={() => {
                      setPreviewTemplate(tpl);
                      setIsEditingTemplate(false);
                      setIsPreviewOpen(true);
                    }}
                    className="text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>View Curriculum</span>
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete training template "${tpl.name}"?`)) {
                        deleteMutation.mutate(tpl.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete template"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </CardFooter>
              </Card>
            );
          })}
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
                weeks: previewTemplate.weeks
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
          </div>
        )}
      </Modal>
    </div>
  );
}
