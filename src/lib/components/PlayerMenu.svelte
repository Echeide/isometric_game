<script lang="ts">
 import {Layers,Play,RotateCcw,MapPin,Clock,ArrowRight} from 'lucide-svelte';
 import {interfaceLanguage} from '$lib/i18n/context.svelte';
 const ui=interfaceLanguage();
 let {name,mapName='',savedAt,hasSave=false,error='',onnew,oncontinue,accountName='',loginHref='',cloud=false,disabled=false,busy=false,onretry,onrecover,onimport,reauth=false}:{name:string;mapName?:string;savedAt?:string;hasSave?:boolean;error?:string;onnew:()=>void;oncontinue:()=>void;accountName?:string;loginHref?:string;cloud?:boolean;disabled?:boolean;busy?:boolean;onretry?:()=>void;onrecover?:()=>void;onimport?:()=>void;reauth?:boolean}=$props();
 let confirming=$state(false);
</script>

<section class="player-menu" aria-label={ui.text('Menú de la aventura')}>
 <div class="menu-card">
  <div class="menu-symbol" aria-hidden="true"><Layers size={34} strokeWidth={1.5}/></div>
  <p class="menu-eyebrow">{ui.text('TU AVENTURA')}</p>
  <h1>{name}</h1>
  <p class="menu-intro">{hasSave?ui.text('Tu historia te espera donde la dejaste.'):ui.text('Cada aventura empieza con un primer paso.')}</p>
  {#if accountName}<p class="account-note">{ui.text('Partida de')} <strong>{accountName}</strong></p>{:else if loginHref}<p class="account-note">{ui.text('Continúa desde cualquier dispositivo con tu cuenta de jugador.')}<br/><a href={loginHref}>{ui.text('Iniciar sesión')}</a> · <a href={loginHref+'&register=1'}>{ui.text('Crear cuenta')}</a></p>{/if}
  {#if error}<p class="menu-error" role="alert">{ui.text(error)}</p>{/if}
  {#if onrecover}<button class="menu-primary" disabled={busy} onclick={onrecover}>{ui.text('Cargar partida del servidor')}</button>{/if}
  {#if reauth}<p class="account-note"><a href={loginHref}>{ui.text('Volver a iniciar sesión')}</a></p>{/if}
  {#if onretry}<button class="menu-secondary" disabled={busy} onclick={onretry}>{ui.text('Reintentar conexión')}</button>{/if}
  {#if confirming}
   <div class="overwrite" role="group" aria-label={ui.text('Confirmar nuevo juego')}>
    <h2>{ui.text('¿Empezar de nuevo?')}</h2>
    <p>{ui.text('Se sustituirá la partida guardada de esta aventura.')}</p>
    <button class="menu-primary" disabled={disabled||busy} onclick={()=>{confirming=false;onnew();}}>{ui.text('Empezar nuevo juego')}<ArrowRight size={18}/></button>
    <button class="menu-secondary" onclick={()=>confirming=false}>{ui.text('Conservar mi partida')}</button>
   </div>
  {:else}
   {#if hasSave}
    <div class="save-summary">
     <span><MapPin size={17}/><strong>{mapName}</strong></span>
     <span><Clock size={15}/>{#if savedAt}<time datetime={savedAt}>{new Intl.DateTimeFormat(ui.locale,{dateStyle:'medium',timeStyle:'short'}).format(new Date(savedAt))}</time>{:else}{ui.text('Progreso anterior')}{/if}</span>
    </div>
    <button class="menu-primary" disabled={disabled||busy} onclick={oncontinue}><Play size={19}/>{ui.text('Continuar')}<ArrowRight class="trailing" size={18}/></button>
    <button class="menu-secondary" disabled={disabled||busy} onclick={()=>confirming=true}><RotateCcw size={17}/>{ui.text('Nuevo juego')}</button>
   {:else}
    <button class="menu-primary" disabled={disabled||busy} onclick={onnew}><Play size={19}/>{ui.text('Nuevo juego')}<ArrowRight class="trailing" size={18}/></button>
   {/if}
  {/if}
  {#if onimport}<button class="menu-secondary" disabled={disabled||busy} onclick={onimport}>{ui.text('Continuar partida de este dispositivo')}</button>{/if}
  <p class="save-note">{cloud?ui.text('La partida se guarda en tu cuenta y se sincroniza entre dispositivos.'):ui.text('La partida se guarda automáticamente en este navegador.')}</p>
 </div>
</section>

<style>
 .player-menu{position:absolute;inset:0;overflow:auto;display:grid;place-items:center;padding:36px 22px;background:radial-gradient(ellipse at 50% 0%,#dbe6ce66,transparent 65%),#f4f6ef;color:#294637}
 .menu-card{width:min(420px,100%);text-align:center;margin:auto}
 .menu-symbol{display:grid;place-items:center;width:76px;height:76px;margin:0 auto 25px;border:1px solid #cfdbc5;background:#e8efdf;border-radius:22px;color:#577641;box-shadow:0 8px 30px #526b4010}
 .menu-eyebrow{font-size:10px;letter-spacing:2px;font-weight:600;color:#6a805c;margin-bottom:12px}
 h1{font-size:clamp(28px,5vw,39px);line-height:1.15;letter-spacing:-1.2px;text-wrap:balance}
 .menu-intro{color:#6e7d68;font-size:14px;line-height:1.6;margin:16px 0 30px}
 .save-summary{display:grid;gap:10px;text-align:left;padding:18px 20px;margin-bottom:18px;border:1px solid #d9e1d0;border-radius:12px;background:#ffffff80}
 .save-summary span{display:flex;align-items:center;gap:10px;font-size:12px;color:#74816c}.save-summary strong{font-size:14px;font-weight:500;color:#35513e}
 button{display:flex;align-items:center;justify-content:center;gap:11px;width:100%;min-height:50px;border-radius:10px;font:500 14px system-ui;cursor:pointer}
 button:focus-visible{outline:3px solid #8aa96e;outline-offset:3px}.menu-primary{background:#2e4c3b;color:#f4f7ed;padding:14px 20px;text-align:left}.menu-primary:hover{background:#3f5e47}.menu-primary :global(.trailing){margin-left:auto}
 .menu-secondary{border:1px solid #d5decf;color:#4e6545;background:transparent;margin-top:12px}.menu-secondary:hover{background:#e9efdf}
 .save-note{font-size:11px;line-height:1.6;color:#788571;margin-top:25px}
 .overwrite{padding:20px;border:1px solid #d9e1d0;border-radius:12px;background:#ffffff80}.overwrite h2{font-size:20px;letter-spacing:-.4px}.overwrite p{font-size:13px;color:#6e7d68;line-height:1.6;margin:12px 0 20px}
 .menu-error{font-size:13px;line-height:1.6;color:#8a4336;background:#fff0eb;border:1px solid #ebd0c5;border-radius:10px;padding:14px;margin-bottom:18px}
 .account-note{font-size:12px;line-height:1.8;color:#63775a;margin:-10px 0 24px}.account-note a{color:#36582f;text-decoration:underline}button:disabled{opacity:.55;cursor:wait}
 @media(max-height:650px){.player-menu{padding:24px 20px}.menu-symbol{height:54px;width:54px;margin-bottom:16px;border-radius:16px}.menu-intro{margin:12px 0 20px}.save-note{margin-top:18px}}
</style>
