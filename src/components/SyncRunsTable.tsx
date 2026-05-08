/**
 * Reusable, accessible table of recent `sync_runs` rows. Used by both
 * the public `/sync-status` page and the Basic-Auth-protected
 * `/admin/sync` page so the operational view stays consistent.
 *
 * Status cell uses a coloured pill (green = ok, red = failed,
 * neutral = anything else) plus the underlying text, so screen readers
 * are not relying on colour alone (WCAG 1.4.1).
 */
import type { SyncRunFields } from "@/src/lib/fragments";

const NOTES_TRUNCATE = 60;

export interface SyncRunsTableProps {
  rows: SyncRunFields[];
}

function formatTimestamp(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "Z");
}

function truncate(value: string | null): string {
  if (!value) return "";
  if (value.length <= NOTES_TRUNCATE) return value;
  return `${value.slice(0, NOTES_TRUNCATE).trimEnd()}...`;
}

function statusClasses(status: string): string {
  if (status === "ok") {
    return "bg-emerald-100 text-emerald-900";
  }
  if (status === "failed" || status === "error") {
    return "bg-red-100 text-red-900";
  }
  return "bg-muted text-muted-foreground";
}

export function SyncRunsTable({ rows }: SyncRunsTableProps) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No sync runs recorded yet.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="min-w-full divide-y divide-border text-left text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">ID</th>
            <th scope="col" className="px-3 py-2 font-medium">Started</th>
            <th scope="col" className="px-3 py-2 font-medium">Finished</th>
            <th scope="col" className="px-3 py-2 font-medium">Upserted</th>
            <th scope="col" className="px-3 py-2 font-medium">Errors</th>
            <th scope="col" className="px-3 py-2 font-medium">Status</th>
            <th scope="col" className="px-3 py-2 font-medium">Notes</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {formatTimestamp(row.startedAt)}
              </td>
              <td className="px-3 py-2 font-mono text-xs">
                {formatTimestamp(row.finishedAt)}
              </td>
              <td className="px-3 py-2 tabular-nums">{row.postsUpserted}</td>
              <td className="px-3 py-2 tabular-nums">{row.errors}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClasses(
                    row.status,
                  )}`}
                >
                  {row.status}
                </span>
              </td>
              <td
                className="px-3 py-2 text-xs text-muted-foreground"
                title={row.notes ?? undefined}
              >
                {truncate(row.notes)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
