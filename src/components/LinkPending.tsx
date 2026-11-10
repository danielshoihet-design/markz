"use client";

import { useLinkStatus } from "next/link";

/**
 * Tap feedback for a `<Link>`: a soft pulse over the link while the next page
 * is still loading. Must be rendered inside the `<Link>` it reports on, and the
 * link needs `position: relative`. It only appears if navigation takes longer
 * than ~100ms, so fast transitions do not flash.
 */
export function LinkPending() {
  const { pending } = useLinkStatus();
  return <span aria-hidden className={`link-pending ${pending ? "is-pending" : ""}`} />;
}
