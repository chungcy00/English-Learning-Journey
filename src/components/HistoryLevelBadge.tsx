import React from 'react';
import { cefrStyle } from '../utils/cefrVisuals';
export function HistoryLevelBadge({ level }: { level: string }) {
  return <span className="history-level-badge" style={cefrStyle(level)}>{level}</span>;
}
