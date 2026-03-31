import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { jobsApi } from '../../api/client';
import type { Job } from '../../types';
import { Trash2, XCircle, RefreshCw, CheckCircle, Clock, AlertCircle, Timer, ExternalLink, PlayCircle, RotateCcw, PauseCircle } from 'lucide-react';
import { HelpButton, HelpPanel } from '../ui/HelpPanel';

function formatSubmittedAt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

interface JobsPanelProps {
  setActiveTab?: (tab: string) => void;
  setFocusedJobId?: (id: string) => void;
}

export default function JobsPanel({ setActiveTab, setFocusedJobId }: JobsPanelProps) {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showHelp, setShowHelp] = useState(false);

  // Fetch jobs list
  const { data: jobsData, isLoading } = useQuery({
    queryKey: ['jobs', selectedStatus],
    queryFn: () => jobsApi.list({
      status: selectedStatus === 'all' ? undefined : selectedStatus,
      limit: 50,
    }),
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Cancel job mutation
  const cancelMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.cancel(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  // Delete job mutation
  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.delete(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.resume(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (jobId: string) => jobsApi.retry(jobId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  const jobs = jobsData?.jobs || [];

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Screening Jobs</h2>
            <p className="text-xs text-gray-500 sm:text-sm">Monitor and manage your screening jobs</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="min-w-0 flex-1 sm:flex-none px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="ingesting">Ingesting</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="interrupted">Interrupted</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['jobs'] })}
              className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2 text-sm"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <HelpButton isOpen={showHelp} onToggle={() => setShowHelp(!showHelp)} />
          </div>
        </div>
      </div>

      <HelpPanel isOpen={showHelp} onToggle={() => setShowHelp(false)}>
        <h4 className="font-semibold text-sm mb-2">Jobs Help</h4>
        <ul className="text-sm space-y-2 list-disc list-inside text-blue-900">
          <li><strong>Pending:</strong> Job is queued and waiting to start processing.</li>
          <li><strong>Queued/Ingesting:</strong> Input is being staged or the job is waiting for a worker to claim it.</li>
          <li><strong>Running:</strong> Screening is in progress. The progress bar shows completion percentage. You can cancel a running job.</li>
          <li><strong>Interrupted:</strong> Worker execution stopped before completion. Resume continues from the stored checkpoint.</li>
          <li><strong>Completed:</strong> Screening finished. Results remain available in the <strong>Results</strong> tab.</li>
          <li><strong>Failed:</strong> An error occurred. Check the error message for details (common causes: invalid credentials, model timeout).</li>
          <li><strong>Download CSVs:</strong> Export is available during active runs and after completion.</li>
        </ul>
      </HelpPanel>

      {/* Jobs List */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <RefreshCw className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="text-gray-600">Loading jobs...</p>
            </div>
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No jobs found</h3>
              <p className="text-gray-500">
                {selectedStatus === 'all'
                  ? 'Create a workflow and submit a screening job to get started'
                  : `No ${selectedStatus} jobs found`}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobCard
                key={job.job_id}
                job={job}
                onCancel={() => cancelMutation.mutate(job.job_id)}
                onDelete={() => deleteMutation.mutate(job.job_id)}
                onResume={() => resumeMutation.mutate(job.job_id)}
                onRetry={() => retryMutation.mutate(job.job_id)}
                onShowInResults={setActiveTab && setFocusedJobId ? () => {
                  setFocusedJobId(job.job_id);
                  setActiveTab('results');
                } : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function JobCard({
  job,
  onCancel,
  onDelete,
  onResume,
  onRetry,
  onShowInResults,
}: {
  job: Job;
  onCancel: () => void;
  onDelete: () => void;
  onResume: () => void;
  onRetry: () => void;
  onShowInResults?: () => void;
}) {
  const statusConfig = {
    pending: { icon: Clock, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Pending' },
    ingesting: { icon: PauseCircle, color: 'text-amber-700', bg: 'bg-amber-100', label: 'Ingesting' },
    queued: { icon: Clock, color: 'text-sky-700', bg: 'bg-sky-100', label: 'Queued' },
    running: { icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-100', label: 'Running' },
    interrupted: { icon: AlertCircle, color: 'text-amber-700', bg: 'bg-amber-100', label: 'Interrupted' },
    completed: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Completed' },
    failed: { icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
    cancelled: { icon: XCircle, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Cancelled' },
  };

  const status = statusConfig[job.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">{job.name}</h3>
            <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
              <StatusIcon size={14} className={job.status === 'running' ? 'animate-spin' : ''} />
              {status.label}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-xs text-gray-500">Submitted {formatSubmittedAt(job.created_at)}</p>
            {onShowInResults && (job.status === 'running' || job.status === 'completed' || job.records_processed > 0) && (
              <button
                onClick={onShowInResults}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                <ExternalLink size={11} />
                Show in Results
              </button>
            )}
          </div>
          {job.description && (
            <p className="text-sm text-gray-600 mt-1">{job.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {(job.status === 'running' || job.status === 'ingesting') && (
            <button
              onClick={onCancel}
              className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
              title="Cancel Job"
            >
              <XCircle size={18} />
            </button>
          )}
          {job.status === 'interrupted' && (
            <button
              onClick={onResume}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Resume Job"
            >
              <PlayCircle size={18} />
            </button>
          )}
          {(job.status === 'failed' || job.status === 'cancelled') && (
            <button
              onClick={onRetry}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Retry Job"
            >
              <RotateCcw size={18} />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Job"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Progress Bar with Elapsed / ETA */}
      {(job.status === 'running' || job.status === 'pending' || job.status === 'queued' || job.status === 'ingesting') && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>{job.current_step || 'Initializing...'}</span>
            <span>{job.progress_percent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${job.progress_percent}%` }}
            />
          </div>
          {job.status === 'running' && job.started_at && (
            <ElapsedEta startedAt={job.started_at} recordsDone={job.records_processed} recordsTotal={job.num_records} />
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
        <div>
          <p className="text-gray-500">Records</p>
          <p className="font-medium text-gray-900">
            {job.records_processed} / {job.num_records || '?'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Stage</p>
          <p className="font-medium text-gray-900">
            {job.stage}
          </p>
        </div>
        {job.completed_at && (
          <div>
            <p className="text-gray-500">Completed</p>
            <p className="font-medium text-gray-900">
              {new Date(job.completed_at).toLocaleDateString()}
            </p>
          </div>
        )}
        {job.total_latency_ms && (
          <div>
            <p className="text-gray-500">Duration</p>
            <p className="font-medium text-gray-900">
              {(job.total_latency_ms / 1000).toFixed(1)}s
            </p>
          </div>
        )}
      </div>

      {/* Error Message */}
      {job.error_message && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            <strong>Error:</strong> {job.error_message}
          </p>
          {job.last_error_stage && (
            <p className="text-xs text-red-700 mt-1">
              Last stage: {job.last_error_stage}
            </p>
          )}
        </div>
      )}

    </div>
  );
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function ElapsedEta({
  startedAt,
  recordsDone,
  recordsTotal,
}: {
  startedAt: string;
  recordsDone: number;
  recordsTotal?: number;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now - new Date(startedAt).getTime();
  const elapsedStr = formatDuration(elapsed);

  let etaStr = '';
  if (recordsDone > 0 && recordsTotal && recordsTotal > recordsDone) {
    const msPerRecord = elapsed / recordsDone;
    const remaining = msPerRecord * (recordsTotal - recordsDone);
    etaStr = formatDuration(remaining);
  }

  return (
    <div className="flex items-center gap-4 text-xs text-gray-500">
      <span className="flex items-center gap-1">
        <Timer size={12} />
        Elapsed: {elapsedStr}
      </span>
      {etaStr && (
        <span>ETA: ~{etaStr} remaining</span>
      )}
      {recordsDone > 0 && recordsTotal && (
        <span className="ml-auto">
          {recordsDone} / {recordsTotal} patients
        </span>
      )}
    </div>
  );
}
