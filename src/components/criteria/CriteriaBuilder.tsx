import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  X,
  ArrowRight,
  Trash2,
  Package,
  ChevronDown,
  ChevronUp,
  Loader2,
  Star,
  FileText,
  Search,
  CheckCircle2,
} from 'lucide-react';
import { calibrationApi, regexApi } from '../../api/client';
import { HelpButton, HelpPanel } from '../ui/HelpPanel';
import type { Criterion, CalibrationPackage } from '../../types';

const OPERATORS = [
  { value: '>', label: '>' },
  { value: '>=', label: '>=' },
  { value: '<', label: '<' },
  { value: '<=', label: '<=' },
  { value: 'between', label: 'between' },
];

const CRITERION_TYPES = [
  { value: 'presence', label: 'Presence', color: 'bg-slate-100 text-slate-700' },
  { value: 'extraction', label: 'Extraction', color: 'bg-teal-100 text-teal-700' },
  { value: 'comparison', label: 'Comparison', color: 'bg-amber-100 text-amber-700' },
  { value: 'range', label: 'Range', color: 'bg-indigo-100 text-indigo-700' },
] as const;

interface Props {
  setActiveTab: (tab: string) => void;
  setWorkflowPrefillPackageId?: (packageId: string | null) => void;
}

export default function CriteriaBuilder({ setActiveTab, setWorkflowPrefillPackageId }: Props) {
  const queryClient = useQueryClient();

  // Package state
  const [loadedPackageId, setLoadedPackageId] = useState<string | null>(null);
  const [loadedPackageName, setLoadedPackageName] = useState<string | null>(null);
  const [packageName, setPackageName] = useState('');
  const [packageDescription, setPackageDescription] = useState('');

  // Criteria state
  const [criteria, setCriteria] = useState<Criterion[]>([
    { id: 'I1', type: 'inclusion', question_text: '' },
  ]);

  // Appraisal from loaded package
  const [appraisalResults, setAppraisalResults] = useState<CalibrationPackage['appraisal_results'] | null>(null);
  const [showAppraisal, setShowAppraisal] = useState(false);

  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const skipAutoSave = useRef(false);
  const isInitialMount = useRef(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState({
    inclusion: false,
    exclusion: false,
  });

  // Fetch packages
  const { data: packages, isLoading: packagesLoading } = useQuery({
    queryKey: ['calibration-packages'],
    queryFn: () => calibrationApi.listPackages(),
  });

  // Save mutation — updates existing package if one is loaded, otherwise creates new
  const saveMutation = useMutation({
    mutationFn: (data: Parameters<typeof calibrationApi.savePackage>[0] & { _packageId?: string }) => {
      const { _packageId, ...payload } = data;
      if (_packageId) {
        return calibrationApi.updatePackage(_packageId, payload);
      }
      return calibrationApi.savePackage(payload);
    },
    onSuccess: (saved) => {
      setLoadedPackageId(saved.package_id);
      setLoadedPackageName(saved.name);
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['calibration-packages'] });
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    },
    onError: () => setAutoSaveStatus('error'),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (packageId: string) => calibrationApi.deletePackage(packageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration-packages'] });
      if (loadedPackageId && deleteMutation.variables === loadedPackageId) {
        handleNewPackage();
      }
    },
  });

  // Auto-save: debounce 1.5s after any change to criteria, name, or description
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    const nonEmpty = criteria.filter(c => c.question_text.trim());
    if (nonEmpty.length === 0) return;

    setAutoSaveStatus('pending');
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSaveTimer.current = null;
      const name = packageName.trim() || `Criteria ${new Date().toLocaleDateString()}`;
      setAutoSaveStatus('saving');
      saveMutation.mutate({
        _packageId: loadedPackageId ?? undefined,
        name,
        description: packageDescription || undefined,
        criteria,
        appraisal_results: appraisalResults || undefined,
      });
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, packageName, packageDescription]);

  // Derived lists
  const inclusionCriteria = criteria.filter(c => c.type === 'inclusion');
  const exclusionCriteria = criteria.filter(c => c.type === 'exclusion');

  // Handlers
  const addCriterion = (type: 'inclusion' | 'exclusion') => {
    const prefix = type === 'inclusion' ? 'I' : 'E';
    const sameType = criteria.filter(c => c.type === type);
    const newId = `${prefix}${sameType.length + 1}`;
    const newCriterion: Criterion = { id: newId, type, question_text: '' };
    setCriteria([...criteria, newCriterion]);
  };

  const removeCriterion = (idx: number) => {
    setCriteria(criteria.filter((_, i) => i !== idx));
  };

  const updateCriterion = (idx: number, field: keyof Criterion, value: any) => {
    setCriteria(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const loadPackage = async (pkg: CalibrationPackage) => {
    skipAutoSave.current = true;
    setLoadedPackageId(pkg.package_id);
    setLoadedPackageName(pkg.name);
    setPackageName(pkg.name);
    setPackageDescription(pkg.description || '');
    setCriteria(pkg.criteria.length > 0 ? pkg.criteria : [{ id: 'I1', type: 'inclusion', question_text: '' }]);
    setAppraisalResults(pkg.appraisal_results || null);
    setAutoSaveStatus('idle');
  };

  const handleNewPackage = () => {
    skipAutoSave.current = true;
    setLoadedPackageId(null);
    setLoadedPackageName(null);
    setPackageName('');
    setPackageDescription('');
    setCriteria([{ id: 'I1', type: 'inclusion', question_text: '' }]);
    setAppraisalResults(null);
    setAutoSaveStatus('idle');
  };

  const handleSave = (navigateTo?: string) => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
    const name = packageName.trim() || `Criteria ${new Date().toLocaleDateString()}`;
    saveMutation.mutate(
      {
        _packageId: loadedPackageId ?? undefined,
        name,
        description: packageDescription || undefined,
        criteria,
        appraisal_results: appraisalResults || undefined,
      },
      {
        onSuccess: (saved) => {
          if (navigateTo === 'workflow') {
            setWorkflowPrefillPackageId?.(saved.package_id);
          }
          if (navigateTo) {
            setActiveTab(navigateTo);
          }
        },
      }
    );
  };

  const toggleSection = (section: keyof typeof collapsedSections) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const nonEmptyCriteria = criteria.filter(c => c.question_text.trim());

  return (
    <div className="h-full flex bg-gray-50">
      {/* Left Sidebar — Package List */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Package className="text-blue-600" size={20} />
            <h3 className="font-semibold text-gray-900">Saved Packages</h3>
          </div>
          <button
            onClick={handleNewPackage}
            className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            New Package
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {packagesLoading ? (
            <div className="flex items-center justify-center py-8 text-gray-400">
              <Loader2 className="animate-spin" size={20} />
            </div>
          ) : !packages || packages.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No saved packages yet
            </div>
          ) : (
            <div className="space-y-1">
              {packages.map((pkg: CalibrationPackage) => (
                <div
                  key={pkg.package_id}
                  className={`p-3 rounded-lg cursor-pointer transition-colors group ${
                    loadedPackageId === pkg.package_id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                  onClick={() => loadPackage(pkg)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {pkg.name}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {pkg.criteria.length} criteria
                        {pkg.appraisal_results && (
                          <span className="ml-1">
                            <Star size={10} className="inline text-yellow-500" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {pkg.updated_at
                          ? `Edited ${new Date(pkg.updated_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`
                          : new Date(pkg.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${pkg.name}"?`)) {
                          deleteMutation.mutate(pkg.package_id);
                        }
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Panel — Criteria Editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                Criteria Builder
                {loadedPackageName && (
                  <span className="text-sm font-normal text-gray-500">
                    — {loadedPackageName}
                  </span>
                )}
                {autoSaveStatus === 'pending' && (
                  <span className="text-xs font-normal text-gray-400">Saving...</span>
                )}
                {autoSaveStatus === 'saving' && (
                  <span className="text-xs font-normal text-blue-500 flex items-center gap-1">
                    <Loader2 size={11} className="animate-spin" /> Saving...
                  </span>
                )}
                {autoSaveStatus === 'saved' && (
                  <span className="text-xs font-normal text-green-600 flex items-center gap-1">
                    <CheckCircle2 size={13} /> Saved
                  </span>
                )}
                {autoSaveStatus === 'error' && (
                  <span className="text-xs font-normal text-red-500">Save failed</span>
                )}
              </h2>
              <p className="text-sm text-gray-500">
                Define inclusion and exclusion criteria for screening
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                {inclusionCriteria.length} inclusion
              </span>
              <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                {exclusionCriteria.length} exclusion
              </span>
              <HelpButton isOpen={showHelp} onToggle={() => setShowHelp(!showHelp)} />
            </div>
          </div>
        </div>

        <HelpPanel isOpen={showHelp} onToggle={() => setShowHelp(false)}>
          <h4 className="font-semibold text-sm mb-2">Criteria Builder Help</h4>
          <ul className="text-sm space-y-2 list-disc list-inside text-blue-900">
            <li><strong>Inclusion criteria</strong> define who IS eligible (e.g., "Age 18 or older"). Patients must meet ALL inclusion criteria.</li>
            <li><strong>Exclusion criteria</strong> define who is NOT eligible (e.g., "Currently pregnant"). Any match excludes the patient.</li>
            <li><strong>Criterion types:</strong> Each criterion has a type that controls LLM instructions — <em>presence</em> (yes/no), <em>extraction</em> (extract a value), <em>comparison</em> (value vs threshold), or <em>range</em> (value within bounds). Auto-detected from regex patterns.</li>
            <li><strong>Auto-save:</strong> Changes are saved automatically after a short pause. Give your package a name in the bar below — if left blank it defaults to today's date. Saved packages appear in the left sidebar and can be imported into the Workflow Builder.</li>
            <li><strong>Workflow Builder</strong> saves your criteria package and takes you straight to the Workflow Builder to run screening.</li>
          </ul>
        </HelpPanel>

        {/* Editor */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {/* Appraisal Summary (if loaded from calibration) */}
            {appraisalResults && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg">
                <button
                  onClick={() => setShowAppraisal(!showAppraisal)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <Star className="text-yellow-600" size={16} />
                    <span className="text-sm font-medium text-yellow-800">
                      AI Appraisal: {appraisalResults.overall_quality}
                    </span>
                    {appraisalResults.criteria_feedback?.length > 0 && (
                      <span className="text-xs text-yellow-600">
                        ({appraisalResults.criteria_feedback.length} issues)
                      </span>
                    )}
                  </div>
                  {showAppraisal ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                {showAppraisal && (
                  <div className="px-4 pb-4 space-y-2">
                    <p className="text-sm text-yellow-800">{appraisalResults.summary}</p>
                    {appraisalResults.criteria_feedback?.map((fb: { criterion_id: string; status: string; issue: string; suggestion: string; severity: string }, i: number) => (
                      <div key={i} className="text-xs bg-white rounded p-2 border border-yellow-200">
                        <span className="font-mono text-yellow-700">{fb.criterion_id}</span>
                        <span className={`ml-2 px-1 rounded ${
                          fb.severity === 'high' ? 'bg-red-100 text-red-700' :
                          fb.severity === 'medium' ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {fb.severity}
                        </span>
                        <p className="mt-1 text-gray-700">{fb.issue}</p>
                        <p className="text-gray-500 italic">{fb.suggestion}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Inclusion Criteria */}
            <CriteriaSection
              title="Inclusion Criteria"
              type="inclusion"
              color="green"
              criteria={inclusionCriteria}
              allCriteria={criteria}
              collapsed={collapsedSections.inclusion}
              onToggle={() => toggleSection('inclusion')}
              onAdd={() => addCriterion('inclusion')}
              onRemove={removeCriterion}
              onUpdate={updateCriterion}
            />

            {/* Exclusion Criteria */}
            <CriteriaSection
              title="Exclusion Criteria"
              type="exclusion"
              color="red"
              criteria={exclusionCriteria}
              allCriteria={criteria}
              collapsed={collapsedSections.exclusion}
              onToggle={() => toggleSection('exclusion')}
              onAdd={() => addCriterion('exclusion')}
              onRemove={removeCriterion}
              onUpdate={updateCriterion}
            />

          </div>
        </div>

        {/* Bottom Bar */}
        <div className="bg-white border-t border-gray-200 px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Package Name
              </label>
              <input
                type="text"
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="e.g., Diabetes T2DM Study Criteria"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Description (optional)
              </label>
              <input
                type="text"
                value={packageDescription}
                onChange={(e) => setPackageDescription(e.target.value)}
                placeholder="Brief description..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => handleSave('workflow')}
              disabled={nonEmptyCriteria.length === 0 || saveMutation.isPending}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
            >
              <ArrowRight size={16} />
              Workflow Builder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-components ----

function CriteriaSection({
  title,
  type,
  color,
  criteria,
  allCriteria,
  collapsed,
  onToggle,
  onAdd,
  onRemove,
  onUpdate,
}: {
  title: string;
  type: string;
  color: 'green' | 'red';
  criteria: Criterion[];
  allCriteria: Criterion[];
  collapsed: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, field: keyof Criterion, value: any) => void;
}) {
  // Regex pattern detection
  const [detectedPatterns, setDetectedPatterns] = useState<Record<string, Array<{ name: string; display_name: string; category: string }>>>({});
  const [detectingFor, setDetectingFor] = useState<string | null>(null);

  const detectPatternsFor = useCallback(async (criterionId: string, text: string, globalIdx: number) => {
    if (!text || text.length < 5) return;
    setDetectingFor(criterionId);
    try {
      const result = await regexApi.autoDetectPatterns(text);
      setDetectedPatterns(prev => ({ ...prev, [criterionId]: result.pattern_details }));
      // Auto-set criterion_type from suggestion if not already manually set
      const currentType = allCriteria[globalIdx]?.criterion_type;
      if (!currentType && result.suggested_criterion_type) {
        onUpdate(globalIdx, 'criterion_type', result.suggested_criterion_type);
      }
    } catch {
      // Silent fail for auto-detect
    } finally {
      setDetectingFor(null);
    }
  }, [allCriteria, onUpdate]);

  const colorClasses = {
    green: {
      header: 'bg-green-50 border-green-200 text-green-800',
      badge: 'bg-green-100 text-green-800',
      card: 'border-green-200',
      addBtn: 'text-green-700 bg-green-100 hover:bg-green-200',
      focus: 'focus:border-green-400 focus:ring-green-100',
    },
    red: {
      header: 'bg-red-50 border-red-200 text-red-800',
      badge: 'bg-red-100 text-red-800',
      card: 'border-red-200',
      addBtn: 'text-red-700 bg-red-100 hover:bg-red-200',
      focus: 'focus:border-red-400 focus:ring-red-100',
    },
  }[color];

  return (
    <div className={`border rounded-lg overflow-hidden ${colorClasses.card}`}>
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between border-b ${colorClasses.header}`}
      >
        <div className="flex items-center gap-2">
          <FileText size={16} />
          <span className="font-semibold text-sm">{title}</span>
          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${colorClasses.badge}`}>
            {criteria.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            className={`px-2 py-1 text-xs rounded transition-colors ${colorClasses.addBtn}`}
          >
            <Plus size={12} className="inline" /> Add
          </button>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </div>
      </button>
      {!collapsed && (
        <div className="p-4 space-y-3 bg-white">
          {criteria.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
              No {type} criteria yet. Click "Add" to create one.
            </div>
          ) : (
            criteria.map((criterion) => {
              const globalIdx = allCriteria.findIndex(c => c === criterion);
              const patterns = detectedPatterns[criterion.id];
              const cType = criterion.criterion_type || 'presence';
              const typeInfo = CRITERION_TYPES.find(t => t.value === cType) || CRITERION_TYPES[0];
              return (
                <div key={criterion.id + globalIdx} className="space-y-2">
                  <div className="flex items-start gap-3">
                    <input
                      type="text"
                      value={criterion.id}
                      onChange={(e) => onUpdate(globalIdx, 'id', e.target.value)}
                      className={`w-16 px-2 py-2 text-sm font-semibold border border-gray-300 rounded-lg ${colorClasses.focus} outline-none`}
                      placeholder={type === 'inclusion' ? 'I1' : 'E1'}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1">
                        <textarea
                          value={criterion.question_text}
                          onChange={(e) => onUpdate(globalIdx, 'question_text', e.target.value)}
                          onBlur={() => detectPatternsFor(criterion.id, criterion.question_text, globalIdx)}
                          placeholder={
                            type === 'inclusion'
                              ? 'e.g., Patient is 18 years or older'
                              : 'e.g., Currently pregnant or breastfeeding'
                          }
                          className={`flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg ${colorClasses.focus} outline-none resize-none`}
                          rows={2}
                        />
                        <button
                          onClick={() => detectPatternsFor(criterion.id, criterion.question_text, globalIdx)}
                          className="p-1.5 text-gray-400 hover:text-amber-600 transition-colors flex-shrink-0"
                          title="Detect regex patterns"
                        >
                          {detectingFor === criterion.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Search size={14} />
                          )}
                        </button>
                      </div>
                      {/* Regex pattern badges */}
                      {patterns && patterns.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {patterns.map(p => (
                            <span
                              key={p.name}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                p.category === 'medication' ? 'bg-blue-100 text-blue-700' :
                                p.category === 'diagnosis' ? 'bg-purple-100 text-purple-700' :
                                p.category === 'lab_value' ? 'bg-cyan-100 text-cyan-700' :
                                'bg-gray-100 text-gray-600'
                              }`}
                            >
                              {p.display_name}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Criterion type selector + inline inputs */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <select
                          value={cType}
                          onChange={(e) => {
                            const newType = e.target.value as Criterion['criterion_type'];
                            onUpdate(globalIdx, 'criterion_type', newType);
                            // Clear comparison/range fields when switching away
                            if (newType === 'presence' || newType === 'extraction') {
                              onUpdate(globalIdx, 'operator', undefined);
                              onUpdate(globalIdx, 'threshold', undefined);
                              onUpdate(globalIdx, 'threshold_upper', undefined);
                            }
                          }}
                          className={`px-2 py-1 text-xs font-medium border rounded-lg outline-none ${typeInfo.color}`}
                        >
                          {CRITERION_TYPES.map(t => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                        {/* Comparison: operator + threshold */}
                        {cType === 'comparison' && (
                          <>
                            <select
                              value={criterion.operator || '>='}
                              onChange={(e) => onUpdate(globalIdx, 'operator', e.target.value)}
                              className="w-16 px-1.5 py-1 text-xs border border-gray-300 rounded-lg outline-none"
                            >
                              {OPERATORS.filter(op => op.value !== 'between').map(op => (
                                <option key={op.value} value={op.value}>{op.label}</option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={criterion.threshold ?? ''}
                              onChange={(e) => onUpdate(globalIdx, 'threshold', e.target.value ? Number(e.target.value) : undefined)}
                              className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none"
                              placeholder="Value"
                            />
                          </>
                        )}
                        {/* Range: min – max */}
                        {cType === 'range' && (
                          <>
                            <input
                              type="number"
                              value={criterion.threshold ?? ''}
                              onChange={(e) => onUpdate(globalIdx, 'threshold', e.target.value ? Number(e.target.value) : undefined)}
                              className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none"
                              placeholder="Min"
                            />
                            <span className="text-xs text-gray-400">to</span>
                            <input
                              type="number"
                              value={criterion.threshold_upper ?? ''}
                              onChange={(e) => onUpdate(globalIdx, 'threshold_upper', e.target.value ? Number(e.target.value) : undefined)}
                              className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-lg outline-none"
                              placeholder="Max"
                            />
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => onRemove(globalIdx)}
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
