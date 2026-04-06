import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle, ClipboardList, FileText, Play, RefreshCw, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { jobsApi, uploadApi } from '../../api/client';
import { demoCriteria, demoPackage, DEMO_STUDY_URL } from '../../data/demoData';

type Tab = string;
type Strategy = 'one_at_a_time' | 'all_at_once';
type FlowCriterion = {
  id: string;
  label: string;
  type: 'inclusion' | 'exclusion';
  result: 'pass' | 'exclude';
  evidence: string;
};

const FLOW_PREVIEW_NOTE = '62-year-old with type 2 diabetes on metformin and losartan. eGFR 48 mL/min/1.73 m2, UACR 110 mg/mmol. Hospitalized for unstable angina 6 weeks ago.';

const FLOW_PREVIEW_CRITERIA: FlowCriterion[] = [
  {
    id: 'I1',
    label: 'Age 18 to 85',
    type: 'inclusion',
    result: 'pass',
    evidence: 'Age 62 documented in the note.',
  },
  {
    id: 'I2',
    label: 'eGFR and UACR in range',
    type: 'inclusion',
    result: 'pass',
    evidence: 'eGFR 48 and UACR 110 mg/mmol match the range.',
  },
  {
    id: 'I3',
    label: 'Type 2 diabetes plus treatment',
    type: 'inclusion',
    result: 'pass',
    evidence: 'Type 2 diabetes with metformin and losartan is present.',
  },
  {
    id: 'E7',
    label: 'Recent CAD or CVD event',
    type: 'exclusion',
    result: 'exclude',
    evidence: 'Recent unstable angina within 3 months triggers exclusion.',
  },
];

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
  const [strategy, setStrategy] = useState<Strategy>('one_at_a_time');

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
                <div className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white space-y-1">
                  <div>{demoPackage.name}</div>
                  <a
                    href={DEMO_STUDY_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-xs text-blue-700 hover:text-blue-800 underline underline-offset-2"
                  >
                    ClinicalTrials.gov: NCT01858532
                  </a>
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
                      className={`mt-0.5 inline-block h-2 w-2 flex-shrink-0 rounded-full ${
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

          <div className="md:col-span-2 xl:col-span-1">
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
            <ModeFlowPreview strategy={strategy} />
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

function ModeFlowPreview({
  strategy,
}: {
  strategy: Strategy;
}) {
  const [animationStep, setAnimationStep] = useState(0);
  const [replayKey, setReplayKey] = useState(0);

  useEffect(() => {
    setAnimationStep(0);

    const maxStep = strategy === 'one_at_a_time'
      ? FLOW_PREVIEW_CRITERIA.length + 1
      : 3;
    const delayPerStep = strategy === 'one_at_a_time' ? 700 : 950;
    const timers: Array<ReturnType<typeof setTimeout>> = [];

    for (let step = 1; step <= maxStep; step += 1) {
      timers.push(setTimeout(() => setAnimationStep(step), step * delayPerStep));
    }

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [strategy, replayKey]);

  const hiddenCriteriaCount = Math.max(0, demoCriteria.length - FLOW_PREVIEW_CRITERIA.length);

  return (
    <div className="mt-4 rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-orange-700/80">
            How This Mode Flows
          </p>
          <h4 className="mt-1 text-sm font-semibold text-gray-900">
            {strategy === 'one_at_a_time'
              ? 'Each criterion becomes its own prompt'
              : 'The full criteria set is evaluated in one prompt'}
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            {strategy === 'one_at_a_time'
              ? 'This view emphasizes an auditable criterion-by-criterion trail before aggregation.'
              : 'This view emphasizes a bundled prompt, one model pass, and one combined response.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setReplayKey((current) => current + 1)}
          className="inline-flex items-center justify-center gap-2 rounded-full border border-orange-200 bg-white px-3 py-1.5 text-xs font-medium text-orange-700 transition-colors hover:bg-orange-50"
        >
          <RefreshCw size={13} />
          Replay
        </button>
      </div>

      <div className="mt-3 rounded-xl border border-blue-100 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">
            Sample Patient Note
          </p>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
            Demo
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-gray-600">
          {FLOW_PREVIEW_NOTE}
        </p>
      </div>

      {strategy === 'one_at_a_time' ? (
        <OneAtATimeFlowPreview animationStep={animationStep} />
      ) : (
        <AllAtOnceFlowPreview animationStep={animationStep} hiddenCriteriaCount={hiddenCriteriaCount} />
      )}

    </div>
  );
}

function OneAtATimeFlowPreview({
  animationStep,
}: {
  animationStep: number;
}) {
  const resolvedCount = Math.min(animationStep, FLOW_PREVIEW_CRITERIA.length);
  const isAggregating = animationStep === FLOW_PREVIEW_CRITERIA.length;
  const isComplete = animationStep > FLOW_PREVIEW_CRITERIA.length;
  const activeCriterion = !isAggregating && !isComplete
    ? FLOW_PREVIEW_CRITERIA[resolvedCount]
    : null;

  let statusText = `Prompt 1 of ${FLOW_PREVIEW_CRITERIA.length}: evaluating ${FLOW_PREVIEW_CRITERIA[0].id}.`;
  if (activeCriterion) {
    statusText = `Prompt ${resolvedCount + 1} of ${FLOW_PREVIEW_CRITERIA.length}: evaluating ${activeCriterion.id}.`;
  }
  if (isAggregating) {
    statusText = 'Representative checks are complete. Aggregating answers into a final screening decision.';
  }
  if (isComplete) {
    statusText = 'E7 triggers exclusion, so the patient record is routed out after the per-criterion pass.';
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-orange-100 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-gray-900">Prompt Sequence</p>
            <p className="mt-1 text-[11px] text-gray-500">
              One criterion enters the model at a time, then the answers are aggregated.
            </p>
          </div>
          <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-semibold text-orange-700">
            {isComplete ? 'Decision ready' : isAggregating ? 'Aggregating' : `Prompt ${resolvedCount + 1}`}
          </span>
        </div>

        <div className="mt-3 space-y-2">
          {FLOW_PREVIEW_CRITERIA.map((criterion, index) => {
            let state: 'queued' | 'checking' | 'pass' | 'exclude' = 'queued';
            if (index < resolvedCount) {
              state = criterion.result;
            } else if (index === resolvedCount && !isAggregating && !isComplete) {
              state = 'checking';
            }

            const detail = state === 'queued'
              ? 'Waiting in the queue.'
              : state === 'checking'
                ? 'Scanning the patient note for supporting evidence.'
                : criterion.evidence;

            return (
              <FlowCriterionCard
                key={criterion.id}
                criterion={criterion}
                state={state}
                detail={detail}
              />
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <p className="text-xs font-semibold text-gray-900">Engine Status</p>
        <p className="mt-1 text-sm leading-relaxed text-gray-700">
          {statusText}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Final Decision</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">
              {isComplete ? 'Exclude' : isAggregating ? 'Compiling decision...' : 'Pending'}
            </p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            isComplete
              ? 'bg-red-100 text-red-700'
              : 'bg-gray-100 text-gray-500'
          }`}>
            {isComplete ? 'E7 triggered' : 'Awaiting final pass'}
          </span>
        </div>
      </div>
    </div>
  );
}

