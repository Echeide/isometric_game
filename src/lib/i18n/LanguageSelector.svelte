<script lang="ts">
 import {Languages} from 'lucide-svelte';import {interfaceLanguage} from './context.svelte';import {uiLocales,languageName} from './locale';
 const ui=interfaceLanguage();
</script>
<label class="language-selector" title={ui.text('Idioma de la interfaz')}><Languages size={15} aria-hidden="true"/><select aria-label={ui.text('Idioma de la interfaz')} value={ui.locale} onchange={event=>ui.set(event.currentTarget.value)}>{#each uiLocales as locale}<option value={locale}>{languageName(locale)}</option>{/each}</select></label>
<style>.language-selector{display:inline-flex;align-items:center;gap:5px;white-space:nowrap;color:inherit}.language-selector select{font:inherit;font-size:12px;padding:5px 3px;border:0;border-radius:5px;color:inherit;background:transparent;cursor:pointer}.language-selector option{color:#293f32;background:white}.language-selector select:focus-visible{outline:2px solid currentColor;outline-offset:2px}</style>
