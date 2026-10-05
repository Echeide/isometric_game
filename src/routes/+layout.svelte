<script lang="ts">
 import '../app.css';import {browser} from '$app/environment';import {setStorageContext} from '$lib/storage/local-adventures';import {request} from '$lib/platform/client';
 let {children,data}=$props();let notice=$state(''),bar:HTMLElement|undefined=$state();
 $effect(()=>{if(!bar)return;const current=bar,observer=new ResizeObserver(()=>document.documentElement.style.setProperty('--platform-bar-height',current.offsetHeight+'px'));observer.observe(current);return()=>{observer.disconnect();document.documentElement.style.removeProperty('--platform-bar-height');};});
 function configureStorage(){setStorageContext(data.principal?.tenant?.id?`${data.principal.user.id}:${data.principal.tenant.id}`:null);}if(browser)configureStorage();
 $effect(()=>{setStorageContext(data.principal?.tenant?.id?`${data.principal.user.id}:${data.principal.tenant.id}`:null);});
 async function session(action:string,body={}){try{await request('/api/auth/'+action,body);location.href=action==='impersonate'?'/superadmin':'/';}catch(e){notice=(e as Error).message;}}
</script>
{#if data.principal}<nav bind:this={bar} class:acting={data.principal.impersonating} class="platform-bar" aria-label="Cuenta y espacio"><a href="/">Aventuras públicas</a><a href={data.principal.tenant?'/admin':'/superadmin'}>{data.principal.tenant?.name??'Superadministración'}</a><span>{data.principal.impersonating?`Actuando como ${data.principal.user.username} · sesión de ${data.principal.actor.username}`:data.principal.user.username}</span>{#if data.principal.impersonating}<button onclick={()=>session('impersonate')}>Volver a superadmin</button>{:else}<a href="/account">Mi cuenta</a>{/if}<button onclick={()=>session('logout')}>Salir</button></nav>{/if}
{#if notice}<p role="alert">{notice}</p>{/if}
{@render children()}
<style>.platform-bar{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:10px 24px;background:#183a31;color:white;font:13px system-ui;position:relative;z-index:100}.platform-bar.acting{background:#654612}.platform-bar a{color:inherit;text-decoration:underline}.platform-bar span{margin-left:auto}.platform-bar button{color:inherit;border:1px solid #ffffff60;background:transparent;border-radius:6px;padding:6px 10px;cursor:pointer}</style>