function AllAtOnceFlowPreview({
  animationStep,
  hiddenCriteriaCount,
}: {
  animationStep: number;
  hiddenCriteriaCount: number;
}) {
  const promptBuilt = animationStep >= 1;
  const answersReady = animationStep >= 2;
  const decisionReady = animationStep >= 3;

  return (
    <div className="mt-3 space-y-3">
      <FlowStageCard
        title="1. Build One Prompt"
        subtitle="The note and the criteria package are bundled together before the model runs."
        state={promptBuilt ? 'done' : 'active'}
      >
        <div className="flex flex-wrap gap-2">
          {FLOW_PREVIEW_CRITERIA.map((criterion) => (
            <span
              key={criterion.id}
              className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                criterion.type === 'inclusion'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {criterion.id} {criterion.label}
            </span>
          ))}
          {hiddenCriteriaCount > 0 && (
            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-600">
              +{hiddenCriteriaCount} more criteria
            </span>
          )}
        </div>
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
          1 prompt • {demoCriteria.length} criteria • 1 model response
        </div>
      </FlowStageCard>

      <FlowStageCard
        title="2. Return Structured Answers"
        subtitle="The model responds with one block of criterion answers instead of four separate passes."
        state={answersReady ? 'done' : promptBuilt ? 'active' : 'pending'}
      >
        <div className="space-y-2">
          {FLOW_PREVIEW_CRITERIA.map((criterion) => (
            <FlowCriterionCard
              key={criterion.id}
              criterion={criterion}
              state={answersReady ? criterion.result : promptBuilt ? 'checking' : 'queued'}
              detail={answersReady ? criterion.evidence : promptBuilt ? 'Waiting for the combined response.' : 'Not evaluated yet.'}
            />
          ))}
        </div>
      </FlowStageCard>

      <FlowStageCard
        title="3. Final Decision"
        subtitle="The combined response is turned into one screening outcome."
        state={decisionReady ? 'done' : answersReady ? 'active' : 'pending'}
      >
        <div className={`rounded-xl border px-3 py-3 transition-colors ${
          decisionReady
            ? 'border-red-200 bg-red-50'
            : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Outcome</p>
              <p className="mt-1 text-sm font-semibold text-gray-900">
                {decisionReady ? 'Exclude' : answersReady ? 'Resolving final output...' : 'Pending'}
              </p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              decisionReady
                ? 'bg-red-100 text-red-700'
                : 'bg-gray-100 text-gray-500'
            }`}>
              {decisionReady ? 'Recent unstable angina -> E7' : 'Awaiting model output'}
            </span>
          </div>
        </div>
      </FlowStageCard>
    </div>
  );
}

