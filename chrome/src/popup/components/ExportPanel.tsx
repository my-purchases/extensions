import type { ExportFormat } from '@/shared/messages';
import { FileText, FileJson, FileCode, ClipboardCopy } from 'lucide-react';

interface ExportPanelProps {
  onExport: (format: ExportFormat) => void;
  orderCount: number;
}

const exportOptions: { format: ExportFormat; label: string; icon: typeof FileText; description: string }[] = [
  { format: 'csv', label: 'CSV', icon: FileText, description: 'Spreadsheet format' },
  { format: 'json', label: 'JSON', icon: FileJson, description: 'For My Purchases web app' },
  { format: 'html', label: 'HTML', icon: FileCode, description: 'Styled table view' },
  { format: 'clipboard', label: 'Clipboard', icon: ClipboardCopy, description: 'Paste to Google Sheets' },
];

export function ExportPanel({ onExport, orderCount }: ExportPanelProps) {
  return (
    <div className="px-4 py-3 bg-green-50 border-b border-green-100">
      <p className="text-xs text-green-700 mb-2 font-medium">
        Export {orderCount} order{orderCount !== 1 ? 's' : ''} as:
      </p>
      <div className="grid grid-cols-2 gap-2">
        {exportOptions.map(({ format, label, icon: Icon, description }) => (
          <button
            key={format}
            onClick={() => onExport(format)}
            className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border border-green-200 hover:border-green-400 hover:bg-green-50 transition-colors text-left"
          >
            <Icon size={16} className="text-green-600 flex-shrink-0" />
            <div>
              <div className="text-xs font-medium text-gray-800">{label}</div>
              <div className="text-[10px] text-gray-400">{description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
