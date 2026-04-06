export function decisionDisplayLabel(decision: string) {
  switch (normalizeDecision(decision)) {
    case 'include':
      return 'Likely Include';
    case 'exclude':
      return 'Likely Exclude';
    default:
      return 'Possible Include';
  }
}

export function normalizeDecision(decision: string) {
  const normalized = decision.trim().toLowerCase();

  if (normalized === 'include' || normalized === 'likely include') return 'include';
  if (normalized === 'exclude' || normalized === 'likely exclude') return 'exclude';
  if (normalized === 'review' || normalized === 'possible include') return 'possible';

  return 'possible';
}

export function confidenceDisplayLabel(confidence: string) {
  switch (normalizeConfidence(confidence)) {
    case 'high':
      return 'Model confidence: high';
    case 'low':
      return 'Model confidence: low';
    default:
      return 'Model confidence: medium';
  }
}

export function normalizeConfidence(confidence: string) {
  const normalized = confidence.trim().toLowerCase();

  if (normalized.includes('high')) return 'high';
  if (normalized.includes('low')) return 'low';
  return 'medium';
}
