import { defineConfig } from 'vite';
import { flue } from '@flue/vite';

/**
 * Vite owns the dev server and the production build; the `flue()` plugin is what makes them Flue
 * builds — it resolves the `app.ts`/`db.ts` entries from the source directory, applies the transform
 * that lets agents import `.md` and `SKILL.md` files, and packages each mounted skill's directory.
 *
 * This project had no vite.config.ts at all, so `vite build` failed with "Cannot resolve entry module
 * index.html" — with no Flue plugin, Vite treated flowrite as an ordinary web app.
 *
 * flowrite's own runs do not go through here: they are `flue run src/agent.ts`, which applies the same
 * transforms in-process. This exists so the agent can be built and served.
 */
export default defineConfig({
  plugins: [flue()],
});
