'use client';

import { useEffect } from 'react';
import { translateDashboard } from './dashboard-translations';

type TextState = { source: string; rendered: string };
const textState = new WeakMap<Text, TextState>();
const attributeState = new WeakMap<object, Map<string, TextState>>();

type AttributeTarget = { getAttribute(name: string): string | null; setAttribute(name: string, value: string): void };

function translateTree(root: Node, locale: string) {
  const chinese = locale === 'zh';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    const text = node as Text; const parent = text.parentElement;
    if (parent && !parent.closest('script,style,code,pre,textarea')) {
      const current = text.nodeValue || ''; const trimmed = current.trim();
      if (trimmed) {
        const previous = textState.get(text); const source = previous && current === previous.rendered ? previous.source : trimmed;
        const translated = chinese ? translateDashboard(source) : source;
        const rendered = current.replace(trimmed, translated);
        textState.set(text, { source, rendered });
        if (current !== rendered) text.nodeValue = rendered;
      }
    }
    node = walker.nextNode();
  }
  const elements = (root as unknown as { querySelectorAll?: (selector: string) => Iterable<AttributeTarget> }).querySelectorAll?.('[placeholder],[title],[aria-label]') || [];
  for (const element of elements) {
    const states = attributeState.get(element) || new Map<string, TextState>();
    for (const name of ['placeholder', 'title', 'aria-label']) {
      const current = element.getAttribute(name); if (!current) continue;
      const previous = states.get(name); const source = previous && current === previous.rendered ? previous.source : current;
      const rendered = chinese ? translateDashboard(source) : source;
      states.set(name, { source, rendered }); if (current !== rendered) element.setAttribute(name, rendered);
    }
    attributeState.set(element, states);
  }
}

export function DashboardLanguage({ locale }: { locale: string }) {
  useEffect(() => {
    let activeLocale = locale;
    document.documentElement.lang = activeLocale === 'zh' ? 'zh-CN' : 'en';
    const root = document.querySelector('.product-app') as unknown as Node | null; if (!root) return;
    let timer = window.setTimeout(() => translateTree(root, activeLocale), 800);
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(() => translateTree(root, activeLocale), 450); };
    const observer = new MutationObserver(schedule);
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    const change = (event: Event) => { activeLocale = (event as CustomEvent<string>).detail; document.documentElement.lang = activeLocale === 'zh' ? 'zh-CN' : 'en'; translateTree(root, activeLocale); };
    window.addEventListener('dashloom:locale', change);
    return () => { window.clearTimeout(timer); observer.disconnect(); window.removeEventListener('dashloom:locale', change); };
  }, [locale]);
  return null;
}
