<script lang="ts">
 import AdventureCard from '$lib/components/AdventureCard.svelte';import '$lib/platform/adventures.css';
 import {Layers,ArrowUpRight,ArrowRight,Compass,Search,Globe2} from 'lucide-svelte';
 let {data}=$props();let search=$state('');
 const filtered=$derived(data.adventures.filter(a=>`${a.name} ${a.tenantName}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())));
</script>
<svelte:head><title>Aventuras — Isométrico</title><meta name="description" content="Explora las aventuras de Isométrico. Elige un mundo y empieza a jugar."/></svelte:head>
<main class="adventures-page">
 <header class="gallery-masthead"><a class="gallery-brand" href="/"><span class="brand-icon"><Layers size={22}/></span>isométrico</a><a class="gallery-link" href={data.principal?'/admin':'/login'}>{data.principal?'Mi espacio':'Acceso a gestión'}<ArrowUpRight size={16}/></a></header>
 <div class="gallery-hero"><div><p class="gallery-kicker"><Compass size={14}/> Mundos por descubrir</p><h1>Cada aventura,<br/>un lugar por explorar.</h1><p class="intro">Pequeños mundos con historias por vivir. Elige tu próxima aventura y entra a descubrirla.</p></div><div class="hero-art" aria-hidden="true"><img src="/covers/adventure-default.svg" alt="" width="960" height="600"/></div></div>
 <div class="gallery-toolbar"><h2>Explora las aventuras <span class="gallery-count">{data.adventures.length}</span></h2><label class="gallery-search"><Search size={16}/><input aria-label="Buscar aventuras" placeholder="Buscar una aventura…" bind:value={search}/></label></div>
 {#if data.error}<p class="gallery-notice error" role="status">{data.error}</p>{/if}
 {#if filtered.length}<div class="adventure-grid">{#each filtered as a}<AdventureCard title={a.name} eyebrow={a.tenantName} description={a.description||'Explora sus escenarios, conoce a sus personajes y descubre lo que te espera.'} href={`/play/${a.slug}`}><a class="btn primary wide" href={`/play/${a.slug}`}>Empezar aventura <ArrowRight size={16}/></a></AdventureCard>{/each}</div>{:else}<div class="gallery-empty"><Compass size={30}/><h3>{search?'No encontramos esa aventura':'Nuevas aventuras en camino'}</h3><p>{search?'Prueba con otro nombre o espacio.':'Los mundos publicados aparecerán aquí, listos para explorar.'}</p></div>{/if}
 <footer class="gallery-footer"><span><Globe2 size={14}/> Abiertas para explorar. Sin registro.</span><span>Hecho de píxeles e historias.</span></footer>
</main>
<style>.hero-art{width:270px;flex-shrink:0;transform:rotate(-3deg);border:8px solid #fffef8;border-radius:22px;box-shadow:0 12px 32px #37533715;overflow:hidden}.hero-art img{display:block;width:100%;height:auto}@media(max-width:780px){.hero-art{display:none}}</style>
