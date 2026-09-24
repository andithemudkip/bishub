import { useEffect, useRef } from "react";

/**
 * Something another part of the remote wants a page to do on arrival —
 * search for a query, open a chapter. Quick Search navigates and then sends
 * one; the page usually mounts after that, so the intent waits here until a
 * page of the right kind picks it up, rather than being an event nobody hears.
 */
export type PageIntent =
  | { page: "hymns"; query: string }
  | { page: "bible"; query: string }
  | {
      page: "bible";
      open: { bookId: string; bookName: string; chapter: number; verse: number };
      /** What was typed to find it, for the page's search history. */
      query: string;
    };

const EVENT = "bishub:page-intent";
let pending: PageIntent | null = null;

export function sendPageIntent(intent: PageIntent) {
  pending = intent;
  window.dispatchEvent(new Event(EVENT));
}

export function usePageIntent<P extends PageIntent["page"]>(
  page: P,
  handler: (intent: Extract<PageIntent, { page: P }>) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const consume = () => {
      if (pending?.page !== page) return;
      const intent = pending as Extract<PageIntent, { page: P }>;
      pending = null;
      handlerRef.current(intent);
    };
    consume();
    window.addEventListener(EVENT, consume);
    return () => window.removeEventListener(EVENT, consume);
  }, [page]);
}
