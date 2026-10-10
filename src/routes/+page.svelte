<script lang="ts">
 import {interfaceLanguage} from '$lib/i18n/context.svelte';const ui=interfaceLanguage();
 import {adventureText,adventureLocale} from '$lib/i18n/adventure';
 import AdventureCard from '$lib/components/AdventureCard.svelte';import '$lib/platform/adventures.css';
 import {Layers,ArrowUpRight,ArrowRight,Compass,Search,Globe2} from 'lucide-svelte';
 let {data}=$props();let search=$state('');
 const adventures=$derived(data.adventures.map(a=>({...a,name:adventureText(a,adventureLocale(a,ui.locale),['adventure','name'],a.name),description:adventureText(a,adventureLocale(a,ui.locale),['adventure','description'],a.description??'')})));
 const filtered=$derived(adventures.filter(a=>`${a.name} ${a.tenantName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
</script>
<svelte:head><title>{ui.text("Aventuras — Isométrico")}</title><meta name="description" content={ui.text("Explora las aventuras de Isométrico. Elige un mundo y empieza a jugar.")}/></svelte:head>
<main class="adventures-page">
 <header class="gallery-masthead"><a class="gallery-brand" href="/"><span class="brand-icon"><Layers size={22}/></span>{ui.text("isométrico")}</a><a class="gallery-link" href={data.principal?'/admin':'/login'}>{data.principal?ui.text("Mi espacio"):ui.text("Acceso a gestión")}<ArrowUpRight size={16}/></a></header>
 <div class="gallery-hero"><div><p class="gallery-kicker"><Compass size={14}/> {ui.text("Mundos por descubrir")}</p><h1>{ui.text("Cada aventura,")}<br/>{ui.text("un lugar por explorar.")}</h1><p class="intro">{ui.text("Pequeños mundos con historias por vivir. Elige tu próxima aventura y entra a descubrirla.")}</p></div><div class="hero-art" aria-hidden="true"><img src="/covers/adventure-default.svg" alt="" width="960" height="600"/></div></div>
 <div class="gallery-toolbar"><h2>{ui.text("Explora las aventuras")} <span class="gallery-count">{data.adventures.length}</span></h2><label class="gallery-search"><Search size={16}/><input aria-label={ui.text("Buscar aventuras")} placeholder={ui.text("Buscar una aventura…")} bind:value={search}/></label></div>
 {#if data.error}<p class="gallery-notice error" role="status">{ui.text(data.error)}</p>{/if}
 {#if filtered.length}<div class="adventure-grid">{#each filtered as a}<AdventureCard title={a.name} eyebrow={a.tenantName} description={a.description||ui.text("Explora sus escenarios, conoce a sus personajes y descubre lo que te espera.")} href={`/play/${a.slug}?lang=${ui.locale}`}><a class="btn primary wide" href={`/play/${a.slug}?lang=${ui.locale}`}>{ui.text("Empezar aventura")} <ArrowRight size={16}/></a></AdventureCard>{/each}</div>{:else}<div class="gallery-empty"><Compass size={30}/><h3>{search?ui.text("No encontramos esa aventura"):ui.text("Nuevas aventuras en camino")}</h3><p>{search?ui.text("Prueba con otro nombre o espacio."):ui.text("Los mundos publicados aparecerán aquí, listos para explorar.")}</p></div>{/if}
 <footer class="gallery-footer"><span><Globe2 size={14}/> {ui.text("Abiertas para explorar. Sin registro.")}</span><span>{ui.text("Hecho de píxeles e historias.")}</span></footer>
</main>
<style>.hero-art{width:270px;flex-shrink:0;transform:rotate(-3deg);border:8px solid #fffef8;border-radius:22px;box-shadow:0 12px 32px #37533715;overflow:hidden}.hero-art img{display:block;width:100%;height:auto}@media(max-width:780px){.hero-art{display:none}}</style>
