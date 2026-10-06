<script lang="ts">
 import {onMount} from 'svelte';
 import {X} from 'lucide-svelte';
 let {title,context,onclose}:{title:string;context?:string;onclose:()=>void}=$props();
 let closeButton:HTMLButtonElement;
 onMount(()=>closeButton.focus({preventScroll:true}));
</script>
<header class="module-editor-header">
 <div><h2>{title}</h2>{#if context}<small>{context}</small>{/if}</div>
 <button bind:this={closeButton} onclick={onclose} aria-label={'Cerrar módulo: '+title} title="Cerrar (cancelar)"><X size={20}/></button>
</header>
<style>
 .module-editor-header{display:flex;align-items:center;gap:12px;padding:16px;border-bottom:1px solid #e7ebf1;flex-shrink:0;background:#fffef8;color:#28354b}.module-editor-header>div{min-width:0;flex:1}h2{margin:0;font-size:16px;font-weight:700;line-height:1.4;overflow-wrap:anywhere}small{display:block;margin-top:4px;color:#65748b;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}button{display:grid;place-items:center;flex-shrink:0;width:36px;height:36px;padding:0;border:1px solid #dce1ec;border-radius:8px;background:white;color:inherit;cursor:pointer}button:hover{background:#eef2fa}button:focus-visible{outline:2px solid #7587d8;outline-offset:2px}@media(max-width:450px){.module-editor-header{padding:12px}}
</style>
