'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type MarketplaceSkillCard = {
  slug: string; name: string; summary: string; publisher: string; version: string; basePreset: string; requiredMetrics: string[]; sourceUrl: string; reviewedAt: string;
  installState: 'available' | 'active' | 'disabled' | 'update' | 'newer' | 'conflict';
};

export function MarketplaceSkills({ skills, canManage }: { skills: MarketplaceSkillCard[]; canManage: boolean }) {
  const router = useRouter(); const [pending, setPending] = useState<string | null>(null); const [message, setMessage] = useState('');
  async function install(slug: string) {
    setPending(slug); setMessage('');
    const response = await fetch('/api/marketplace/skills', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug }) });
    const result = await response.json() as { error?: string; unchanged?: boolean };
    setPending(null); setMessage(result.error || (result.unchanged ? 'Skill is active and already matches the reviewed catalog version.' : 'Reviewed Skill installed. New analysis runs will freeze its version and instruction fingerprint.'));
    if (response.ok) router.refresh();
  }
  return <><div className="marketplace-grid">{skills.map((skill) => <article className="marketplace-card" key={skill.slug} data-state={skill.installState}>
    <header><div><span>AGENT SKILL</span><h2>{skill.name}</h2></div><b>{skill.installState.replaceAll('_', ' ')}</b></header>
    <p>{skill.summary}</p>
    <div className="marketplace-meta"><span>v{skill.version}</span><span>{skill.basePreset.replaceAll('_', ' ')}</span><span>{skill.publisher}</span></div>
    <div className="marketplace-signals">{skill.requiredMetrics.length ? skill.requiredMetrics.map((metric) => <code key={metric}>{metric}</code>) : <code>all matching evidence</code>}</div>
    <footer><span><strong>Maintainer reviewed</strong><small>Policy v1 · {skill.reviewedAt}</small><a href={skill.sourceUrl} target="_blank" rel="noreferrer">Inspect source ↗</a></span><button className="app-primary" disabled={!canManage || pending !== null || ['active', 'newer', 'conflict'].includes(skill.installState)} onClick={() => install(skill.slug)}>{pending === skill.slug ? 'Installing…' : skill.installState === 'update' ? 'Update' : skill.installState === 'disabled' ? 'Re-enable' : skill.installState === 'active' ? 'Installed' : skill.installState === 'newer' ? 'Newer version installed' : skill.installState === 'conflict' ? 'Slug conflict' : 'Install Skill'}</button></footer>
  </article>)}</div>{message && <p className="marketplace-message" role="status">{message}</p>}</>;
}
