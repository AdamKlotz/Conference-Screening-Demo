import type { CalibrationPackage, Criterion, Job } from '../types';

export const DEMO_PACKAGE_ID = 'conference-demo-sonar-dkd-001';
export const DEMO_FILE_ID = 'conference-demo-cohort';

export const demoCriteria: Criterion[] = [
  { id: 'I1', type: 'inclusion', question_text: 'Is the patient a male or female >= 18 years of age BUT <= 85?', criterion_type: 'range', threshold: 18, threshold_upper: 85 },
  { id: 'I2', type: 'inclusion', question_text: 'Is the patients eGFR >= 25 and <= 75 with UACR ≥ 34 mg/mmol and <565 mg/mmol?', criterion_type: 'range', threshold: 25, threshold_upper: 75 },
  { id: 'I3', type: 'inclusion', question_text: 'Does the patient have type 2 diabetes?', criterion_type: 'presence' },
  { id: 'I4', type: 'inclusion', question_text: 'Is the patient on an ACEi or an ARB?', criterion_type: 'presence' },
  { id: 'E1', type: 'exclusion', question_text: 'Is the patient on dialysis?', criterion_type: 'presence' },
  { id: 'E2', type: 'exclusion', question_text: 'Does the patient have a history of secondary hypertension?', criterion_type: 'presence' },
  { id: 'E3', type: 'exclusion', question_text: 'Does the patient have a Allergy or sensitivity to Atrasentan or similar compounds?', criterion_type: 'presence' },
  { id: 'E4', type: 'exclusion', question_text: 'Does the patient have Diabetes type 1?', criterion_type: 'presence' },
  { id: 'E5', type: 'exclusion', question_text: 'Is the patient currently taking Atrasentan, rosiglitazone, moxonidine, aldosterone blockers, aliskiren, or a combination of ACEi and ARB?', criterion_type: 'presence' },
  { id: 'E6', type: 'exclusion', question_text: 'Is the patient Use of any GLP-1 agonist?', criterion_type: 'presence' },
  { id: 'E7', type: 'exclusion', question_text: 'Does the patient currenlty have a history of cinically significant CVD or CAD (MI, CABG, TIA, Stroke?', criterion_type: 'presence' },
  { id: 'E8', type: 'exclusion', question_text: 'Does the patient have Heart failure?', criterion_type: 'presence' },
  { id: 'E9', type: 'exclusion', question_text: 'Does the patient have Severe peripheral edema or facial edema requiring diuretics?', criterion_type: 'presence' },
  { id: 'E10', type: 'exclusion', question_text: 'Does the patient have a History of pulmonary hypertension, pulmonary fibrosis or any lung disease?', criterion_type: 'presence' },
];

export const demoPackage: CalibrationPackage = {
  id: 1,
  package_id: DEMO_PACKAGE_ID,
  name: 'SONAR DKD',
  description: 'Eligibility package inspired by the SONAR type 2 diabetes and kidney disease study.',
  criteria: demoCriteria,
  appraisal_results: {
    summary: 'Package is clear, clinically plausible, and aligned to a stable SONAR-style screening workflow.',
    overall_quality: 'Strong',
    criteria_feedback: [],
    general_suggestions: ['Use this package as the default SONAR screening workflow.'],
  },
  created_at: '2026-03-01T12:00:00.000Z',
  updated_at: '2026-03-01T12:00:00.000Z',
};

export const demoPreviewRecords = [
  { id: 'SON-001', note: '63-year-old with type 2 diabetes on metformin and insulin. eGFR 42 mL/min/1.73 m2, UACR 140 mg/mmol, on lisinopril. No dialysis, no heart failure, no edema history.' },
  { id: 'SON-002', note: '58-year-old with type 2 diabetes, eGFR 51, UACR 82 mg/mmol, on losartan. Prior MI in 2021 and established CAD.' },
  { id: 'SON-003', note: '71-year-old with diabetes and CKD. eGFR 29, UACR 230 mg/mmol, on ramipril. No dialysis, but chart notes secondary hypertension.' },
  { id: 'SON-004', note: '67-year-old with diabetes, eGFR 61, UACR 67 mg/mmol, on irbesartan. Uses semaglutide and has prior heart failure admission.' },
  { id: 'SON-005', note: '55-year-old with type 2 diabetes on metformin. eGFR 73, UACR 40 mg/mmol, on candesartan. No CVD, edema, dialysis, or pulmonary disease.' },
];

