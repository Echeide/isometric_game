<script lang="ts">
 import {Image} from 'lucide-svelte';
 import type {PixelArtPack} from '@isometrico/world';
 import SpriteThumbnail from '../components/SpriteThumbnail.svelte';
 let {graphics,visualId,label,size=48}:{graphics:PixelArtPack;visualId?:string;label:string;size?:number}=$props();
 const sprite=$derived(visualId?graphics.objects[visualId]:undefined);
</script>
<span class="state-graphic" style={`width:${size}px;height:${size}px`} role="img" aria-label={label} title={label}>
 {#if sprite}<SpriteThumbnail image={sprite.image} frame={sprite.frame} width={size} height={size}/>{:else}<Image size={20}/>{/if}
</span>
<style>.state-graphic{display:grid;place-items:center;flex:none;overflow:hidden;border-radius:6px;background:#edf3e5;color:#8b9881}</style>
