import { useTranslation } from 'react-i18next';
import type { ExportFormat } from '@/shared/messages';
import { FileText, FileJson, FileCode, ClipboardCopy } from 'lucide-react';

interface ExportPanelProps {
  onExport: (format: ExportFormat) => void;
  orderCount: number;
}

const EXPORT_OPTIONS: { format: ExportFormat; labelKey: string; icon: typeof FileText; descKey: string }[] = [
  { format: 'csv', labelKey: 'exportPanel.csv', icon: FileText, descKey: 'exportPanel.csvDesc' },
  { format: 'json', labelKey: 'exportPanel.json', icon: FileJson, descKey: 'exportPanel.jsonDesc' },
  { format: 'html', labelKey: 'exportPanel.html', icon: FileCode, descKey: 'exportPanel.htmlDesc' },
  { format: 'clipboard', labelKey: 'exportPanel.clipboard', icon: ClipboardCopy, descKey: 'exportPanel.clipboardDesc' },
];

export function ExportPanel({ onExport, orderCount }: ExportPanelProps) {
  const { t } = useTranslation();

  return (
    <div className="px-4 py-3 bg-green-50 border-b border-green-100">
      <p className="text-xs text-green-700 mb-2 font-medium">
        {t('exportPanel.title', { count: orderCount })}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {EXPORT_OPTIONS.map(({ format, labelKey, icon: Icon, descKey }) => (
          <button
            key={format}
            onClick={() => onExport(format)}
            className="flex items-center gap-2 px-3 py-2 bg-white rounded-md border border-green-200 hover:border-green-400 hover:bg-green-50 transition-colors text-left"
          >
            <Icon size={16} className="text-green-600 flex-shrink-0" />
            <div>
              <div className="text-xs font-medium text-gray-800">{t(labelKey)}</div>
              <div className="text-[10px] text-gray-400">{t(descKey)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
