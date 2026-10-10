<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import Workshop from "$lib/workshop/Workshop.svelte";
</script>
<svelte:head><title>{ui.text("Taller de sprites — Isométrico")}</title></svelte:head>
<Workshop/>
