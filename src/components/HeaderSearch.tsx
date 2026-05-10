/**
 * Header search affordance. Plain `<Link>` to `/search` rendered as an
 * icon button. The actual search input lives on the search page itself
 * and auto-runs with a debounced query, so the header stays simple
 * (no client JS, no controlled-input state, no focus-state CSS).
 */
import Link from "next/link";
import { Search } from "lucide-react";

export function HeaderSearch() {
  return (
    <Link
      href="/search"
      aria-label="Search"
      title="Search"
      className="flex h-9 w-9 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
    </Link>
  );
}
