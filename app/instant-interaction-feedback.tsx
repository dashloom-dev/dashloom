'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const NAVIGATION_TIMEOUT_MS = 12_000;
const ACTION_FEEDBACK_MS = 650;
const PRESS_FEEDBACK_MS = 180;

function internalDestination(anchor: HTMLAnchorElement) {
  if (anchor.target && anchor.target !== '_self') return null;
  if (anchor.hasAttribute('download')) return null;

  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#')) return null;

  const destination = new URL(anchor.href, window.location.href);
  if (destination.origin !== window.location.origin) return null;
  if (destination.pathname.startsWith('/api/')) return null;

  const current = new URL(window.location.href);
  if (
    destination.pathname === current.pathname &&
    destination.search === current.search &&
    destination.hash !== current.hash
  ) return null;
  if (destination.href === current.href) return null;

  return `${destination.pathname}${destination.search}${destination.hash}`;
}

function clearInteractionAttributes() {
  document.querySelectorAll<HTMLElement>('[data-instant-pressed], [data-instant-action], [data-instant-navigation]')
    .forEach((element) => {
      delete element.dataset.instantPressed;
      delete element.dataset.instantAction;
      delete element.dataset.instantNavigation;
    });
}

export function InstantInteractionFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [navigationOrigin, setNavigationOrigin] = useState<string | null>(null);
  const navigating = navigationOrigin === routeKey;
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigationDestination = useRef<string | null>(null);

  const finishNavigation = useCallback(() => {
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    navigationTimer.current = null;
    navigationDestination.current = null;
    setNavigationOrigin(null);
    clearInteractionAttributes();
  }, []);

  const recoverNavigation = useCallback(() => {
    const destination = navigationDestination.current;
    if (!destination) {
      finishNavigation();
      return;
    }
    window.location.assign(destination);
  }, [finishNavigation]);

  const startNavigation = useCallback((anchor: HTMLAnchorElement) => {
    const destination = internalDestination(anchor);
    if (!destination) return;
    anchor.dataset.instantNavigation = 'pending';
    navigationDestination.current = destination;
    setNavigationOrigin(routeKey);
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    navigationTimer.current = setTimeout(recoverNavigation, NAVIGATION_TIMEOUT_MS);
  }, [recoverNavigation, routeKey]);

  useEffect(() => {
    if (navigationTimer.current) clearTimeout(navigationTimer.current);
    navigationTimer.current = null;
    navigationDestination.current = null;
    clearInteractionAttributes();
  }, [routeKey]);

  useEffect(() => {
    const showPress = (element: HTMLElement) => {
      element.dataset.instantPressed = 'true';
      window.setTimeout(() => delete element.dataset.instantPressed, PRESS_FEEDBACK_MS);
    };

    const showAction = (element: HTMLElement, minimumMs = 0) => {
      element.dataset.instantAction = 'pending';
      window.setTimeout(() => {
        if (!element.matches(':disabled, [aria-busy="true"]')) {
          delete element.dataset.instantAction;
          return;
        }

        const observer = new MutationObserver(() => {
          if (!element.matches(':disabled, [aria-busy="true"]')) {
            delete element.dataset.instantAction;
            observer.disconnect();
          }
        });
        observer.observe(element, { attributes: true, attributeFilter: ['disabled', 'aria-busy'] });
        window.setTimeout(() => {
          delete element.dataset.instantAction;
          observer.disconnect();
        }, NAVIGATION_TIMEOUT_MS);
      }, minimumMs);
    };

    const findInteractive = (target: EventTarget | null) =>
      target instanceof Element
        ? target.closest<HTMLElement>('button, input[type="button"], input[type="submit"], [role="button"], a[href]')
        : null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const element = findInteractive(event.target);
      if (element && !element.matches(':disabled, [aria-disabled="true"]')) showPress(element);
    };

    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const element = findInteractive(event.target);
      if (!element || element.matches(':disabled, [aria-disabled="true"]')) return;

      queueMicrotask(() => {
        const anchor = element.closest<HTMLAnchorElement>('a[href]');
        if (anchor && internalDestination(anchor)) {
          startNavigation(anchor);
          return;
        }
        if (event.defaultPrevented) return;
        const isSubmitter = (
          element instanceof HTMLButtonElement && element.type === 'submit'
        ) || (
          element instanceof HTMLInputElement && element.type === 'submit'
        );
        if (!isSubmitter && element.matches('button, input[type="button"], [role="button"]')) showAction(element);
      });
    };

    const onSubmit = (event: SubmitEvent) => {
      const submitter = event.submitter;
      if (submitter instanceof HTMLElement) showAction(submitter, ACTION_FEEDBACK_MS);
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      finishNavigation();
    };
  }, [finishNavigation, startNavigation]);

  return (
    <div
      aria-hidden={!navigating}
      className="instant-navigation-progress"
      data-active={navigating ? 'true' : 'false'}
      role="progressbar"
      aria-label="Loading page"
    ><span /></div>
  );
}
