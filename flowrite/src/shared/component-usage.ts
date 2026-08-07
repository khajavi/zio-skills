import { observe, type FlueEvent } from '@flue/runtime';
import { researchTutorialTopic } from '../phases/research-tutorial-topic.ts';
import { designTutorialStructure } from '../phases/design-tutorial-structure.ts';
import { writeTutorialDraft } from '../phases/write-tutorial-draft.ts';
import { writeCompanionExamples } from '../phases/write-companion-examples.ts';
import { integrateTutorial } from '../phases/integrate.ts';
import { reviewTutorial } from '../phases/review-tutorial.ts';
import { researchDataType } from '../phases/research-data-type.ts';
import { designDataTypeStructure } from '../phases/design-data-type-structure.ts';
import { writeDataTypeReference } from '../phases/write-data-type-reference.ts';
import { integrateDataTypeReference } from '../phases/integrate.ts';
import { reviewDataTypeRef } from '../phases/review-data-type-ref.ts';
import { researchModule } from '../phases/research-module.ts';
import { designModuleStructure } from '../phases/design-module-structure.ts';
import { writeModuleOverview } from '../phases/write-module-overview.ts';
import { integrateModuleReference } from '../phases/integrate-module.ts';
import { reviewModuleRef } from '../phases/review-module-ref.ts';

/**
 * Every agent's own phase tools — model-callable, but delegating their real work
 * to a role. Reported under the 'phase' category to separate them from the generic
 * tools; Flue 2 has no Actions concept, these are ordinary `harness: true` tools.
 */
const PHASE_TOOLS = new Set(
  [
    researchTutorialTopic,
    designTutorialStructure,
    writeTutorialDraft,
    writeCompanionExamples,
    integrateTutorial,
    reviewTutorial,
    researchDataType,
    designDataTypeStructure,
    writeDataTypeReference,
    integrateDataTypeReference,
    reviewDataTypeRef,
    researchModule,
    designModuleStructure,
    writeModuleOverview,
    integrateModuleReference,
    reviewModuleRef,
  ].map((a) => a.name),
);

export type ComponentCategory = 'phase' | 'subagent' | 'tool' | 'skill' | 'agent';

export interface ComponentUsage {
  category: ComponentCategory;
  name: string;
  calls: number;
  tokens: number;
  cost: number;
}

export interface ComponentUsageTracker {
  /** Snapshot of accumulated per-component usage, grouped by category then name. */
  report(): ComponentUsage[];
  stop(): ComponentUsage[];
}

function entryFor(components: Map<string, ComponentUsage>, category: ComponentCategory, name: string) {
  const key = `${category}:${name}`;
  let entry = components.get(key);
  if (!entry) {
    entry = { category, name, calls: 0, tokens: 0, cost: 0 };
    components.set(key, entry);
  }
  return entry;
}

/**
 * Subscribe to runtime activity and tally calls + token usage per component
 * (phase/subagent/tool/skill/agent), for a final per-run breakdown alongside
 * the aggregate total from `trackTokenUsage`.
 *
 * Call counts come from `tool_start` (phase tools, repo/generic tools, skill
 * loads) and `task_start` (role delegation via `event.agent`). Token usage comes
 * from `turn` events, attributed by the most specific envelope field available —
 * so phase tools never double-count the tokens their delegated role already
 * accounts for.
 *
 * Attribution order, most specific first:
 *  - `taskId` mapped back to the role recorded at `task_start` → that role. Verified
 *    against a real run: a delegate's turns do carry `taskId`, so role cost is exact.
 *  - otherwise `harness`, `session`, then `agentName` → the writer itself. Every
 *    turn in a run carries `harness` (a delegate inherits the parent's), and the
 *    field holds the harness's own name — "default" — not the owning tool's, so
 *    harness turns cannot be split per phase from the event alone. They are the
 *    writer's own reasoning, including each decision to delegate, so they aggregate
 *    under the writer. An earlier attempt to bind them to the in-flight tool via a
 *    tool_start/tool stack did not hold: the phase tool came back with zero tokens,
 *    because the turn events do not arrive between its start and end in this stream.
 *
 * The totals reconcile: role tokens plus writer tokens equal the run total, which is
 * the property that matters — no turn goes uncounted.
 */
export function trackComponentUsage(): ComponentUsageTracker {
  const components = new Map<string, ComponentUsage>();
  // A delegated task's turns carry the generated `taskId` correlation field, not
  // the subagent's own name, in `event.session` — map taskId back to the
  // subagent name recorded at task_start so turn tokens land on the right entry.
  const subagentByTaskId = new Map<string, string>();
  const unsubscribe = observe((event: FlueEvent) => {
    if (event.type === 'tool_start') {
      const category: ComponentCategory = PHASE_TOOLS.has(event.toolName)
        ? 'phase'
        : event.toolName === 'activate_skill'
          ? 'skill'
          : 'tool';
      const name = category === 'skill' ? String((event.args as any)?.name ?? 'unknown') : event.toolName;
      entryFor(components, category, name).calls += 1;
      return;
    }

    if (event.type === 'task_start') {
      if (event.agent) {
        entryFor(components, 'subagent', event.agent).calls += 1;
        if (event.taskId) subagentByTaskId.set(event.taskId, event.agent);
      }
      return;
    }

    if (event.type === 'turn') {
      const u = event.response.usage;
      if (!u) return;
      const role = event.taskId ? subagentByTaskId.get(event.taskId) : undefined;
      const name = role ?? event.harness ?? event.session ?? event.agentName;
      if (!name) return;
      const category: ComponentCategory = role ? 'subagent' : 'agent';
      const entry = entryFor(components, category, name);
      entry.tokens += u.totalTokens;
      entry.cost += u.cost.total;
    }
  });

  const report = () =>
    [...components.values()].sort((a, b) => a.category.localeCompare(b.category) || b.calls - a.calls);

  let stopped = false;
  return {
    report,
    stop() {
      if (!stopped) {
        unsubscribe();
        stopped = true;
      }
      return report();
    },
  };
}
