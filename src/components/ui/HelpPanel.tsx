import { HelpCircle, X } from 'lucide-react';

export function HelpButton({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`p-2 rounded-lg transition-colors ${
        isOpen
          ? 'bg-blue-100 text-blue-700'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
      }`}
      title="Toggle help"
    >
      <HelpCircle size={20} />
    </button>
  );
}

export function HelpPanel({
  isOpen,
  onToggle,
  children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
      }`}
    >
      <div className="bg-blue-50 border-b border-blue-200 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">{children}</div>
          <button
            onClick={onToggle}
            className="p-1 text-blue-400 hover:text-blue-600 flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
