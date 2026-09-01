export type AgentExecutionTraceStep = {
  stage: string;
  label: string;
  detail: string;
  status: 'in_progress' | 'completed' | 'failed';
  startedAt: string;
  completedAt: string | null;
};

export type AgentReasoningSummaryStep = {
  title: string;
  detail: string;
  evidenceRefs: string[];
};

function numberFromDetail(detail: string) {
  return detail.match(/\d[\d,]*/)?.[0] || null;
}

function localizedTrace(step: AgentExecutionTraceStep, zh: boolean) {
  if (!zh) return step;
  const count = numberFromDetail(step.detail);
  const labels: Record<string, string> = {
    preparing: step.status === 'completed' ? '运行准备完成' : '准备分析',
    images_validated: '图片已校验',
    evidence_frozen: step.status === 'completed' ? '证据已冻结' : '正在冻结证据',
    model_running: step.status === 'completed' ? '模型响应已返回' : 'Agent 正在分析',
    output_validated: '输出已校验',
    persisting: step.status === 'completed' ? '验证结果已保存' : '正在保存验证结果',
    completed: '运行已完成',
  };
  const details: Record<string, string> = {
    preparing: step.status === 'completed' ? '所选专家、分析范围和模型服务商已通过就绪检查。' : '正在检查所选专家、分析范围、模型服务商和用量规则。',
    images_validated: `${count || '所附'} 张图片已通过类型、大小和文件签名校验，并发送给当前配置的模型。`,
    evidence_frozen: step.status === 'completed' ? `${count || '本次'} 条受限证据记录已锁定到本次运行。` : '正在收集本次运行可使用的当前证据和对话上下文。',
    model_running: step.status === 'completed' ? `模型调用已真实返回${count ? `，输出 ${count} tokens` : ''}，现已进入结果校验。` : '模型正在比较已冻结证据，并生成带引用的可读推理摘要和发现。',
    output_validated: `${count || '本次'} 条发现及推理摘要已通过结构和证据引用校验。`,
    persisting: step.status === 'completed' ? '回答、用量、建议任务、执行轨迹和证据快照均已写入。' : '正在把校验后的回答、用量、建议任务和执行轨迹写入本次对话。',
    completed: `${count || '本次运行的'} model tokens 已与证据快照一起记录。`,
  };
  return { ...step, label: labels[step.stage] || step.label, detail: step.status === 'failed' ? step.detail : details[step.stage] || step.detail };
}

export function AgentRunTrace({ trace, zh, duration, live = false }: { trace: AgentExecutionTraceStep[]; zh: boolean; duration?: string | null; live?: boolean }) {
  const visible = trace.length ? trace : live
    ? [{ stage: 'waiting', label: zh ? '等待服务器事件' : 'Waiting for server event', detail: zh ? '连接已经建立，正在等待第一条真实执行事件。' : 'The connection is open and waiting for the first real execution event.', status: 'in_progress' as const, startedAt: new Date(0).toISOString(), completedAt: null }]
    : [{ stage: 'legacy', label: zh ? '旧版运行' : 'Legacy run', detail: zh ? '该回答完成于执行轨迹功能上线前，因此没有保存逐步事件。' : 'This answer predates execution-trace recording, so step-level events are unavailable.', status: 'completed' as const, startedAt: new Date(0).toISOString(), completedAt: new Date(0).toISOString() }];
  return <details className={live ? 'agent-run-trace agent-run-trace-live' : 'agent-run-trace'} open={live}>
    <summary>{zh ? '真实执行轨迹' : 'Verified execution trace'}{duration ? ` · ${duration}` : ''}</summary>
    <div className="agent-trace-list">{visible.map((raw) => {
      const step = localizedTrace(raw, zh);
      return <div className="agent-trace-step" data-status={step.status} key={step.stage}>
        <i aria-hidden="true" />
        <div><b>{step.status === 'completed' ? (zh ? '已完成：' : 'Completed: ') : step.status === 'failed' ? (zh ? '失败：' : 'Failed: ') : (zh ? '进行中：' : 'In progress: ')}{step.label}</b><span>{step.detail}</span></div>
      </div>;
    })}</div>
  </details>;
}

export function AgentReasoningSummary({ steps, zh }: { steps: AgentReasoningSummaryStep[]; zh: boolean }) {
  if (!steps.length) return null;
  return <section className="agent-reasoning-summary">
    <header><span>{zh ? '可读推理摘要' : 'Readable reasoning summary'}</span><small>{zh ? '经过整理且有证据支持，不是原始思维链' : 'Evidence-backed summary, not private chain-of-thought'}</small></header>
    <ol>{steps.map((step, index) => <li key={`${step.title}-${index}`}><b>{step.title}</b><p>{step.detail}</p><small>{zh ? `${step.evidenceRefs.length} 条证据引用` : `${step.evidenceRefs.length} evidence reference${step.evidenceRefs.length === 1 ? '' : 's'}`}</small></li>)}</ol>
  </section>;
}
