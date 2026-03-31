import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  uploadApi,
  calibrationApi,
  jobsApi,
} from '../../api/client';
import type { Criterion, CalibrationPackage } from '../../types';
import { CheckCircle, AlertCircle, RefreshCw, Play, FileText, ClipboardList, Cpu, ChevronRight, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { DEMO_PACKAGE_ID } from '../../data/demoData';

type Tab = string;

export default function SimpleWorkflowPanel({
  setActiveTab,
  prefilledPackageId,
  onPrefillConsumed,
}: {
  setActiveTab: (tab: Tab) => void;
  prefilledPackageId?: string | null;
  onPrefillConsumed?: () => void;
}) {
  // ── Step 1: Data ─────────────────────────────────────────────────────────
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState('auto');
  const [fileId, setFileId] = useState<string | null>(null);
  const [numRecords, setNumRecords] = useState<number | null>(null);
  const [phiStats, setPhiStats] = useState<{
    total_phi_found: number;
    records_with_phi: number;
    phi_types: Record<string, number>;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // ── Step 2: Criteria ──────────────────────────────────────────────────────
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedCriteria, setSelectedCriteria] = useState<Criterion[]>([]);

  // ── Screening Strategy ────────────────────────────────────────────────────
  const [strategy, setStrategy] = useState<'one_at_a_time' | 'all_at_once' | 'react' | 'reflexion'>('one_at_a_time');

  // ── Criteria packages ─────────────────────────────────────────────────────
  const { data: packages = [] } = useQuery<CalibrationPackage[]>({
    queryKey: ['calibration-packages'],
    queryFn: () => calibrationApi.listPackages(),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!prefilledPackageId) return;
    setSelectedPackageId(prefilledPackageId);
    onPrefillConsumed?.();
  }, [prefilledPackageId, onPrefillConsumed]);

  useEffect(() => {
    if (selectedPackageId || packages.length === 0) return;
    const demoPackage = packages.find((pkg) => pkg.package_id === DEMO_PACKAGE_ID);
    if (demoPackage) {
      setSelectedPackageId(demoPackage.package_id);
    }
  }, [packages, selectedPackageId]);

  useEffect(() => {
    if (fileId || uploading) return;

    let cancelled = false;

    async function loadDemoCohort() {
      setFile(new File(['conference-demo'], 'sonar-dkd-demo-cohort.csv', { type: 'text/csv' }));
      setUploadError('');
      setUploading(true);
      try {
        const result = await uploadApi.ingest([], format) as any;
        if (cancelled) return;
        setFileId(result.file_id);
        setNumRecords(result.num_records);
        setPhiStats(result.deidentification_stats ?? null);
      } catch (err: any) {
        if (cancelled) return;
        setUploadError(err?.response?.data?.detail || 'Auto-load failed');
      } finally {
        if (!cancelled) {
          setUploading(false);
        }
      }
    }

    void loadDemoCohort();

    return () => {
      cancelled = true;
    };
  }, [fileId, format, uploading]);

  // Load criteria when package is selected
  useEffect(() => {
    if (!selectedPackageId) {
      setSelectedCriteria([]);
      return;
    }
    const pkg = packages.find((p) => p.package_id === selectedPackageId);
    if (pkg) setSelectedCriteria(pkg.criteria);
  }, [selectedPackageId, packages]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  // ── Submit ────────────────────────────────────────────────────────────────
  const STRATEGY_CONFIG = {
    one_at_a_time: { preset: 'clinical_trial_single', criteria_mode: 'one_at_a_time' },
    all_at_once:   { preset: 'clinical_trial_all',    criteria_mode: 'all_at_once'   },
    react:         { preset: 'react',                 criteria_mode: 'one_at_a_time' },
    reflexion:     { preset: 'reflexion',             criteria_mode: 'one_at_a_time' },
  } as const;

  const submitMutation = useMutation({
    mutationFn: () => {
      const selectedPackage = packages.find((p) => p.package_id === selectedPackageId);
      const firstCriterionTitle = selectedCriteria
        .map((c) => (c.question_text || '').trim())
        .find((q) => q.length > 0);
      const baseName = (
        selectedPackage?.name
        || firstCriterionTitle
        || 'Criteria Run'
      ).trim().slice(0, 80) || 'Criteria Run';
      const timestamp = new Date().toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      const sc = STRATEGY_CONFIG[strategy];

      return jobsApi.submit({
        name: `${baseName} - ${timestamp}`,
        uploaded_file_id: fileId!,
        criteria: selectedCriteria,
        workflow_config: {
          prompt: { preset: sc.preset },
          models: [{ provider: 'demo_engine', model: 'sonar-scripted-demo' }],
          screening_strategy: 'single',
          criteria_mode: sc.criteria_mode,
          aggregation: { mode: 'majority_vote' },
          regex_pre_screen: true,
          regex_confidence_threshold: 'High',
          id_column: 'id',
          content_column: 'note',
        },
      });
    },
    onSuccess: () => {
      toast.success('Job submitted — switch to the Jobs tab to monitor progress');
      setActiveTab('jobs');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Submission failed');
    },
  });

  // ── Validation ────────────────────────────────────────────────────────────
  const step1Done = !!fileId;
  const step2Done = selectedCriteria.length > 0;
  const step3Done = true;
  const canSubmit = step1Done && step2Done;

  const inclusionCount = selectedCriteria.filter((c) => c.type === 'inclusion').length;
  const exclusionCount = selectedCriteria.filter((c) => c.type === 'exclusion').length;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-auto">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <h2 className="text-2xl font-bold text-gray-900">Workflow Builder</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure your screening run in three steps, then submit.
        </p>
        <p className="text-xs text-blue-600 mt-2">
          Conference demo mode is using a local SONAR-inspired study package, synthetic cohort, and scripted results.
        </p>
      </div>

      {/* Three-column form */}
      <div className="flex-1 p-8">
        <div className="grid grid-cols-4 gap-6 h-full" style={{ minHeight: 480 }}>

          {/* ── Column 1: Patient Data ─────────────────────────────────── */}
          <StepCard
            step={1}
            icon={<FileText size={20} />}
            title="Patient Data"
            color="blue"
            done={step1Done}
          >
            {/* Format */}
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 mb-4"
            >
              <option value="auto">Auto-detect</option>
              <option value="csv">CSV</option>
              <option value="excel">Excel</option>
              <option value="pdf">PDF</option>
              <option value="fhir">FHIR R4</option>
              <option value="hl7v2">HL7v2</option>
              <option value="ccda">C-CDA</option>
            </select>

            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Demo Cohort
            </label>
            <div className="flex flex-col items-center justify-center w-full border-2 border-dashed border-gray-200 rounded-xl p-6 bg-blue-50/40">
              {uploading ? (
                <>
                  <RefreshCw size={28} className="text-blue-400 animate-spin mb-2" />
                  <span className="text-sm text-gray-500">Auto-loading SONAR sample data…</span>
                </>
              ) : fileId ? (
                <>
                  <CheckCircle size={28} className="text-green-500 mb-2" />
                  <span className="text-sm font-semibold text-gray-800">{file?.name}</span>
                  <span className="text-xs text-green-600 mt-1">{numRecords?.toLocaleString()} records loaded</span>
                  {phiStats !== null && (
                    <span className="text-xs text-amber-700 mt-1">
                      Deidentification complete
                      {phiStats.total_phi_found > 0 ? ` — ${phiStats.total_phi_found} PHI terms removed` : ''}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 mt-1">Preloaded automatically for the conference demo</span>
                </>
              ) : (
                <>
                  <RefreshCw size={28} className="text-gray-300 mb-2" />
                  <span className="text-sm text-gray-500">Preparing synthetic SONAR cohort…</span>
                </>
              )}
            </div>

            {uploadError && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{uploadError}</p>
              </div>
            )}
          </StepCard>

          {/* ── Column 2: Criteria ─────────────────────────────────────── */}
          <StepCard
            step={2}
            icon={<ClipboardList size={20} />}
            title="Screening Criteria"
            color="green"
            done={step2Done}
          >
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Criteria Package
            </label>

            {packages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ClipboardList size={36} className="text-gray-200 mb-3" />
                <p className="text-sm text-gray-500 mb-3">No saved packages yet.</p>
                <button
                  onClick={() => setActiveTab('criteria')}
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  Build criteria first
                  <ChevronRight size={14} />
                </button>
              </div>
            ) : (
              <>
                <select
                  value={selectedPackageId}
                  onChange={(e) => setSelectedPackageId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-400 mb-4"
                >
                  <option value="">Select a package…</option>
                  {packages.map((p) => (
                    <option key={p.package_id} value={p.package_id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {selectedCriteria.length > 0 && (
                  <div className="space-y-3">
                    {/* Summary pills */}
                    <div className="flex gap-2 flex-wrap">
                      {inclusionCount > 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          {inclusionCount} inclusion{inclusionCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {exclusionCount > 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                          {exclusionCount} exclusion{exclusionCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Criteria list preview */}
                    <div className="max-h-52 overflow-auto space-y-1.5 pr-1">
                      {selectedCriteria.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                        >
                          <span
                            className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${
                              c.type === 'inclusion' ? 'bg-green-500' : 'bg-red-400'
                            }`}
                          />
                          <span className="text-xs text-gray-700 leading-snug">{c.question_text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </StepCard>

          {/* ── Column 3: Demo Mode ────────────────────────────────────── */}
          <StepCard
            step={3}
            icon={<Cpu size={20} />}
            title="Demo Mode"
            color="purple"
            done={step3Done}
          >
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-purple-50 border border-purple-200">
                <p className="text-sm font-semibold text-purple-900">Fully local demo engine</p>
                <p className="text-xs text-purple-700 mt-1">
                  This conference build does not call Azure or any external model endpoint. The screening run is scripted locally.
                </p>
              </div>
              <div className="space-y-2">
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Study</p>
                  <p className="text-sm text-gray-800">SONAR-style diabetic kidney disease screening</p>
                </div>
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Execution</p>
                  <p className="text-sm text-gray-800">Deterministic fake results with timed progress updates</p>
                </div>
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Deployment</p>
                  <p className="text-sm text-gray-800">Safe for Vercel and offline-style booth demos</p>
                </div>
              </div>
            </div>
          </StepCard>

          {/* ── Column 4: Strategy ─────────────────────────────────────── */}
          <StepCard
            step={4}
            icon={<SlidersHorizontal size={20} />}
            title="Strategy"
            color="orange"
            done={false}
          >
            <p className="text-xs text-gray-500 mb-4">
              Choose how the AI evaluates criteria against each patient record.
            </p>
            <div className="space-y-2">
              {(
                [
                  { id: 'one_at_a_time', label: 'One at a Time',  desc: 'Each criterion evaluated separately. Most accurate.' },
                  { id: 'all_at_once',   label: 'All at Once',    desc: 'All criteria in one prompt. Faster for large cohorts.' },
                  { id: 'react',         label: 'ReAct',          desc: 'Reasoning + acting loop. Best for complex criteria.' },
                  { id: 'reflexion',     label: 'Reflexion',      desc: 'Self-reflection pass. Highest accuracy, slower.' },
                ] as const
              ).map(({ id, label, desc }) => (
                <button
                  key={id}
                  onClick={() => setStrategy(id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    strategy === id
                      ? 'border-orange-400 bg-orange-50'
                      : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-sm font-semibold ${strategy === id ? 'text-orange-700' : 'text-gray-800'}`}>
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
                </button>
              ))}
            </div>
          </StepCard>
        </div>

        {/* Submit button */}
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className={`px-12 py-3.5 rounded-xl text-base font-semibold flex items-center gap-3 transition-all shadow-sm ${
              canSubmit && !submitMutation.isPending
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:shadow-md'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {submitMutation.isPending ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <Play size={18} />
            )}
            {submitMutation.isPending ? 'Submitting…' : 'Run Screening'}
          </button>

          {!canSubmit && (
            <p className="text-xs text-gray-400">
              Complete all three steps to run screening
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Shared sub-components ───────────────────────────────────────────────────

function StepCard({
  step,
  icon,
  title,
  color,
  done,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
  done: boolean;
  children: React.ReactNode;
}) {
  const accent = {
    blue:   { border: 'border-blue-500',   badge: 'bg-blue-600',   light: 'bg-blue-50' },
    green:  { border: 'border-green-500',  badge: 'bg-green-600',  light: 'bg-green-50' },
    purple: { border: 'border-purple-500', badge: 'bg-purple-600', light: 'bg-purple-50' },
    orange: { border: 'border-orange-400', badge: 'bg-orange-500', light: 'bg-orange-50' },
  }[color];

  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden`}>
      {/* Card header */}
      <div className={`${accent.light} border-b ${accent.border} border-opacity-30 px-6 py-4 flex items-center gap-3`}>
        <div className={`${accent.badge} text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}>
          {done ? <CheckCircle size={14} /> : step}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{icon}</span>
          <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
        </div>
        {done && (
          <span className="ml-auto text-xs font-medium text-green-600 flex items-center gap-1">
            <CheckCircle size={12} />
            Ready
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="flex-1 p-6 overflow-auto">
        {children}
      </div>
    </div>
  );
}
