import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '../../api/client';
import type { Job } from '../../types';
import { Download, RefreshCw, CheckCircle, Clock, AlertCircle, XCircle, BarChart2, ChevronDown, ChevronUp } from 'lucide-react';
import { HelpButton, HelpPanel } from '../ui/HelpPanel';
import {
  confidenceDisplayLabel,
  decisionDisplayLabel,
  normalizeConfidence,
  normalizeDecision,
} from '../../utils/resultLabels';

function formatSubmittedAt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

interface ResultRow {
  patient_id: string;
  decision: string;
  confidence: string;
  source?: string;
  inclusion_met?: number;
  inclusion_total?: number;
  exclusion_triggered?: number;
  exclusion_total?: number;
}

interface ResultsData {
  results: ResultRow[];
  summary: {
    total: number;
    included: number;
    excluded: number;
    review: number;
  };
  is_partial?: boolean;
  inclusion_total?: number;
  exclusion_total?: number;
}

interface ResultsPanelProps {
  focusedJobId?: string | null;
  onFocusCleared?: () => void;
}

export default function ResultsPanel({ focusedJobId, onFocusCleared }: ResultsPanelProps = {}) {
  const queryClient = useQueryClient();
  const [showHelp, setShowHelp] = useState(false);

  const { data: jobsData } = useQuery({
    queryKey: ['results-panel-jobs'],
    queryFn: () => jobsApi.list({ limit: 50 }),
    refetchInterval: 5000,
  });

  const jobs = jobsData?.jobs || [];
  const jobsWithResults = jobs.filter((j: Job) => (
    j.status === 'running'
    || j.status === 'interrupted'
    || j.status === 'failed'
    || j.status === 'cancelled'
    || j.status === 'completed'
    || j.records_processed > 0
  ));

  const handleDownload = async (jobId: string, jobName: string) => {
    try {
      const blob = await jobsApi.download(jobId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (jobName || 'job').replace(/[<>:"/\\|?*\x00-\x1F]+/g, '_').trim() || 'job';
      a.download = `${safeName}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      alert('Failed to download results');
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Screening Results</h2>
            <p className="text-xs text-gray-500 sm:text-sm">Results stream in automatically as patients are screened</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['results-panel-jobs'] })}
              className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <HelpButton isOpen={showHelp} onToggle={() => setShowHelp(!showHelp)} />
          </div>
        </div>
      </div>

      <HelpPanel isOpen={showHelp} onToggle={() => setShowHelp(false)}>
        <h4 className="font-semibold text-sm mb-2">Results Help</h4>
        <ul className="text-sm space-y-2 list-disc list-inside text-blue-900">
          <li>Results appear here as soon as the first patient is screened.</li>
          <li>The <strong>Live</strong> badge means the job is still running and results are updating every few seconds.</li>
          <li><strong>Download CSVs</strong> is available during runs and gives a ZIP with summary decisions and per-criterion answers.</li>
        </ul>
      </HelpPanel>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {jobsWithResults.length === 0 ? (
          <EmptyResultsState />
        ) : (
          <div className="space-y-6">
            {jobsWithResults.map((job: Job) => (
              <ResultCard
                key={job.job_id}
                job={job}
                isFocused={focusedJobId === job.job_id}
                onFocusCleared={onFocusCleared}
                onDownload={() => handleDownload(job.job_id, job.name)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultCard({
  job,
  onDownload,
  isFocused,
  onFocusCleared,
}: {
  job: Job;
  onDownload: () => void;
  isFocused?: boolean;
  onFocusCleared?: () => void;
}) {
  const isActive = job.status === 'running';
  const [collapsed, setCollapsed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // When focused from Jobs tab: expand and scroll into view
  useEffect(() => {
    if (isFocused) {
      setCollapsed(false);
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      onFocusCleared?.();
    }
  }, [isFocused]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: resultsData, isLoading } = useQuery<ResultsData>({
    queryKey: ['results', job.job_id],
    queryFn: () => jobsApi.getResults(job.job_id),
    refetchInterval: isActive ? 5000 : false,
    staleTime: isActive ? 0 : 60_000,
  });

  // Derive totals — response-level fields are available immediately (even before first row)
  const inclusionTotal = resultsData?.inclusion_total ?? 0;
  const exclusionTotal = resultsData?.exclusion_total ?? 0;
  const hasCriteriaCounts = inclusionTotal > 0 || exclusionTotal > 0;
  const displayedResults = resultsData?.results ?? [];

  return (
    <div ref={cardRef} className="bg-white rounded-lg border border-gray-200">
      {/* Card header — click to collapse/expand */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 text-left hover:bg-gray-50 transition-colors rounded-t-lg"
      >
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">{job.name}</h3>
            <p className="text-xs text-gray-500">Submitted {formatSubmittedAt(job.created_at)}</p>
          </div>
          <StatusBadge status={job.status} />
          {resultsData?.is_partial && job.status === 'running' && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Live
            </span>
          )}
          {collapsed && resultsData && (
            <span className="text-xs text-gray-400">
              {resultsData.summary.included} likely include · {resultsData.summary.review} possible include · {resultsData.summary.excluded} likely exclude
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {(job.status === 'completed' || job.status === 'running') && (
            <button
              onClick={onDownload}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
            >
              <Download size={14} />
              Download CSVs
            </button>
          )}
          {collapsed ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronUp size={16} className="text-gray-400" />}
        </div>
      </button>

      {!collapsed && <div className="px-4 pb-4 sm:px-6 sm:pb-6">

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshCw size={14} className="animate-spin" />
          Loading results...
        </div>
      )}

      {/* Summary + threshold + table */}
      {resultsData && (
        <>
          {/* Summary bar */}
          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className="text-sm font-medium text-gray-600">Summary:</span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {resultsData.summary.included} Likely Include
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
              {resultsData.summary.review} Possible Include
            </span>
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
              {resultsData.summary.excluded} Likely Exclude
            </span>
            <span className="text-xs text-gray-500 ml-auto">
              {resultsData.summary.total}
              {resultsData.is_partial && job.num_records ? ` / ${job.num_records}` : ''} patients
            </span>
          </div>

          {/* Results table */}
          <div className="grid gap-3 lg:hidden">
            {displayedResults.map((row, index) => (
              <div key={row.patient_id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{formatPatientLabel(index)}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {decisionBadge(row.decision)}
                      {confidenceBadge(row.confidence)}
                    </div>
                  </div>
                  {hasCriteriaCounts && row.inclusion_total !== undefined && (
                    <div className="text-right text-[11px] text-gray-500">
                      <div>
                        <span className="text-green-700 font-medium">{row.inclusion_met}/{row.inclusion_total}</span> incl
                      </div>
                      <div>
                        <span className="text-red-700 font-medium">{row.exclusion_triggered}/{row.exclusion_total}</span> excl
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block max-h-80 overflow-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-700 border-b">Patient</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700 border-b">Decision</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-700 border-b">Model Confidence</th>
                  {hasCriteriaCounts && (
                    <th className="text-left px-4 py-2 font-medium text-gray-700 border-b">Criteria</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {displayedResults.map((row, i) => (
                  <tr key={row.patient_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-4 py-2 font-medium text-gray-900">{formatPatientLabel(i)}</td>
                    <td className="px-4 py-2">{decisionBadge(row.decision)}</td>
                    <td className="px-4 py-2">{confidenceBadge(row.confidence)}</td>
                    {hasCriteriaCounts && (
                      <td className="px-4 py-2">
                        {row.inclusion_total !== undefined ? (
                          <span className="text-xs text-gray-500">
                            <span className="text-green-700 font-medium">{row.inclusion_met}/{row.inclusion_total}</span>
                            {' incl · '}
                            <span className="text-red-700 font-medium">{row.exclusion_triggered}/{row.exclusion_total}</span>
                            {' excl'}
                          </span>
                        ) : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-400 mt-2">
            {resultsData.is_partial
              ? 'Results updating live as patients are screened...'
              : 'Privacy-preserving view. Download CSVs for summary + per-criterion answer files.'}
          </p>
        </>
      )}
      </div>}
    </div>
  );
}

function StatusBadge({ status }: { status: Job['status'] }) {
  const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
    pending: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Pending' },
    running: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Running' },
    completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
    cancelled: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Cancelled' },
  };
  const s = statusConfig[status] ?? statusConfig.pending;
  const Icon = s.icon;
  return (
    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${s.bg} ${s.color}`}>
      <Icon size={14} className={status === 'running' ? 'animate-spin' : ''} />
      {s.label}
    </span>
  );
}

function EmptyResultsState() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <BarChart2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900 mb-1">No results yet</h3>
        <p className="text-gray-500">Results will appear here as jobs process patients</p>
      </div>
    </div>
  );
}

function decisionBadge(decision: string) {
  const normalized = normalizeDecision(decision);

  if (normalized === 'include') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Likely Include</span>;
  }

  if (normalized === 'exclude') {
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Likely Exclude</span>;
  }

  return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">{decisionDisplayLabel(decision)}</span>;
}

function confidenceBadge(confidence: string) {
  switch (normalizeConfidence(confidence)) {
    case 'high':
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">{confidenceDisplayLabel(confidence)}</span>;
    case 'low':
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">{confidenceDisplayLabel(confidence)}</span>;
    default:
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-50 text-yellow-700">{confidenceDisplayLabel(confidence)}</span>;
  }
}

function formatPatientLabel(index: number) {
  return `Patient ${index + 1}`;
}
