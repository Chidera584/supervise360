import { Cpu, CheckCircle2, Clock } from 'lucide-react';
import type { SolverStatus } from '../../types/database';

/**
 * Shows which path actually produced the last group-formation / supervisor-assignment result:
 * the Potassco Clingo (ASP) solver, or the deterministic heuristic fallback. Makes the ASP
 * contribution demonstrable instead of only visible in server logs.
 */
export function SolverStatusBadge({ status }: { status: SolverStatus | null }) {
  if (!status) return null;

  if (status.path === 'heuristic') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-sm">
        <Clock className="w-4 h-4 text-slate-500" />
        <span>
          Heuristic algorithm used
          {status.message ? ` — ${status.message}` : ' — the ASP solver was unavailable, unsatisfiable, or did not respond in time'}
        </span>
      </div>
    );
  }

  const seconds = status.solveTimeMs != null ? (status.solveTimeMs / 1000).toFixed(status.solveTimeMs >= 1000 ? 1 : 2) : null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 text-sm">
      <Cpu className="w-4 h-4 text-teal-600" />
      <span className="font-medium">Potassco Clingo (ASP) solver used</span>
      {seconds != null && (
        <span className="text-teal-700/80">• solved in {seconds}s</span>
      )}
      {status.optimal === true && (
        <span className="inline-flex items-center gap-1 text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5" /> proven optimal
        </span>
      )}
      {status.optimal === false && (
        <span className="text-amber-700" title="A valid answer satisfying all hard constraints was found within the time budget, but the solver could not finish proving it's the best possible answer.">
          best answer found in time (not proven optimal)
        </span>
      )}
      {status.optimization && (
        <span className="text-teal-700/70 font-mono text-xs">
          objective: [{status.optimization.join(', ')}]
        </span>
      )}
    </div>
  );
}
