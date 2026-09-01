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
    if (activeLocale !== 'zh') return;
    let observing = false;
    const observe = () => {
      if (observing) return;
      observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title', 'aria-label'] });
      observing = true;
    };
    const stopObserving = () => { if (observing) observer.disconnect(); observing = false; };
    const translateWithoutSelfObservation = (nodes: Node[]) => {
      stopObserving();
      for (const node of nodes) translateSubtree(node, activeLocale);
      observer.takeRecords();
      observe();
    };
    const observer = new MutationObserver((mutations) => {
      const candidates = new Set<Node>();
      for (const mutation of mutations) {
        if (mutation.type === 'characterData' || mutation.type === 'attributes') candidates.add(mutation.target);
        else for (const node of mutation.addedNodes) candidates.add(node);
      }
      const nodes = [...candidates].filter((node) => {
        let parent = node.parentNode;
        while (parent) { if (candidates.has(parent)) return false; parent = parent.parentNode; }
        return true;
      });
      translateWithoutSelfObservation(nodes);
    });
    translateWithoutSelfObservation([root]);
    return stopObserving;
  }, [locale]);
  return null;
}