function FlowStageCard({
  title,
  subtitle,
  state,
  children,
}: {
  title: string;
  subtitle: string;
  state: 'pending' | 'active' | 'done';
  children: React.ReactNode;
}) {
  const palette = state === 'done'
    ? {
        border: 'border-blue-200',
        bg: 'bg-blue-50/70',
        badge: 'bg-blue-100 text-blue-700',
      }
    : state === 'active'
      ? {
          border: 'border-orange-200',
          bg: 'bg-orange-50/80',
          badge: 'bg-orange-100 text-orange-700',
        }
      : {
          border: 'border-gray-200',
          bg: 'bg-white',
          badge: 'bg-gray-100 text-gray-500',
        };

  return (
    <div className={`rounded-xl border p-3 shadow-sm transition-colors ${palette.border} ${palette.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-gray-900">{title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-gray-600">{subtitle}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${palette.badge}`}>
          {state === 'done' ? 'Done' : state === 'active' ? 'Active' : 'Pending'}
        </span>
      </div>
      <div className="mt-3">
        {children}
      </div>
    </div>
  );
}

function FlowCriterionCard({
  criterion,
  state,
  detail,
}: {
  criterion: FlowCriterion;
  state: 'queued' | 'checking' | 'pass' | 'exclude';
  detail: string;
}) {
  const palette = state === 'queued'
    ? {
        border: 'border-gray-200',
        bg: 'bg-white',
        badge: 'bg-gray-100 text-gray-500',
        dot: 'bg-gray-300',
      }
    : state === 'checking'
      ? {
          border: 'border-orange-200',
          bg: 'bg-orange-50/80',
          badge: 'bg-orange-100 text-orange-700',
          dot: 'bg-orange-400',
        }
      : state === 'pass'
        ? {
            border: 'border-green-200',
            bg: 'bg-green-50/80',
            badge: 'bg-green-100 text-green-700',
            dot: 'bg-green-500',
          }
        : {
            border: 'border-red-200',
            bg: 'bg-red-50/80',
            badge: 'bg-red-100 text-red-700',
            dot: 'bg-red-400',
          };

  const label = state === 'queued'
    ? 'Queued'
    : state === 'checking'
      ? 'Checking'
      : state === 'pass'
        ? 'Pass'
        : 'Exclude';

  return (
    <div className={`rounded-xl border p-3 shadow-sm transition-all duration-500 ${palette.border} ${palette.bg}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${palette.dot}`} />
            <span className="text-[11px] font-semibold text-gray-500">{criterion.id}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              criterion.type === 'inclusion'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {criterion.type === 'inclusion' ? 'Inclusion' : 'Exclusion'}
            </span>
          </div>
          <p className="mt-2 text-sm font-medium leading-snug text-gray-800">
            {criterion.label}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">
            {detail}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${palette.badge}`}>
          {label}
        </span>
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
