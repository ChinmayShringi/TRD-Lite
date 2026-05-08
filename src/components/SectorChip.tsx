/**
 * Small pill-shaped chip linking to /sector/[slug]. Used both inside
 * cards (to label the primary sector) and in the homepage chip row.
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
  "inline-flex items-center rounded-full border border-accent/20 bg-accent/8 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider text-accent transition-colors";
const hoverClasses =
  "hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

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
      className={cn(baseClasses, hoverClasses, className)}
    >
      {name}
    </Link>
  );
}
