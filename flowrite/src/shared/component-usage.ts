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

/** Every agent's own actions — exposed to the model as tools but delegate their real work. */
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
 * Call counts come from `tool_start` (actions, repo/generic tools, skill loads)
 * and `task_start` (subagent delegation via `event.agent`). Token usage comes
 * from `turn` events, attributed by the envelope's `session` name — the active
 * subagent's profile name inside a delegated child session, or the top agent's
 * name at the top level — so actions/tools never double-count the tokens their
 * delegated subagent already accounts for.
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
      const name = (event.taskId && subagentByTaskId.get(event.taskId)) || event.session;
      if (!name) return;
      const category: ComponentCategory = subagentByTaskId.has(event.taskId ?? '') ? 'subagent' : 'agent';
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
