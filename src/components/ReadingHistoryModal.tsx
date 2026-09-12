import React, { useState } from 'react';
import { Search, Trash2, Calendar, FileText, ArrowUpRight, X } from 'lucide-react';
import { ReadingRecord } from '../types';

interface ReadingHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  readings: ReadingRecord[];
  onSelectReading: (reading: ReadingRecord) => void;
  onDeleteReading: (readingId: string) => void;
}

export const ReadingHistoryModal: React.FC<ReadingHistoryModalProps> = ({
  isOpen,
  onClose,
  readings,
  onSelectReading,
  onDeleteReading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filtered = readings.filter(r =>
    r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#292B25]/40 backdrop-blur-xs">
      <div className="w-full max-w-2xl bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm p-6 sm:p-8 shadow-xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#D4CCBC]">
          <div>
            <h2 className="font-editorial text-2xl font-semibold text-[#292B25]">
              阅读历史记录 (Reading History)
            </h2>
            <p className="text-xs text-[#717265] font-ui">
              共保存 {readings.length} 篇学习短文
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-sm text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="py-3 border-b border-[#D4CCBC]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#717265] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索短文标题、主题或正文..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-[#F2EEE4] border border-[#D4CCBC] rounded-sm focus:outline-none focus:border-[#73785E] font-ui text-[#292B25]"
            />
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-[#A5AA91] font-ui py-8">
              未找到匹配的短文记录
            </p>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                className="group p-4 bg-[#E5DED0]/40 hover:bg-[#E5DED0]/80 border border-[#D4CCBC] rounded-sm transition-all flex items-start justify-between gap-4"
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => {
                    onSelectReading(item);
                    onClose();
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-ui font-semibold px-2 py-0.5 bg-[#F2EEE4] text-[#73785E] border border-[#D4CCBC] rounded-xs uppercase">
                      {item.cefrLevel}
                    </span>
                    <span className="text-xs text-[#717265] font-ui capitalize">
                      {item.readingType}
                    </span>
                    {item.humanised && (
                      <span className="text-[10px] text-[#5F654D] font-ui px-1.5 py-0.2 bg-[#73785E]/10 rounded-xs">
                        Humanised
                      </span>
                    )}
                  </div>

                  <h3 className="font-editorial text-lg font-semibold text-[#292B25] group-hover:text-[#5F654D] transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-xs text-[#717265] font-editorial line-clamp-2 mt-1">
                    {item.content.replace(/\n/g, ' ')}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-[11px] text-[#717265] font-ui">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                    <span>•</span>
                    <span>{item.selectedVocabulary?.length || 0} 词汇</span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      onSelectReading(item);
                      onClose();
                    }}
                    title="打开阅读"
                    className="p-1.5 text-[#73785E] hover:bg-[#F2EEE4] rounded-sm transition-colors"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`确定删除短文 "${item.title}" 吗？`)) {
                        onDeleteReading(item.id);
                      }
                    }}
                    title="删除"
                    className="p-1.5 text-[#717265] hover:text-[#9E6554] hover:bg-[#F2EEE4] rounded-sm transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#D4CCBC] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-ui text-[#717265] hover:text-[#292B25] hover:bg-[#E5DED0] rounded-sm"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
