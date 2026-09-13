import React, { useState } from 'react';
import { ArrowUpRight, Calendar, History, Search, Trash2 } from 'lucide-react';
import { ReadingRecord } from '../types';

interface ReadingHistoryViewProps {
  readings: ReadingRecord[];
  onSelectReading: (reading: ReadingRecord) => void;
  onDeleteReading: (readingId: string) => void;
}

export const ReadingHistoryView: React.FC<ReadingHistoryViewProps> = ({
  readings,
  onSelectReading,
  onDeleteReading,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = readings.filter((reading) =>
    !normalizedQuery ||
    reading.title.toLowerCase().includes(normalizedQuery) ||
    reading.topic.toLowerCase().includes(normalizedQuery) ||
    reading.content.toLowerCase().includes(normalizedQuery)
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="border-b border-[#D4CCBC] pb-5">
        <div className="mb-2 flex items-center gap-2 text-[#73785E]">
          <History className="h-5 w-5" />
          <span className="font-ui text-xs font-semibold uppercase tracking-wider">Reading History</span>
        </div>
        <h1 className="font-editorial text-3xl font-semibold text-[#292B25] sm:text-4xl">
          阅读历史记录
        </h1>
        <p className="mt-2 font-ui text-sm text-[#717265]">
          共保存 {readings.length} 篇学习短文
        </p>
      </header>

      <div className="border-b border-[#D4CCBC] py-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#717265]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索短文标题、主题或正文..."
            className="w-full rounded-sm border border-[#D4CCBC] bg-[#FAF7F2] py-2.5 pl-9 pr-3 font-ui text-sm text-[#292B25] focus:border-[#73785E] focus:outline-none"
          />
        </div>
      </div>

      <div className="space-y-3 py-5">
        {filtered.length === 0 ? (
          <div className="rounded-sm border border-[#D4CCBC] bg-[#FAF7F2] px-4 py-12 text-center">
            <History className="mx-auto h-8 w-8 text-[#A5AA91]" />
            <p className="mt-3 font-ui text-sm text-[#A5AA91]">
              {readings.length === 0 ? '还没有保存的短文记录' : '未找到匹配的短文记录'}
            </p>
          </div>
        ) : (
          filtered.map((item) => (
            <article
              key={item.id}
              className="group flex items-start justify-between gap-3 rounded-sm border border-[#D4CCBC] bg-[#E5DED0]/40 p-4 transition-colors hover:bg-[#E5DED0]/80 sm:p-5"
            >
              <button
                type="button"
                onClick={() => onSelectReading(item)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-xs border border-[#D4CCBC] bg-[#F2EEE4] px-2 py-0.5 font-ui text-[11px] font-semibold uppercase text-[#73785E]">
                    {item.cefrLevel}
                  </span>
                  <span className="font-ui text-xs capitalize text-[#717265]">
                    {item.readingType}
                  </span>
                  {item.humanised ? (
                    <span className="rounded-xs bg-[#73785E]/10 px-1.5 py-0.5 font-ui text-[10px] text-[#5F654D]">
                      Humanised
                    </span>
                  ) : null}
                </div>

                <h2 className="font-editorial text-lg font-semibold leading-tight text-[#292B25] transition-colors group-hover:text-[#5F654D] sm:text-xl">
                  {item.title}
                </h2>
                <p className="mt-2 line-clamp-2 font-editorial text-sm text-[#717265]">
                  {item.content.replace(/\n/g, ' ')}
                </p>
                <div className="mt-3 flex items-center gap-3 font-ui text-[11px] text-[#717265]">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(item.createdAt).toLocaleDateString()}
                  </span>
                  <span aria-hidden="true">•</span>
                  <span>{item.selectedVocabulary?.length || 0} 词汇</span>
                </div>
              </button>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSelectReading(item)}
                  title="打开阅读"
                  aria-label={`打开 ${item.title}`}
                  className="rounded-sm p-2 text-[#73785E] transition-colors hover:bg-[#F2EEE4]"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`确定删除短文 “${item.title}” 吗？`)) {
                      onDeleteReading(item.id);
                    }
                  }}
                  title="删除"
                  aria-label={`删除 ${item.title}`}
                  className="rounded-sm p-2 text-[#717265] transition-colors hover:bg-[#F2EEE4] hover:text-[#9E6554]"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
};
