import { defineAgent, type AgentRuntimeConfig } from '@flue/runtime';
import { local } from '@flue/runtime/node';

// reusable baseline profile (supplies model + the writing-style skill)
import { docsAuthorBase } from '../profiles/docs-author-base.ts';

// subagents (agent profiles) — the generic, document-kind-neutral role profiles
// shared by every docs writer; the kind-specific focus/schema/checklist is
// supplied by each agent's own actions at the delegation call site. The
// design/write/review actions delegate to narrow, no-action profiles to avoid
// the self-recursion hazard of harness.session() on this same agent.
import { researcher } from '../profiles/researcher.ts';
import { designer } from '../profiles/designer.ts';
import { drafter } from '../profiles/drafter.ts';
import { reviewer } from '../profiles/reviewer.ts';
import { examplesBuilder } from '../profiles/examples-builder.ts';
import { docsIntegrator } from '../profiles/docs-integrator.ts';
import { reviewResolver } from '../profiles/review-resolver.ts';
import { styleChecker } from '../profiles/style-checker.ts';
import { styleFixer } from '../profiles/style-fixer.ts';

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
