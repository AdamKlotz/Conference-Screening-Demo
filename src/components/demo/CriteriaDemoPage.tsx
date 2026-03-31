import { ArrowRight, CheckCircle2, ClipboardList } from 'lucide-react';
import { demoCriteria, demoPackage } from '../../data/demoData';

export default function CriteriaDemoPage({
  onNext,
}: {
  onNext: () => void;
}) {
  const inclusion = demoCriteria.filter((criterion) => criterion.type === 'inclusion');
  const exclusion = demoCriteria.filter((criterion) => criterion.type === 'exclusion');

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Criteria Builder</h2>
            <p className="text-xs text-gray-500 sm:text-sm">
              SONAR eligibility criteria
            </p>
          </div>
          <span className="hidden md:inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
            <ClipboardList size={14} />
            SONAR
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
            <h3 className="text-lg font-semibold text-gray-900">{demoPackage.name}</h3>
            <p className="text-sm text-gray-600 mt-1">{demoPackage.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {inclusion.length} inclusion
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                {exclusion.length} exclusion
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <CriteriaColumn
              title="Inclusion Criteria"
              color="green"
              criteria={inclusion}
            />
            <CriteriaColumn
              title="Exclusion Criteria"
              color="red"
              criteria={exclusion}
            />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 sm:px-6 sm:py-4">
        <div className="max-w-5xl mx-auto flex justify-end">
          <button
            onClick={onNext}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Next: Workflow Builder
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function CriteriaColumn({
  title,
  color,
  criteria,
}: {
  title: string;
  color: 'green' | 'red';
  criteria: typeof demoCriteria;
}) {
  const palette = color === 'green'
    ? {
        badge: 'bg-green-100 text-green-800',
        dot: 'bg-green-500',
        ring: 'border-green-200',
      }
    : {
        badge: 'bg-red-100 text-red-800',
        dot: 'bg-red-400',
        ring: 'border-red-200',
      };

  return (
    <div className={`bg-white rounded-xl border ${palette.ring} overflow-hidden`}>
      <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${palette.badge}`}>
          {criteria.length}
        </span>
      </div>
      <div className="p-3 sm:p-4 space-y-3">
        {criteria.map((criterion) => (
          <div key={criterion.id} className="flex items-start gap-3 p-2.5 sm:p-3 rounded-lg bg-gray-50 border border-gray-100">
            <span className={`mt-1 w-2.5 h-2.5 rounded-full ${palette.dot}`} />
            <div>
              <div className="text-xs font-semibold text-gray-500 mb-1">{criterion.id}</div>
              <p className="text-sm text-gray-800 leading-relaxed break-words">{criterion.question_text}</p>
            </div>
          </div>
        ))}
        {color === 'green' && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200 text-blue-900">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            <p className="text-sm">
              These criteria are preloaded into the workflow page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
