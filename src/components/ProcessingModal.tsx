import React, { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { useModalDialog } from '../hooks/useModalDialog';
import { useMotionPresence } from '../hooks/useMotionPresence';

interface ProcessingModalProps {
  isOpen: boolean;
  status: string;
  topic?: string;
  operation?: 'generate' | 'rewrite';
  canCancel: boolean;
  onCancel: () => void;
}

// Display-only summary: the full original input still goes to the generation API.
export function summarizeGenerationTopic(topic: string): string {
  const characters = Array.from(topic.replace(/\s+/gu, ' ').trim());
  return characters.length > 48 ? `${characters.slice(0, 48).join('')}…` : characters.join('');
}

export const ProcessingModal: React.FC<ProcessingModalProps> = ({ isOpen, status, topic = '', operation = 'generate', canCancel, onCancel }) => {
  const { present, closing } = useMotionPresence(isOpen, 200);
  const ref = useModalDialog(present);
  const content = useRef({ status, topic, operation });
  const canceled = useRef(false);
  if (isOpen) content.current = { status, topic, operation };
  useEffect(() => { if (isOpen) canceled.current = false; }, [isOpen]);
  useEffect(() => {
    if (!present) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [present]);
  if (!present) return null;

  const saving = content.current.status === 'Saving';
  const summary = summarizeGenerationTopic(content.current.topic);
  const cancel = () => {
    if (!canCancel || closing || canceled.current) return;
    canceled.current = true;
    onCancel();
  };
  const title = saving ? '正在保存短文…' : content.current.operation === 'rewrite' ? '正在改写短文…' : '正在为你定制专属短文…';
  const description = saving ? '正在保存你的学习内容，请稍候。' : content.current.operation === 'rewrite' ? '正在调整短文内容，请稍候。' : summary ? `正在根据「${summary}」构思内容，请稍候。` : '正在根据你的学习要求构思内容，请稍候。';

  return (
    <dialog ref={ref} data-closing={closing || undefined} inert={closing}
      aria-labelledby="processing-title" aria-describedby="processing-description processing-note"
      onCancel={event => { event.preventDefault(); cancel(); }}
      className="app-dialog processing-dialog w-[calc(100%_-_2rem)]">
      <div className="processing-dialog__icon" aria-hidden="true"><Sparkles size={34} strokeWidth={1.8} /></div>
      <div role="status" aria-live="polite" aria-atomic="true">
        <h2 id="processing-title">{title}</h2>
        <p id="processing-description">{description}</p>
      </div>
      <button type="button" data-dialog-initial-focus disabled={!canCancel || closing} onClick={cancel} className="processing-dialog__cancel">
        {canCancel ? '取消本次操作' : '正在保存…'}
      </button>
      <div id="processing-note" className="processing-dialog__note">
        <p>取消不会更改已有短文或清空输入。</p>
        <p>已发送的 AI 请求仍可能计入额度。</p>
      </div>
    </dialog>
  );
};
