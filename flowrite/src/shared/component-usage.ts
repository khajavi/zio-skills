import { observe, type FlueEvent } from '@flue/runtime';
import { researchTutorialTopic } from '../actions/research-tutorial-topic.ts';
import { designTutorialStructure } from '../actions/design-tutorial-structure.ts';
import { writeTutorialDraft } from '../actions/write-tutorial-draft.ts';
import { writeCompanionExamples } from '../actions/write-companion-examples.ts';
import { integrateTutorial } from '../actions/integrate.ts';
import { reviewTutorial } from '../actions/review-tutorial.ts';
import { researchDataType } from '../actions/research-data-type.ts';
import { designDataTypeStructure } from '../actions/design-data-type-structure.ts';
import { writeDataTypeReference } from '../actions/write-data-type-reference.ts';
import { integrateDataTypeReference } from '../actions/integrate.ts';
import { reviewDataTypeRef } from '../actions/review-data-type-ref.ts';
import { researchModule } from '../actions/research-module.ts';
import { designModuleStructure } from '../actions/design-module-structure.ts';
import { writeModuleOverview } from '../actions/write-module-overview.ts';
import { integrateModuleReference } from '../actions/integrate-module.ts';
import { reviewModuleRef } from '../actions/review-module-ref.ts';

/**
 * Every agent's own phase tools — model-callable, but delegating their real work
 * to a role. Kept under the 'action' category label so a report stays comparable
 * with archived beta-era runs, though Flue 2 has no Actions concept: these are
 * ordinary `harness: true` tools now.
 */
const ACTION_NAMES = new Set(
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

export type ComponentCategory = 'action' | 'subagent' | 'tool' | 'skill' | 'agent';

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
 * (action/subagent/tool/skill/agent), for a final per-run breakdown alongside
 * the aggregate total from `trackTokenUsage`.
 *
 * Call counts come from `tool_start` (phase tools, repo/generic tools, skill
 * loads) and `task_start` (role delegation via `event.agent`). Token usage comes
 * from `turn` events, attributed by the most specific envelope field available —
 * so phase tools never double-count the tokens their delegated role already
 * accounts for.
 *
 * Attribution order, most specific first:
 *  - `taskId` mapped back to the role recorded at `task_start` → that role.
 *  - `harness` → the phase tool whose harness opened the conversation. Flue 2
 *    routes every phase through `harness.prompt()`, and those turns carry
 *    `harness` with no `session`; without this branch they would be dropped and
 *    the delegation-deciding turns would vanish from the cost report.
 *  - `session`, then `agentName` → the top-level writer.
 */
export function trackComponentUsage(): ComponentUsageTracker {
  const components = new Map<string, ComponentUsage>();
  // A delegated task's turns carry the generated `taskId` correlation field, not
  // the subagent's own name, in `event.session` — map taskId back to the
  // subagent name recorded at task_start so turn tokens land on the right entry.
  const subagentByTaskId = new Map<string, string>();

  const unsubscribe = observe((event: FlueEvent) => {
    if (event.type === 'tool_start') {
      const category: ComponentCategory = ACTION_NAMES.has(event.toolName)
        ? 'action'
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
      const category: ComponentCategory = role
        ? 'subagent'
        : event.harness
          ? // A harness only exists inside a tool call, so its turns belong to
            // that phase tool — 'action' when it is one of ours, else 'tool'.
            ACTION_NAMES.has(event.harness)
            ? 'action'
            : 'tool'
          : 'agent';
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
