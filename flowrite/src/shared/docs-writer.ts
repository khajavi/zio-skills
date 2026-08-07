import { defineAgent, type AgentRuntimeConfig } from '@flue/runtime';
import { local } from '@flue/runtime/node';

// reusable baseline profile (supplies model + the writing-style skill)
import { docsAuthorBase } from '../subagents/docs-author-base.ts';

// subagents (agent profiles) — the generic, document-kind-neutral role profiles
// shared by every docs writer; the kind-specific focus/schema/checklist is
// supplied by each agent's own actions at the delegation call site. The
// design/write/review actions delegate to narrow, no-action profiles to avoid
// the self-recursion hazard of harness.session() on this same agent.
import { researcher } from '../subagents/researcher.ts';
import { designer } from '../subagents/designer.ts';
import { drafter } from '../subagents/drafter.ts';
import { reviewer } from '../subagents/reviewer.ts';
import { examplesBuilder } from '../subagents/examples-builder.ts';
import { docsIntegrator } from '../subagents/docs-integrator.ts';
import { reviewResolver } from '../subagents/review-resolver.ts';
import { styleChecker } from '../subagents/style-checker.ts';
import { styleFixer } from '../subagents/style-fixer.ts';

import { createGhQueryTool } from '../tools/repo-tools.ts';
import { TIERS } from './models.ts';

/**
 * Shared factory for ZIO documentation-authoring agents (tutorial-writer,
 * data-type-ref-writer, …). Every such agent runs the same flow with the same
 * role subagents, model tier, sandbox, and gh tool — they differ only in their
 * orchestration instructions, the kind-specific skills, and the actions that
 * drive each phase. Supply those three; everything else is fixed here.
 */
export function defineDocsWriter(opts: {
  /** Human label for the id in the REPO_PATH error, e.g. 'tutorial' or 'data type'. */
  idLabel: string;
  instructions: string;
  skills: AgentRuntimeConfig['skills'];
  actions: AgentRuntimeConfig['actions'];
}) {
  return defineAgent(({ id }) => {
    // id = topic/type slug, used only for logging; REPO_PATH must be set before
    // `flue run` starts — this agent's cwd is resolved once at init, before
    // workflow run() executes, so setting REPO_PATH inside run() is too late.
    const cwd = process.env.REPO_PATH;
    if (!cwd) {
      throw new Error(`REPO_PATH must be set before running (${opts.idLabel} id: ${id})`);
    }

    return {
      profile: docsAuthorBase,
      thinkingLevel: TIERS.writer.thinkingLevel,
      instructions: opts.instructions,
      sandbox: local(),
      cwd,
      skills: opts.skills,
      actions: opts.actions,
      tools: [createGhQueryTool(cwd)],
      subagents: [
        researcher,
        designer,
        drafter,
        reviewer,
        examplesBuilder,
        docsIntegrator,
        reviewResolver,
        styleChecker,
        styleFixer,
      ],
    };
  });
}
