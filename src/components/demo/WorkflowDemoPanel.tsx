import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle, ClipboardList, FileText, Play, RefreshCw, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { jobsApi, uploadApi } from '../../api/client';
import { demoCriteria, demoPackage } from '../../data/demoData';

type Tab = string;

export default function WorkflowDemoPanel({
  setActiveTab,
  onJobStarted,
}: {
  setActiveTab: (tab: Tab) => void;
  onJobStarted: (jobId: string) => void;
}) {
  const [fileName] = useState('sonar-dkd-demo-cohort.csv');
  const [fileId, setFileId] = useState<string | null>(null);
  const [numRecords, setNumRecords] = useState<number | null>(null);
  const [phiStats, setPhiStats] = useState<{
    total_phi_found: number;
    records_with_phi: number;
    phi_types: Record<string, number>;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [strategy, setStrategy] = useState<'one_at_a_time' | 'all_at_once'>('one_at_a_time');

  useEffect(() => {
    let cancelled = false;

    async function loadDemoCohort() {
      setUploading(true);
      setUploadError('');
      try {
        const result = await uploadApi.ingest([], 'csv');
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
  }, []);

  const submitMutation = useMutation({
    mutationFn: () => {
      const timestamp = new Date().toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });

      return jobsApi.submit({
        name: `${demoPackage.name} - ${timestamp}`,
        uploaded_file_id: fileId!,
        criteria: demoCriteria,
        workflow_config: {
          prompt: { preset: strategy === 'all_at_once' ? 'clinical_trial_all' : 'clinical_trial_single' },
          models: [{ provider: 'demo_engine', model: 'sonar-scripted-demo' }],
          screening_strategy: 'single',
          criteria_mode: strategy,
          aggregation: { mode: 'majority_vote' },
          regex_pre_screen: true,
          regex_confidence_threshold: 'High',
          id_column: 'id',
          content_column: 'note',
        },
      });
    },
    onSuccess: (job) => {
      toast.success('Screening started');
      onJobStarted(job.job_id);
      setActiveTab('results');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Submission failed');
    },
  });

  const canSubmit = !!fileId && !uploading;
  const inclusionCriteria = demoCriteria.filter((criterion) => criterion.type === 'inclusion');
  const exclusionCriteria = demoCriteria.filter((criterion) => criterion.type === 'exclusion');

  return (
    <div className="h-full flex flex-col bg-gray-50 overflow-auto">
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-8 sm:py-5">
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Workflow Builder</h2>
        <p className="text-xs text-gray-500 mt-0.5 sm:text-sm">
          Review the patient cohort, confirm the SONAR criteria package, choose a screening mode, then run screening.
        </p>
      </div>

      <div className="flex-1 p-4 sm:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6 h-full" style={{ minHeight: 480 }}>
          <div>
          <StepCard step={1} icon={<FileText size={20} />} title="Patient Data" color="blue" done={!!fileId}>
            <div className="space-y-4">
              <div className="p-4 rounded-xl border-2 border-dashed border-blue-200 bg-blue-50/60 min-h-36 flex items-center justify-center">
                {uploading ? (
                  <div className="flex flex-col items-center text-center">
                    <RefreshCw size={28} className="text-blue-500 animate-spin mb-2" />
                    <p className="text-sm text-gray-600">Loading patient cohort...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-center">
                    <CheckCircle size={28} className="text-green-500 mb-2" />
                    <p className="text-sm font-semibold text-gray-800">{fileName}</p>
                    <p className="text-xs text-green-700 mt-1">{numRecords?.toLocaleString()} synthetic records loaded automatically</p>
                  </div>
                )}
              </div>

              {phiStats && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-sm font-medium text-amber-900">De-identification complete</p>
                  <p className="text-xs text-amber-700 mt-1">
                    {phiStats.total_phi_found} PHI terms removed across {phiStats.records_with_phi} records
                  </p>
                </div>
              )}

              {uploadError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                  {uploadError}
                </div>
              )}
            </div>
          </StepCard>
          </div>

          <div className="md:col-span-2 xl:col-span-1">
          <StepCard step={2} icon={<ClipboardList size={20} />} title="SONAR Criteria" color="green" done={true}>
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Criteria Package</p>
                <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                  {demoPackage.name}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                  {inclusionCriteria.length} inclusion
                </span>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                  {exclusionCriteria.length} exclusion
                </span>
              </div>
              <div className="max-h-64 sm:max-h-72 overflow-auto space-y-1.5 pr-1">
                {demoCriteria.map((criterion) => (
                  <div
                    key={criterion.id}
                    className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <span
                      className={`mt-0.5 flex-shrink-0 w-2 h-2 rounded-full ${
                        criterion.type === 'inclusion' ? 'bg-green-500' : 'bg-red-400'
                      }`}
                    />
                    <div>
                      <div className="text-[11px] font-semibold text-gray-500">{criterion.id}</div>
                      <span className="text-xs text-gray-700 leading-snug">{criterion.question_text}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </StepCard>
          </div>

          <div>
          <StepCard step={3} icon={<SlidersHorizontal size={20} />} title="Mode of Screening" color="orange" done={true}>
            <p className="text-xs text-gray-500 mb-4">
              Choose how the workflow evaluates the SONAR criteria against each patient record.
            </p>
            <div className="space-y-2">
              {[
                {
                  id: 'one_at_a_time' as const,
                  label: 'One at a Time',
                  desc: 'Each criterion is evaluated separately. Recommended default workflow.',
                },
                {
                  id: 'all_at_once' as const,
                  label: 'All at Once',
                  desc: 'All criteria are evaluated in one pass for faster screening.',
                },
              ].map(({ id, label, desc }) => (
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
        </div>

        <div className="sticky bottom-0 mt-6 sm:mt-8 flex flex-col items-center gap-3 bg-gradient-to-t from-gray-50 via-gray-50 to-transparent pt-4 pb-2">
          <button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className={`w-full sm:w-auto px-8 sm:px-12 py-3.5 rounded-xl text-base font-semibold flex items-center justify-center gap-3 transition-all shadow-sm ${
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
              Waiting for the patient cohort to finish loading
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

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
  color: 'blue' | 'green' | 'orange';
  done: boolean;
  children: React.ReactNode;
}) {
  const accent = {
    blue: { border: 'border-blue-500', badge: 'bg-blue-600', light: 'bg-blue-50' },
    green: { border: 'border-green-500', badge: 'bg-green-600', light: 'bg-green-50' },
    orange: { border: 'border-orange-400', badge: 'bg-orange-500', light: 'bg-orange-50' },
  }[color];

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
      <div className={`${accent.light} border-b ${accent.border} border-opacity-30 px-4 py-3 sm:px-6 sm:py-4 flex items-center gap-3`}>
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
      <div className="flex-1 p-4 sm:p-6 overflow-auto">{children}</div>
    </div>
  );
}
