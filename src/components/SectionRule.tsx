/**
 * Newspaper-style section divider. Two horizontal rules of different
 * weight bracket a small-caps tracked label, mirroring the band
 * dividers WSJ and NYT use to break the front page into named
 * sections. The thick rule on top + thin rule below establishes a
 * clear "this is a new section" signal without competing with the
 * editorial type below it.
 */
import { cn } from "@/lib/utils";

export interface SectionRuleProps {
  label: string;
  id?: string;
  align?: "left" | "center";
  className?: string;
  children?: React.ReactNode;
}

export function SectionRule({
  label,
  id,
  align = "left",
  className,
  children,
}: SectionRuleProps) {
  return (
    <div
      className={cn(
        "border-t-2 border-b border-foreground/90",
        className,
      )}
    >
      <div
        className={cn(
          "flex items-baseline gap-4 py-2",
          align === "center" ? "justify-center" : "justify-between",
        )}
      >
        <h2
          id={id}
          className="font-sans text-[11px] font-semibold uppercase tracking-[0.32em] text-foreground"
        >
          {label}
        </h2>
        {children ? (
          <span className="font-sans text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            {children}
          </span>
        ) : null}
      </div>
    </div>
  );
}
