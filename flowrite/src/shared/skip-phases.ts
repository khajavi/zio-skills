export type SkipPhase =
  | 'research'
  | 'design'
  | 'write'
  | 'verify-compliance' // data-type-ref: structural gate
  | 'write-examples'
  | 'integrate'
  | 'review';

/** Reads SKIP_PHASES fresh each call (set once by the workflow, read by each action). */
export function isPhaseSkipped(phase: SkipPhase): boolean {
  try {
    const list: string[] = JSON.parse(process.env.SKIP_PHASES ?? '[]');
    return list.includes(phase);
  } catch {
    return false;
  }
}
