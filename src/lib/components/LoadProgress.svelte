<script lang="ts">
 import type {LoadProgress} from '$lib/storage/preload';
 let {progress=null,title='Preparando tu aventura…'}:{progress?:LoadProgress|null;title?:string}=$props();
 const percent=$derived(progress&&progress.total>0?Math.round(progress.completed/progress.total*100):null);
</script>
<div class="preload" role="status" aria-live="polite">
 <span class="spinner" aria-hidden="true"></span><strong>{title}</strong>
 {#if percent!==null&&progress}<progress max={progress.total} value={progress.completed} aria-label="Gráficos cargados"></progress><span class="count">{progress.completed} de {progress.total} gráficos · {percent}%</span>{:else}<span class="count">Cargando datos…</span>{/if}
</div>
<style>
.preload{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;min-height:240px;padding:32px;box-sizing:border-box;color:#3b5946;background:#f4f7f0;border:1px solid #dce5d5;border-radius:16px;font:14px system-ui;text-align:center}.preload strong{font-weight:600}.count{font-size:12px;color:#63715e;min-height:18px;font-variant-numeric:tabular-nums}progress{width:min(280px,100%);height:8px;accent-color:#547642}.spinner{width:22px;height:22px;border:2px solid #d4dfc9;border-top-color:#547642;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){.spinner{animation:none}}
</style>
