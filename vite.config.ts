import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
export default defineConfig({ cacheDir: '.svelte-kit/vite-cache', plugins: [sveltekit()], server: { fs: { allow: ['./packages/world/src', './packages/character-generator/src'] } } });
