/**
 * Section label linking to /sector/[slug]. Editorial-style: tracked
 * uppercase plain text in muted-foreground, no fill, no border, no
 * pill. The hover state lifts the color to foreground rather than
 * recoloring with accent, keeping accent reserved for active/focus
 * affordances per the design principle "accent is a verb, not a noun".
 */
import Link from "next/link";

import { cn } from "@/lib/utils";

export interface SectorChipProps {
  slug: string;
  name: string;
  className?: string;
  /** When true, render as a non-link span (used for visual context). */
  asStatic?: boolean;
}

const baseClasses =
  "inline-block text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground";
const linkClasses =
  "transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline focus-visible:text-foreground";

export function SectorChip({
  slug,
  name,
  className,
  asStatic,
}: SectorChipProps) {
  if (asStatic) {
    return <span className={cn(baseClasses, className)}>{name}</span>;
  }
  return (
    <Link
      href={`/sector/${slug}`}
      className={cn(baseClasses, linkClasses, className)}
    >
      {name}
    </Link>
  );
}
