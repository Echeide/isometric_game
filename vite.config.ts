import {paraglideVitePlugin} from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
export default defineConfig({ cacheDir: '.svelte-kit/vite-cache', plugins: [paraglideVitePlugin({project:'./project.inlang',outdir:'./src/lib/paraglide',strategy:['cookie','preferredLanguage','baseLocale'],cookieName:'isometric_locale',emitTsDeclarations:true,outputStructure:'locale-modules'}),sveltekit()], optimizeDeps: { include: ['quill', 'howler', 'hls.js', 'dompurify'] }, server: { fs: { allow: ['./packages/world/src', './packages/character-generator/src'] } } });
