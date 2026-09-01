'use client';

import { guidedMetricLabel, type GuidedMetricMapping, type GuidedMetricSuggestion } from '@/lib/business-data-discovery';

export const businessCurrencies = ['USD', 'CNY', 'EUR', 'GBP', 'JPY'] as const;

export function BusinessConnectionSteps({ active, zh, labels: suppliedLabels }: { active: 1 | 2 | 3 | 4; zh: boolean; labels?: string[] }) {
  const labels = suppliedLabels || (zh ? ['连接', '自动识别', '确认字段', '预览同步'] : ['Connect', 'Discover', 'Confirm fields', 'Preview & sync']);
  return <ol className="connection-steps business-connection-steps">{labels.map((label, index) => <li key={label} data-state={active === index + 1 ? 'active' : active > index + 1 ? 'complete' : 'pending'}><b>{index + 1}</b><span>{label}</span></li>)}</ol>;
}

export function BusinessDiscoveryFields({ suggestions, selected, onSelect, sourceLabel, zh }: {
  suggestions: GuidedMetricSuggestion[];
  selected: Record<string, string>;
  onSelect: (metric: string, reason: string) => void;
  sourceLabel: string;
  zh: boolean;
}) {
  if (!suggestions.some((suggestion) => suggestion.options.length)) return <div className="business-discovery-empty">{zh ? '没有找到可安全识别的业务字段。请检查只读权限，或使用开发者高级设置。' : 'No business fields could be identified safely. Check read access or use developer advanced settings.'}</div>;
  return <section className="business-discovery-results" aria-live="polite">
    <header><span>{zh ? '业务指标' : 'Business metric'}</span><span>{zh ? `检测到的来源（${sourceLabel}）` : `Detected source (${sourceLabel})`}</span><span>{zh ? '置信度' : 'Confidence'}</span></header>
    {suggestions.map((suggestion) => {
      const value = selected[suggestion.metric] || suggestion.options[0]?.reason || '';
      const mapping = suggestion.options.find((option) => option.reason === value) || suggestion.options[0];
      return <div className="business-discovery-row" key={suggestion.metric}>
        <strong>{guidedMetricLabel(suggestion.metric, zh)}</strong>
        <select aria-label={`${guidedMetricLabel(suggestion.metric, zh)} ${zh ? '来源字段' : 'source field'}`} value={value} disabled={!mapping} onChange={(event) => onSelect(suggestion.metric, event.target.value)}>{!mapping && <option value="">{zh ? '未找到可靠字段（将跳过）' : 'No reliable field found (skip)'}</option>}{suggestion.options.map((option) => <option value={option.reason} key={`${suggestion.metric}-${option.reason}`}>{mappingDisplay(option)}</option>)}</select>
        <span data-confidence={mapping?.confidence || 'none'}><b>{!mapping ? (zh ? '未识别' : 'Not detected') : mapping.confidence === 'high' ? (zh ? '高置信度' : 'High confidence') : mapping.confidence === 'medium' ? (zh ? '中等置信度' : 'Medium confidence') : (zh ? '请确认' : 'Review')}</b><small>{mapping ? confidenceReason(suggestion.metric, zh) : (zh ? '不会导入该指标' : 'This metric will not be imported')}</small></span>
      </div>;
    })}
  </section>;
}

function mappingDisplay(mapping: GuidedMetricMapping) {
  const column = mapping.metric === 'signups' && mapping.dateColumn
    ? mapping.dateColumn
    : mapping.metric === 'active_subscriptions' && mapping.filterColumn
      ? mapping.filterColumn
      : mapping.valueColumn;
  return `${mapping.resource}.${column}`;
}

function confidenceReason(metric: GuidedMetricMapping['metric'], zh: boolean) {
  const reasons: Record<GuidedMetricMapping['metric'], [string, string]> = {
    revenue: ['Based on transaction amount fields', '基于交易金额字段识别'],
    orders: ['Based on order keys and dates', '基于订单键与日期识别'],
    signups: ['Based on account creation dates', '基于用户创建时间识别'],
    active_subscriptions: ['Based on subscription status fields', '基于订阅状态字段识别'],
  };
  return reasons[metric][zh ? 1 : 0];
}

export function selectedGuidedMappings(suggestions: GuidedMetricSuggestion[], selected: Record<string, string>): GuidedMetricMapping[] {
  return suggestions.flatMap((suggestion) => {
    const reason = selected[suggestion.metric] || suggestion.options[0]?.reason;
    const mapping = suggestion.options.find((option) => option.reason === reason);
    return mapping ? [mapping] : [];
  });
}