export const demoResults = [
  { patient_id: 'SON-001', decision: 'Include', confidence: 'High', source: 'LLM + regex', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'Meets all inclusion criteria and has no major SONAR exclusions.' },
  { patient_id: 'SON-002', decision: 'Exclude', confidence: 'High', source: 'LLM + regex', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 1, exclusion_total: 10, reason: 'Prior clinically significant CAD and MI trigger the cardiovascular exclusion.' },
  { patient_id: 'SON-003', decision: 'Exclude', confidence: 'High', source: 'LLM', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 1, exclusion_total: 10, reason: 'Secondary hypertension is documented and excludes the patient.' },
  { patient_id: 'SON-004', decision: 'Exclude', confidence: 'High', source: 'LLM', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 2, exclusion_total: 10, reason: 'GLP-1 agonist use and heart failure history both exclude the patient.' },
  { patient_id: 'SON-005', decision: 'Include', confidence: 'High', source: 'LLM + regex', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'Strong SONAR-style fit with no dialysis, CVD, or edema history.' },
  { patient_id: 'SON-006', decision: 'Review', confidence: 'Medium', source: 'LLM', inclusion_met: 3, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'UACR appears close to the threshold and should be manually checked before enrollment.' },
  { patient_id: 'SON-007', decision: 'Include', confidence: 'High', source: 'LLM + regex', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'Meets age, CKD, diabetes, and ACEi/ARB requirements without exclusions.' },
  { patient_id: 'SON-008', decision: 'Exclude', confidence: 'High', source: 'LLM', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 1, exclusion_total: 10, reason: 'Severe peripheral edema requiring diuretics triggers the edema exclusion.' },
  { patient_id: 'SON-009', decision: 'Include', confidence: 'High', source: 'LLM + regex', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'Diabetes, eGFR, UACR, and ARB use all align with the study criteria.' },
  { patient_id: 'SON-010', decision: 'Review', confidence: 'Medium', source: 'LLM', inclusion_met: 3, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'ACEi/ARB status is unclear in the note and needs coordinator review.' },
  { patient_id: 'SON-011', decision: 'Include', confidence: 'High', source: 'LLM + regex', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'Clear include candidate with diabetes, CKD-range labs, and no exclusion history.' },
  { patient_id: 'SON-012', decision: 'Exclude', confidence: 'High', source: 'LLM', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 1, exclusion_total: 10, reason: 'Dialysis use is documented and excludes the patient.' },
  { patient_id: 'SON-013', decision: 'Review', confidence: 'Medium', source: 'LLM', inclusion_met: 3, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'The chart suggests possible pulmonary disease and requires manual adjudication.' },
  { patient_id: 'SON-014', decision: 'Include', confidence: 'High', source: 'LLM + regex', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'All core SONAR criteria are met and no exclusion medications are listed.' },
  { patient_id: 'SON-015', decision: 'Exclude', confidence: 'High', source: 'LLM', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 1, exclusion_total: 10, reason: 'History of pulmonary hypertension and lung disease triggers exclusion.' },
  { patient_id: 'SON-016', decision: 'Include', confidence: 'High', source: 'LLM + regex', inclusion_met: 4, inclusion_total: 4, exclusion_triggered: 0, exclusion_total: 10, reason: 'Meets the SONAR criteria without notable safety exclusions.' },
];

export const demoJobTemplate: Job = {
  id: 1,
  job_id: 'seed-demo-job',
  name: 'SONAR DKD - Completed',
  description: 'Completed screening run available on first load.',
  status: 'completed',
  stage: 'finalize',
  progress_percent: 100,
  current_step: 'Completed',
  num_records: demoResults.length,
  records_processed: demoResults.length,
  checkpoint_record_index: demoResults.length,
  is_resumable: false,
  artifact_status: 'finalized',
  created_at: '2026-03-10T13:30:00.000Z',
  started_at: '2026-03-10T13:30:05.000Z',
  completed_at: '2026-03-10T13:30:19.000Z',
  total_latency_ms: 14000,
};
