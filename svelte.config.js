import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
export default { preprocess: vitePreprocess(), kit: { adapter: adapter(), alias: { '@isometrico/editor-ui': './packages/editor-ui/src/index.ts', '@isometrico/world': './packages/world/src/index.ts', '@isometrico/character-generator': './packages/character-generator/src/index.ts' } } };
