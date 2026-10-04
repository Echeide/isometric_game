<script lang="ts">
  export type IconName = 'play' | 'pause' | 'check' | 'clock' | 'minus' | 'refresh' | 'settings' | 'download' | 'edit' | 'loop' | 'once' | 'close';
  let { name, size = 18 }: { name: IconName; size?: number } = $props();
  const paths: Record<IconName,string> = {
    play:'m8 5 11 7-11 7Z', pause:'M8 5v14M16 5v14', check:'m5 12 4 4L19 6',
    clock:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', minus:'M5 12h14',
    refresh:'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1',
    settings:'M4 7h16M4 17h16M8 4v6M16 14v6', download:'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',
    edit:'m4 16 12-12 4 4L8 20H4ZM13 7l4 4', loop:'m17 2 4 4-4 4M3 11V6h18M7 22l-4-4 4-4m14-1v5H3',
    once:'M4 12h14m-5-5 5 5-5 5M21 5v14', close:'m6 6 12 12M6 18 18 6'
  };
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>
<style>svg{flex-shrink:0;vertical-align:middle}</style>
