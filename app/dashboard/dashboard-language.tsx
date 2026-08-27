'use client';

import { useLayoutEffect } from 'react';
import { translateDashboard } from './dashboard-translations';

type TextState = { source: string; rendered: string };
const textState = new WeakMap<Text, TextState>();
const attributeState = new WeakMap<object, Map<string, TextState>>();

function translateText(text: Text, locale: string) {
  const chinese = locale === 'zh';
  const parent = text.parentElement;
  if (!parent || parent.closest('script,style,code,pre,textarea')) return;
  const current = text.nodeValue || ''; const trimmed = current.trim();
  if (!trimmed) return;
  const previous = textState.get(text); const source = previous && current === previous.rendered ? previous.source : trimmed;
  const translated = chinese ? translateDashboard(source) : source;
  const rendered = current.replace(trimmed, translated);
  textState.set(text, { source, rendered });
  if (current !== rendered) text.nodeValue = rendered;
}

function translateAttributes(element: Element, locale: string) {
  const chinese = locale === 'zh';
  const states = attributeState.get(element) || new Map<string, TextState>();
  for (const name of ['placeholder', 'title', 'aria-label']) {
    const current = element.getAttribute(name); if (!current) continue;
    const previous = states.get(name); const source = previous && current === previous.rendered ? previous.source : current;
    const rendered = chinese ? translateDashboard(source) : source;
    states.set(name, { source, rendered }); if (current !== rendered) element.setAttribute(name, rendered);
  }
  attributeState.set(element, states);
}

function translateSubtree(root: Node, locale: string) {
  if (root.nodeType === Node.TEXT_NODE) { translateText(root as Text, locale); return; }
  if (root instanceof Element) translateAttributes(root, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) { translateText(node as Text, locale); node = walker.nextNode(); }
  if (root instanceof Element) {
    for (const element of root.querySelectorAll('[placeholder],[title],[aria-label]')) translateAttributes(element, locale);
  }
}

export function DashboardLanguage({ locale }: { locale: string }) {
  useLayoutEffect(() => {
    const activeLocale = locale;
    document.documentElement.lang = activeLocale === 'zh' ? 'zh-CN' : 'en';
    const root = document.querySelector('.product-app') as unknown as Node | null; if (!root) return;
    translateSubtree(root, activeLocale);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateSubtree(mutation.target, activeLocale);
        else if (mutation.type === 'attributes' && mutation.target instanceof Element) translateAttributes(mutation.target, activeLocale);
        else for (const node of mutation.addedNodes) translateSubtree(node, activeLocale);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
    return () => { observer.disconnect(); };
  }, [locale]);
  return null;
}
