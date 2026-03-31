import type {
  CalibrationPackage,
  Criterion,
  Job,
  Model,
  Provider,
  WorkflowConfig,
} from '../types';
import {
  DEMO_FILE_ID,
  DEMO_PACKAGE_ID,
  demoCriteria,
  demoJobTemplate,
  demoPackage,
  demoPreviewRecords,
  demoResults,
} from '../data/demoData';

const STORAGE_KEYS = {
  packages: 'conference-demo-sonar.v2.packages',
  jobs: 'conference-demo-sonar.v2.jobs',
};

const JOB_DURATION_MS = 15000;

type ResultRow = (typeof demoResults)[number];

interface StoredJob {
  id: number;
  job_id: string;
  name: string;
  description?: string;
  created_at: string;
  started_at: string;
  checkpoint_progress: number;
  checkpoint_record_index: number;
  state: 'active' | 'completed' | 'interrupted' | 'cancelled' | 'failed';
  state_started_at: string;
  num_records: number;
  results: ResultRow[];
  total_latency_ms?: number;
  error_message?: string;
  last_error_stage?: string;
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readPackages(): CalibrationPackage[] {
  if (!canUseStorage()) return [demoPackage];
  const raw = window.localStorage.getItem(STORAGE_KEYS.packages);
  if (!raw) {
    writePackages([demoPackage]);
    return [demoPackage];
  }
  try {
    const parsed = JSON.parse(raw) as CalibrationPackage[];
    return parsed.length > 0 ? parsed : [demoPackage];
  } catch {
    writePackages([demoPackage]);
    return [demoPackage];
  }
}

function writePackages(packages: CalibrationPackage[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEYS.packages, JSON.stringify(packages));
}

function readJobs(): StoredJob[] {
  if (!canUseStorage()) return [seedStoredJob()];
  const raw = window.localStorage.getItem(STORAGE_KEYS.jobs);
  if (!raw) {
    const seeded = [seedStoredJob()];
    writeJobs(seeded);
    return seeded;
  }
  try {
    const parsed = JSON.parse(raw) as StoredJob[];
    return parsed.length > 0 ? parsed : [seedStoredJob()];
  } catch {
    const seeded = [seedStoredJob()];
    writeJobs(seeded);
    return seeded;
  }
}

function writeJobs(jobs: StoredJob[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEYS.jobs, JSON.stringify(jobs));
}

function seedStoredJob(): StoredJob {
  return {
    id: demoJobTemplate.id,
    job_id: demoJobTemplate.job_id,
    name: demoJobTemplate.name,
    description: demoJobTemplate.description,
    created_at: demoJobTemplate.created_at,
    started_at: demoJobTemplate.started_at!,
    checkpoint_progress: 100,
    checkpoint_record_index: demoResults.length,
    state: 'completed',
    state_started_at: demoJobTemplate.completed_at!,
    num_records: demoResults.length,
    results: demoResults,
    total_latency_ms: demoJobTemplate.total_latency_ms,
  };
}

function getNowIso() {
  return new Date().toISOString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function buildPackageId(name: string) {
  const slug = slugify(name) || 'demo-package';
  return `${slug}-${Math.random().toString(36).slice(2, 8)}`;
}

function updateStoredJob(jobId: string, updater: (job: StoredJob) => StoredJob): Job {
  const jobs = readJobs();
  const index = jobs.findIndex((job) => job.job_id === jobId);
  if (index < 0) throw new Error('Job not found');
  const current = jobs[index];
  const next = updater(materializeStoredJob(current));
  jobs[index] = next;
  writeJobs(jobs);
  return mapStoredJobToJob(next);
}

function materializeStoredJob(job: StoredJob): StoredJob {
  if (job.state !== 'active') return job;

  const elapsed = Date.now() - new Date(job.state_started_at).getTime();
  const progress = Math.min(100, job.checkpoint_progress + (elapsed / JOB_DURATION_MS) * (100 - job.checkpoint_progress));

  if (progress < 100) return job;

  return {
    ...job,
    checkpoint_progress: 100,
    checkpoint_record_index: job.num_records,
    state: 'completed',
    state_started_at: getNowIso(),
    total_latency_ms: Date.now() - new Date(job.started_at).getTime(),
  };
}

function progressFor(job: StoredJob) {
  if (job.state === 'completed') return 100;
  if (job.state === 'failed' || job.state === 'cancelled' || job.state === 'interrupted') {
    return Math.round(job.checkpoint_progress);
  }
  const elapsed = Date.now() - new Date(job.state_started_at).getTime();
  const progress = job.checkpoint_progress + (elapsed / JOB_DURATION_MS) * (100 - job.checkpoint_progress);
  return Math.max(0, Math.min(100, Math.round(progress)));
}

function recordsProcessedFor(job: StoredJob) {
  return Math.round((job.num_records * progressFor(job)) / 100);
}

function currentStepFor(job: StoredJob) {
  const progress = progressFor(job);
  if (job.state === 'cancelled') return 'Cancelled';
  if (job.state === 'interrupted') return 'Paused at checkpoint';
  if (job.state === 'failed') return 'Failed during screening';
  if (progress <= 12) return 'Uploading sample cohort';
  if (progress <= 24) return 'Preparing screening package';
  if (progress <= 84) return 'Running note-level screening';
  if (progress < 100) return 'Compiling final review queue';
  return 'Completed';
}

function stageFor(job: StoredJob): Job['stage'] {
  const progress = progressFor(job);
  if (progress <= 24) return 'ingest';
  if (progress < 100) return 'screen';
  return 'finalize';
}

function statusFor(job: StoredJob): Job['status'] {
  if (job.state === 'completed') return 'completed';
  if (job.state === 'cancelled') return 'cancelled';
  if (job.state === 'failed') return 'failed';
  if (job.state === 'interrupted') return 'interrupted';

  const progress = progressFor(job);
  if (progress <= 12) return 'ingesting';
  if (progress <= 24) return 'queued';
  return 'running';
}

function artifactStatusFor(job: StoredJob): Job['artifact_status'] {
  if (job.state === 'completed') return 'finalized';
  return recordsProcessedFor(job) > 0 ? 'partial' : 'pending';
}

function mapStoredJobToJob(job: StoredJob): Job {
  const normalized = materializeStoredJob(job);
  return {
    id: normalized.id,
    job_id: normalized.job_id,
    name: normalized.name,
    description: normalized.description,
    status: statusFor(normalized),
    stage: stageFor(normalized),
    progress_percent: progressFor(normalized),
    current_step: currentStepFor(normalized),
    num_records: normalized.num_records,
    records_processed: recordsProcessedFor(normalized),
    checkpoint_record_index: normalized.checkpoint_record_index,
    heartbeat_at: getNowIso(),
    interrupted_at: normalized.state === 'interrupted' ? normalized.state_started_at : undefined,
    is_resumable: normalized.state === 'interrupted',
    last_error_stage: normalized.last_error_stage,
    artifact_status: artifactStatusFor(normalized),
    created_at: normalized.created_at,
    started_at: normalized.started_at,
    completed_at: normalized.state === 'completed' ? normalized.state_started_at : undefined,
    error_message: normalized.error_message,
    total_latency_ms: normalized.total_latency_ms,
  };
}

function inferPatternDetails(text: string) {
  const normalized = text.toLowerCase();
  const details: Array<{ name: string; display_name: string; category: string }> = [];
  let suggested: 'presence' | 'extraction' | 'comparison' | 'range' = 'presence';

  if (normalized.includes('age')) {
    details.push({ name: 'age', display_name: 'Age', category: 'lab_value' });
    suggested = 'range';
  }
  if (normalized.includes('egfr')) {
    details.push({ name: 'egfr', display_name: 'eGFR', category: 'lab_value' });
    suggested = 'range';
  }
  if (normalized.includes('uacr') || normalized.includes('albuminuria')) {
    details.push({ name: 'uacr', display_name: 'UACR', category: 'lab_value' });
    suggested = 'range';
  }
  if (normalized.includes('bnp')) {
    details.push({ name: 'bnp', display_name: 'BNP', category: 'lab_value' });
    suggested = 'comparison';
  }
  if (normalized.includes('diabetes') || normalized.includes('ckd') || normalized.includes('kidney')) {
    details.push({ name: 'disease', display_name: 'Diagnosis', category: 'diagnosis' });
  }
  if (normalized.includes('ace inhibitor') || normalized.includes('arb') || normalized.includes('losartan') || normalized.includes('lisinopril')) {
    details.push({ name: 'ras_blockade', display_name: 'ACEi / ARB', category: 'medication' });
  }
  if (normalized.includes('edema') || normalized.includes('fluid retention') || normalized.includes('heart failure')) {
    details.push({ name: 'fluid_retention', display_name: 'Fluid retention', category: 'diagnosis' });
  }

  return {
    patterns: details.map((detail) => detail.name),
    pattern_details: details,
    suggested_criterion_type: suggested,
  };
}

export const providersApi = {
  list: async (): Promise<{ providers: Provider[] }> => ({
    providers: [
      {
        name: 'demo_engine',
        display_name: 'Scripted Screening Engine',
        available: true,
        configured: true,
        config_keys: [],
        description: 'Local scripted screening engine',
      },
    ],
  }),

  healthCheck: async (
    _provider: string,
    _model?: string,
    _baseUrl?: string,
    _apiKey?: string,
  ) => ({
    provider: 'demo_engine',
    status: 'ok',
  }),

  listModels: async (
    _provider: string,
    _baseUrl?: string,
  ): Promise<{ provider: string; models: Model[]; error?: string }> => ({
    provider: 'demo_engine',
    models: [{ id: 'sonar-scripted-demo', name: 'SONAR Scripted', recommended: true }],
  }),

  listAzureDeployments: async (
    _endpoint: string,
    _apiKey: string,
  ): Promise<{
    provider: string;
    deployments: Array<{ id: string; name: string; model: string; status: string }>;
    error?: string;
  }> => ({
    provider: 'demo_engine',
    deployments: [
      {
        id: 'sonar-scripted-demo',
        name: 'SONAR Scripted',
        model: 'scripted',
        status: 'succeeded',
      },
    ],
  }),
};

export const jobsApi = {
  submit: async (jobData: {
    name: string;
    description?: string;
    input_csv_path?: string;
    uploaded_file_id?: string;
    criteria: Criterion[];
    workflow_config: WorkflowConfig;
  }): Promise<Job> => {
    const jobs = readJobs();
    const nextId = (jobs[0]?.id ?? 1) + 1;
    const now = getNowIso();
    const stored: StoredJob = {
      id: nextId,
      job_id: `demo-job-${Math.random().toString(36).slice(2, 10)}`,
      name: jobData.name,
      description: jobData.description ?? 'Screening run',
      created_at: now,
      started_at: now,
      checkpoint_progress: 0,
      checkpoint_record_index: 0,
      state: 'active',
      state_started_at: now,
      num_records: demoResults.length,
      results: demoResults,
    };
    jobs.unshift(stored);
    writeJobs(jobs);
    return mapStoredJobToJob(stored);
  },

  get: async (jobId: string): Promise<Job> => {
    const jobs = readJobs().map(materializeStoredJob);
    writeJobs(jobs);
    const job = jobs.find((item) => item.job_id === jobId);
    if (!job) throw new Error('Job not found');
    return mapStoredJobToJob(job);
  },

  getStatus: async (jobId: string) => {
    const job = await jobsApi.get(jobId);
    return {
      job_id: job.job_id,
      name: job.name,
      status: job.status,
      stage: job.stage,
      progress_percent: job.progress_percent,
      current_step: job.current_step,
      records_processed: job.records_processed,
      checkpoint_record_index: job.checkpoint_record_index,
      num_records: job.num_records,
      heartbeat_at: job.heartbeat_at,
      is_resumable: job.is_resumable,
      last_error_stage: job.last_error_stage,
      artifact_status: job.artifact_status,
      error_message: job.error_message,
    };
  },

  list: async (params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ jobs: Job[]; total: number; limit: number; offset: number }> => {
    const materialized = readJobs().map(materializeStoredJob);
    writeJobs(materialized);
    const mapped = materialized.map(mapStoredJobToJob);
    const filtered = params?.status
      ? mapped.filter((job) => job.status === params.status)
      : mapped;
    const offset = params?.offset ?? 0;
    const limit = params?.limit ?? filtered.length;
    return {
      jobs: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset,
    };
  },

  cancel: async (jobId: string) =>
    updateStoredJob(jobId, (job) => ({
      ...job,
      checkpoint_progress: progressFor(job),
      checkpoint_record_index: recordsProcessedFor(job),
      state: 'cancelled',
      state_started_at: getNowIso(),
    })),

  resume: async (jobId: string): Promise<Job> =>
    updateStoredJob(jobId, (job) => ({
      ...job,
      checkpoint_progress: progressFor(job),
      checkpoint_record_index: recordsProcessedFor(job),
      state: 'active',
      state_started_at: getNowIso(),
    })),

  retry: async (jobId: string): Promise<Job> =>
    updateStoredJob(jobId, (job) => {
      const now = getNowIso();
      return {
        ...job,
        started_at: now,
        checkpoint_progress: 0,
        checkpoint_record_index: 0,
        state: 'active',
        state_started_at: now,
        total_latency_ms: undefined,
        error_message: undefined,
        last_error_stage: undefined,
      };
    }),

  download: async (jobId: string): Promise<Blob> => {
    const results = await jobsApi.getResults(jobId);
    const rows = ['patient_id,decision,confidence,source'];
    results.results.forEach((row) => {
      rows.push(`${row.patient_id},${row.decision},${row.confidence},${row.source ?? ''}`);
    });
    return new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  },

  delete: async (jobId: string) => {
    const jobs = readJobs().filter((job) => job.job_id !== jobId);
    writeJobs(jobs);
    return { deleted: true };
  },

  getResults: async (jobId: string): Promise<{
    results: Array<{
      patient_id: string;
      decision: string;
      confidence: string;
      source?: string;
      inclusion_met?: number;
      inclusion_total?: number;
      exclusion_triggered?: number;
      exclusion_total?: number;
    }>;
    summary: {
      total: number;
      included: number;
      excluded: number;
      review: number;
    };
    is_partial?: boolean;
    inclusion_total?: number;
    exclusion_total?: number;
  }> => {
    const jobs = readJobs().map(materializeStoredJob);
    writeJobs(jobs);
    const job = jobs.find((item) => item.job_id === jobId);
    if (!job) throw new Error('Job not found');
    const visibleCount = recordsProcessedFor(job);
    const visibleResults = job.results.slice(0, visibleCount);
    return {
      results: visibleResults,
      summary: {
        total: visibleResults.length,
        included: visibleResults.filter((row) => row.decision === 'Include').length,
        excluded: visibleResults.filter((row) => row.decision === 'Exclude').length,
        review: visibleResults.filter((row) => row.decision === 'Review').length,
      },
      is_partial: job.state !== 'completed',
      inclusion_total: 4,
      exclusion_total: 10,
    };
  },
};

export const uploadApi = {
  ingest: async (files: File[], _format = 'auto'): Promise<{
    csv_path: string;
    file_id: string;
    num_records: number;
    preview: Array<{ id: string; note: string }>;
    deidentification_stats?: {
      total_phi_found: number;
      records_with_phi: number;
      phi_types: Record<string, number>;
    };
  }> => {
    const fileName = files[0]?.name || 'sonar-dkd-cohort.csv';
    return {
      csv_path: `/demo/${fileName}`,
      file_id: DEMO_FILE_ID,
      num_records: demoResults.length,
      preview: demoPreviewRecords,
      deidentification_stats: {
        total_phi_found: 18,
        records_with_phi: 9,
        phi_types: { name: 10, date: 5, location: 3 },
      },
    };
  },

  getFormats: async () => ({
    formats: [
      { name: 'csv', description: 'Comma-separated values', extensions: ['.csv'] },
      { name: 'excel', description: 'Excel workbook', extensions: ['.xlsx', '.xls'] },
    ],
  }),

  getRecords: async (_fileId: string, limit = 100, offset = 0) => ({
    file_id: DEMO_FILE_ID,
    records: demoPreviewRecords.slice(offset, offset + limit),
    total: demoResults.length,
    limit,
    offset,
  }),
};

export interface AzureCalibrationCreds {
  endpoint?: string;
  api_key?: string;
  model?: string;
}

export const calibrationApi = {
  savePackage: async (packageData: {
    name: string;
    description?: string;
    raw_criteria_text?: string;
    criteria: Criterion[];
    appraisal_results?: any;
    test_examples?: any[];
    calibration_provider?: string;
    calibration_model?: string;
  }): Promise<CalibrationPackage> => {
    const packages = readPackages();
    const now = getNowIso();
    const saved: CalibrationPackage = {
      id: Math.max(0, ...packages.map((pkg) => pkg.id)) + 1,
      package_id: buildPackageId(packageData.name),
      name: packageData.name,
      description: packageData.description,
      criteria: packageData.criteria,
      appraisal_results: packageData.appraisal_results,
      test_examples: packageData.test_examples,
      created_at: now,
      updated_at: now,
    };
    writePackages([saved, ...packages]);
    return saved;
  },

  listPackages: async (): Promise<CalibrationPackage[]> => readPackages(),

  getPackage: async (packageId: string): Promise<CalibrationPackage> => {
    const pkg = readPackages().find((item) => item.package_id === packageId);
    if (!pkg) throw new Error('Package not found');
    return pkg;
  },

  updatePackage: async (packageId: string, packageData: {
    name: string;
    description?: string;
    raw_criteria_text?: string;
    criteria: Criterion[];
    appraisal_results?: any;
    test_examples?: any[];
  }): Promise<CalibrationPackage> => {
    const packages = readPackages();
    const updatedPackages = packages.map((pkg) => (
      pkg.package_id === packageId
        ? {
            ...pkg,
            name: packageData.name,
            description: packageData.description,
            criteria: packageData.criteria,
            appraisal_results: packageData.appraisal_results,
            test_examples: packageData.test_examples,
            updated_at: getNowIso(),
          }
        : pkg
    ));
    writePackages(updatedPackages);
    const updated = updatedPackages.find((pkg) => pkg.package_id === packageId);
    if (!updated) throw new Error('Package not found');
    return updated;
  },

  deletePackage: async (packageId: string) => {
    const packages = readPackages().filter((pkg) => pkg.package_id !== packageId || pkg.package_id === DEMO_PACKAGE_ID);
    writePackages(packages);
    return { deleted: true };
  },
};

export const deidentificationApi = {
  checkStatus: async () => ({
    available: true,
  }),
};

export const regexApi = {
  autoDetectPatterns: async (text: string) => inferPatternDetails(text),

  listPatterns: async () => ({
    medication: {},
    diagnosis: {},
    lab_value: {},
    total_count: 6,
  }),

  listMedicationClasses: async () => ({
    classes: [
      {
        key: 'immunosuppressants',
        display_name: 'Immunosuppressants',
        sample_terms: ['prednisone', 'tacrolimus', 'mycophenolate'],
        term_count: 3,
      },
    ],
  }),

  batchMultiScreen: async () => ({
    results: [],
    patients_screened: demoResults.length,
    criteria_count: demoCriteria.length,
  }),

  determineEligibility: async () => ({
    results: [],
  }),
};
