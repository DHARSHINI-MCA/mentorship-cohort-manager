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
  ClipboardCheck, PlusCircle, Trash2, ArrowUp, ArrowDown, 
  Plus, Eye, Sparkles 
} from 'lucide-react';

export function FeedbackTemplates() {
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  // Form Builder state
  const [name, setName] = useState('');
  const [fields, setFields] = useState([
    {
      key: 'overall_rating',
      label: 'Overall Progress Rating (1-5)',
      type: 'rating',
      options: [],
      required: true,
    },
    {
      key: 'strengths',
      label: 'Key Strengths & Highlights',
      type: 'text',
      options: [],
      required: true,
    },
    {
      key: 'growth_areas',
      label: 'Areas for Improvement',
      type: 'text',
      options: [],
      required: false,
    },
  ]);

  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const { data: templatesData, isLoading } = useQuery({
    queryKey: ['feedbackTemplates'],
    queryFn: async () => {
      const res = await api.get('/feedback-templates?limit=50');
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      return await api.post('/feedback-templates', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbackTemplates'] });
      showToast('Feedback template created successfully');
      setIsBuilderOpen(false);
      resetBuilder();
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to create template', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await api.delete(`/feedback-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedbackTemplates'] });
      showToast('Feedback template deleted');
    },
    onError: (err) => {
      showToast(err.response?.data?.detail || 'Failed to delete template', 'error');
    },
  });

  const resetBuilder = () => {
    setName('');
    setFields([
      {
        key: 'overall_rating',
        label: 'Overall Progress Rating (1-5)',
        type: 'rating',
        options: [],
        required: true,
      },
      {
        key: 'strengths',
        label: 'Key Strengths & Highlights',
        type: 'text',
        options: [],
        required: true,
      },
    ]);
  };

  const addField = () => {
    const nextIdx = fields.length + 1;
    setFields([
      ...fields,
      {
        key: `field_${nextIdx}`,
        label: `Question / Field ${nextIdx}`,
        type: 'text',
        options: [],
        required: true,
      },
    ]);
  };

  const removeField = (index) => {
    if (fields.length <= 1) {
      showToast('A template must have at least one field', 'warning');
      return;
    }
    setFields(fields.filter((_, i) => i !== index));
  };

  const moveField = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= fields.length) return;
    const updated = [...fields];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    setFields(updated);
  };

  const updateField = (index, prop, value) => {
    const updated = [...fields];
    updated[index][prop] = value;
    if (prop === 'label' && !updated[index]._manualKey) {
      // Auto-generate clean snake_case key from label
      updated[index].key = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
    }
    setFields(updated);
  };

  const updateSelectOptions = (index, textVal) => {
    const options = textVal.split(',').map((o) => o.trim()).filter(Boolean);
    const updated = [...fields];
    updated[index].options = options;
    setFields(updated);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Template name is required', 'warning');
      return;
    }
    createMutation.mutate({
      name,
      fields,
    });
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            Feedback Form Templates
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Design dynamic evaluation forms with rating scales, text notes, and select options for weekly reviews
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
          <span>New Feedback Template</span>
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SkeletonCard count={3} />
        </div>
      ) : templatesData?.items?.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No feedback templates"
          description="Create your first feedback evaluation form with customizable questions."
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
          {templatesData?.items?.map((tpl) => (
            <Card key={tpl.id} hover className="flex flex-col justify-between">
              <CardBody className="p-6">
                <div className="flex justify-between items-start gap-2 mb-3">
                  <h3 className="font-bold text-slate-800 text-base line-clamp-1">{tpl.name}</h3>
                  <Badge variant="primary">{tpl.fields?.length || 0} Fields</Badge>
                </div>

                <div className="space-y-2 pt-3 border-t border-slate-100">
                  {tpl.fields?.map((f, i) => (
                    <div key={f.key || i} className="p-2 rounded-lg bg-slate-50 flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 line-clamp-1">{f.label}</span>
                      <span className="font-mono text-[10px] uppercase text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {f.type}
                      </span>
                    </div>
                  ))}
                </div>
              </CardBody>

              <CardFooter className="bg-slate-50/50">
                <button
                  onClick={() => {
                    setPreviewTemplate(tpl);
                    setIsPreviewOpen(true);
                  }}
                  className="text-xs font-bold text-slate-600 hover:text-slate-800 flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Form</span>
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Delete feedback template "${tpl.name}"?`)) {
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
          ))}
        </div>
      )}

      {/* Form Builder Modal with Reordering */}
      <Modal
        isOpen={isBuilderOpen}
        onClose={() => setIsBuilderOpen(false)}
        title="Feedback Form Builder"
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Template Title
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly Technical Progress Evaluation"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-emerald-500 font-semibold"
            />
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Form Questions & Fields ({fields.length})
              </span>
              <button
                type="button"
                onClick={addField}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Question</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {fields.map((field, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-slate-400">#{idx + 1}</span>
                    <input
                      type="text"
                      required
                      value={field.label}
                      onChange={(e) => updateField(idx, 'label', e.target.value)}
                      placeholder="Question Label (e.g. Code Review Quality)"
                      className="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                    {/* Reorder Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveField(idx, -1)}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === fields.length - 1}
                        onClick={() => moveField(idx, 1)}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        title="Move Down"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeField(idx)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pl-6">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Answer Type</label>
                      <select
                        value={field.type}
                        onChange={(e) => updateField(idx, 'type', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      >
                        <option value="rating">Rating (1 to 5 Stars)</option>
                        <option value="text">Long / Short Text</option>
                        <option value="select">Dropdown Select</option>
                      </select>
                    </div>

                    <div className="flex items-center pt-4">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(e) => updateField(idx, 'required', e.target.checked)}
                          className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                        />
                        <span>Required Answer</span>
                      </label>
                    </div>
                  </div>

                  {field.type === 'select' && (
                    <div className="pl-6 pt-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Select Options (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={field.options?.join(', ')}
                        onChange={(e) => updateSelectOptions(idx, e.target.value)}
                        placeholder="Exceeding Expectations, Meeting Expectations, Needs Improvement"
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white"
                      />
                    </div>
                  )}
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
              {createMutation.isPending ? 'Saving Form...' : 'Save Feedback Template'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Form Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={`Live Form Preview: ${previewTemplate?.name}`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">This is how mentors will see the feedback form when evaluating weekly progress.</p>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-4">
            {previewTemplate?.fields?.map((f, i) => (
              <div key={i} className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  {f.label} {f.required && <span className="text-rose-500">*</span>}
                </label>
                {f.type === 'rating' && (
                  <div className="flex gap-2 text-amber-500 text-lg">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span key={star} className="cursor-pointer hover:scale-110 transition-transform">★</span>
                    ))}
                  </div>
                )}
                {f.type === 'text' && (
                  <textarea
                    disabled
                    placeholder="Mentor enters response..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white"
                    rows={2}
                  />
                )}
                {f.type === 'select' && (
                  <select disabled className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-white">
                    {f.options?.map((opt, oIdx) => (
                      <option key={oIdx}>{opt}</option>
                    ))}
                  </select>
                )}
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
