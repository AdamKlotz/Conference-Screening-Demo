// TypeScript types for the Clinical Trial Screening App

export interface Provider {
  name: string;
  display_name: string;
  available: boolean;
  configured: boolean;
  config_keys: string[];
  description: string;
}

export interface Model {
  id: string;
  name: string;
  recommended: boolean;
}

export interface Criterion {
  id: string;
  type: 'inclusion' | 'exclusion' | 'calculated';
  question_text: string;
  text?: string;
  is_inclusion?: boolean;
  allowed_values?: string[] | null;
  select_all?: boolean;
  // Criterion type for LLM prompt selection
  criterion_type?: 'presence' | 'extraction' | 'comparison' | 'range';
  // Comparison/range fields (inline on any criterion)
  measure?: string;
  operator?: '>' | '>=' | '<' | '<=' | 'between';
  threshold?: number;
  threshold_upper?: number;
}

export interface WorkflowConfig {
  prompt: {
    preset?: string;
    custom_template?: string;
    system_prompt?: string;
    variables?: Record<string, any>;
    examples?: Record<string, string[]>;
  };
  models: Array<{
    provider: string;
    model?: string;
    temperature?: number;
    weight?: number;
    endpoint?: string;
    api_key?: string;
    azureEndpoint?: string;
    azureApiKey?: string;
  }>;
  screening_strategy?: 'single' | 'ensemble' | 'hierarchical' | 'multi_agent';
  criteria_mode: 'one_at_a_time' | 'all_at_once' | 'iterative' | 'grouped';
  aggregation?: {
    mode: 'majority_vote' | 'unanimous' | 'weighted' | 'ahead_by_k';
    threshold?: number;
    ahead_by_k?: number;
  };
  uncertainty_threshold?: number;
  regex_pre_screen?: boolean;
  regex_confidence_threshold?: 'High' | 'Medium';
  id_column?: string;
  content_column?: string;
}

export interface Job {
  id: number;
  job_id: string;
  name: string;
  description?: string;
  status: 'pending' | 'ingesting' | 'queued' | 'running' | 'interrupted' | 'completed' | 'failed' | 'cancelled';
  stage: 'ingest' | 'screen' | 'finalize';
  progress_percent: number;
  current_step?: string;
  num_records?: number;
  records_processed: number;
  checkpoint_record_index: number;
  heartbeat_at?: string;
  interrupted_at?: string;
  is_resumable: boolean;
  last_error_stage?: string;
  artifact_status: 'pending' | 'partial' | 'finalized';
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  output_file_path?: string;
  total_latency_ms?: number;
}

export interface CalibrationPackage {
  id: number;
  package_id: string;
  name: string;
  description?: string;
  criteria: Criterion[];
  appraisal_results?: {
    summary: string;
    overall_quality: string;
    criteria_feedback: Array<{
      criterion_id: string;
      status: string;
      issue: string;
      suggestion: string;
      suggested_rewrite?: string | null;
      evidence?: string;
      severity: string;
    }>;
    general_suggestions: string[];
  };
  test_examples?: Array<{
    patient_note: string;
    expected_decisions: Record<string, string>;
    overall_decision: string;
    notes?: string;
  }>;
  created_at: string;
  updated_at?: string;
}

// React Flow node data types
export interface NodeData {
  label: string;
  [key: string]: any;
}

export interface DataSourceNodeData extends NodeData {
  file?: File;
  filePath?: string;
  numRecords?: number;
}

export interface CriteriaNodeData extends NodeData {
  criteria: Criterion[];
  promptMode: 'preset' | 'custom';
  selectedPreset?: string;
  customPrompt?: string;
  systemPrompt?: string;
}

export interface ProviderNodeData extends NodeData {
  provider: string;
  model?: string;
  temperature: number;
  enableEnsemble: boolean;
  ensembleModels?: Array<{
    provider: string;
    model?: string;
    weight?: number;
  }>;
}

export interface ScreeningNodeData extends NodeData {
  criteriaMode: 'one_at_a_time' | 'all_at_once' | 'iterative';
  aggregationMode?: 'majority_vote' | 'unanimous' | 'weighted' | 'ahead_by_k';
}

// Regex pre-screening types
export interface RegexPatternInfo {
  name: string;
  display_name: string;
  category: 'medication' | 'diagnosis' | 'lab_value' | 'unknown';
}

export interface CriterionPatternConfig {
  criterionId: string;
  criterionText: string;
  patterns: RegexPatternInfo[];
  enabled: boolean;
}

export interface DeidentificationNodeData extends NodeData {
  pydeidAvailable?: boolean;
  stats?: {
    totalPhiFound?: number;
    recordsWithPhi?: number;
    totalRecords?: number;
    phiTypes?: Record<string, number>;
  };
}

export interface RegexPreScreenNodeData extends NodeData {
  criteriaPatterns: CriterionPatternConfig[];
  confidenceThreshold: 'High' | 'Medium';
}

// Regex criterion config (matches backend CriterionConfig)
export interface RegexCriterionConfig {
  id: string;
  text: string;
  pattern_names: string[];
  comparator?: string | null;
  threshold?: number | null;
  threshold_min?: number | null;
  threshold_max?: number | null;
  llm_prompt?: string | null;
  medication_groups: string[];
  category: 'inclusion' | 'exclusion';
  criterion_type: 'presence' | 'extraction' | 'comparison' | 'range';
}
