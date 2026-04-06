import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import JobsPanel from './components/jobs/JobsPanel';
import ResultsPanel from './components/results/ResultsPanel';
import { Home, Workflow, FlaskConical, ListChecks, ClipboardList, ChevronRight, BarChart2 } from 'lucide-react';
import CriteriaDemoPage from './components/demo/CriteriaDemoPage';
import WorkflowDemoPanel from './components/demo/WorkflowDemoPanel';

const queryClient = new QueryClient();

type Tab = 'home' | 'criteria' | 'workflow' | 'jobs' | 'results';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm sm:px-6 sm:py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
                SONAR eligibility workflow
              </h1>
              <p className="text-xs text-gray-500 sm:text-sm">
                Using language models to automate prescreening for clinical trials
              </p>
            </div>
            <span className="inline-flex px-2.5 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-500 text-[11px] font-medium lowercase tracking-wide">
              demo
            </span>
          </div>
        </header>

        {/* Navigation Tabs */}
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur lg:static lg:border-t-0 lg:border-b lg:px-6">
          <div className="flex justify-between lg:justify-start lg:gap-1 lg:min-w-max">
            <NavTab
              icon={<Home size={18} />}
              label="Home"
              active={activeTab === 'home'}
              onClick={() => setActiveTab('home')}
            />
            <NavTab
              icon={<ClipboardList size={18} />}
              label="Criteria Builder"
              active={activeTab === 'criteria'}
              onClick={() => setActiveTab('criteria')}
            />
            <NavTab
              icon={<Workflow size={18} />}
              label="Workflow Builder"
              active={activeTab === 'workflow'}
              onClick={() => setActiveTab('workflow')}
            />
            <NavTab
              icon={<ListChecks size={18} />}
              label="Jobs"
              active={activeTab === 'jobs'}
              onClick={() => setActiveTab('jobs')}
            />
            <NavTab
              icon={<BarChart2 size={18} />}
              label="Results"
              active={activeTab === 'results'}
              onClick={() => setActiveTab('results')}
            />
          </div>
        </nav>

        {/* Main Content — use CSS display to keep components mounted */}
        <main className="relative flex-1 overflow-hidden pb-20 lg:pb-0">
          <div className="h-full" style={{ display: activeTab === 'home' ? 'block' : 'none' }}>
            <HomePage setActiveTab={setActiveTab} />
          </div>
          <div className="h-full" style={{ display: activeTab === 'criteria' ? 'block' : 'none' }}>
            <CriteriaDemoPage onNext={() => setActiveTab('workflow')} />
          </div>
          <div className="h-full" style={{ display: activeTab === 'workflow' ? 'block' : 'none' }}>
            <WorkflowDemoPanel
              setActiveTab={(tab: string) => setActiveTab(tab as Tab)}
              onJobStarted={(jobId) => setFocusedJobId(jobId)}
            />
          </div>
          <div className="h-full" style={{ display: activeTab === 'jobs' ? 'block' : 'none' }}>
            <JobsPanel setActiveTab={(tab) => setActiveTab(tab as Tab)} setFocusedJobId={setFocusedJobId} />
          </div>
          <div className="h-full" style={{ display: activeTab === 'results' ? 'block' : 'none' }}>
            <ResultsPanel focusedJobId={focusedJobId} onFocusCleared={() => setFocusedJobId(null)} />
          </div>
        </main>
      </div>
    </QueryClientProvider>
  );
}

function NavTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-2 py-2.5 text-[11px] transition-colors lg:flex-none lg:flex-row lg:gap-2 lg:px-4 lg:py-3 lg:text-sm lg:border-b-2 ${
        active
          ? 'text-blue-600 bg-blue-50 lg:border-blue-500'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 lg:border-transparent'
      }`}
    >
      {icon}
      <span className="font-medium leading-none">{label}</span>
    </button>
  );
}

function HomePage({
  setActiveTab,
}: {
  setActiveTab: (tab: Tab) => void;
}) {
  return (
    <div className="h-full overflow-auto flex items-center justify-center p-5 sm:p-8">
      <div className="max-w-md w-full text-center">
        {/* Hero */}
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <FlaskConical size={32} className="text-blue-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-3 sm:text-4xl">
          SONAR eligibility workflow
        </h2>
        <p className="text-base text-gray-500 mb-8 sm:text-lg">
          Using language models to automate prescreening for clinical trials
        </p>

        <button
          onClick={() => setActiveTab('criteria')}
          className="inline-flex w-full items-center justify-center gap-2 px-8 py-3.5 bg-blue-600 text-white rounded-xl text-base font-semibold hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg sm:w-auto"
        >
          Start Screening
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  );
}

export default App;
