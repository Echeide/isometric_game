<script lang="ts">
 import {EditorPanel} from '@isometrico/editor-ui';
 import type {ComponentProps} from 'svelte';
 let {open=$bindable(false),pinned=$bindable(false),...props}:ComponentProps<typeof EditorPanel>=$props();
</script>
<EditorPanel {...props} bind:open bind:pinned/>
