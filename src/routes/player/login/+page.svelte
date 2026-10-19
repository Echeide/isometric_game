<script lang="ts">
 import {untrack} from 'svelte';
 import Page from '$lib/components/PlatformPage.svelte';
 import {request} from '$lib/platform/client';
 import {interfaceLanguage} from '$lib/i18n/context.svelte';
 const ui=interfaceLanguage();let {data}=$props();
 let register=$state(untrack(()=>data.register)),username=$state(''),password=$state(''),confirmation=$state(''),error=$state(''),busy=$state(false);
 async function submit(event:SubmitEvent){event.preventDefault();if(register&&password!==confirmation){error=ui.text('Las contraseñas no coinciden.');return;}busy=true;error='';try{await request('/api/player/'+(register?'register':'login'),{username,password});location.href=data.next;}catch(e){error=(e as Error).message;}finally{busy=false;}}
</script>
<svelte:head><title>{register?ui.text('Crear cuenta de jugador'):ui.text('Entrar como jugador')} — Isométrico</title></svelte:head>
<Page title={register?ui.text('Crea tu cuenta de jugador'):ui.text('Continúa tu aventura')} description={ui.text('Guarda tu partida y recupérala desde cualquier dispositivo.')}>
 <section class="player-login"><form onsubmit={submit}>
  <label>{ui.text('Usuario')}<input required autocomplete="username" minlength="3" maxlength="64" pattern="[a-zA-Z0-9_.\-]+" bind:value={username}/></label>
  <label>{ui.text('Contraseña')}<input required type="password" autocomplete={register?'new-password':'current-password'} minlength={register?10:undefined} maxlength="256" bind:value={password}/></label>
  {#if register}<small>{ui.text('Usa una contraseña de al menos 10 caracteres.')}</small><label>{ui.text('Repite la contraseña')}<input required type="password" autocomplete="new-password" bind:value={confirmation}/></label>{/if}
  {#if error}<p role="alert">{ui.text(error)}</p>{/if}
  <button disabled={busy}>{busy?ui.text('Un momento…'):register?ui.text('Crear cuenta y continuar'):ui.text('Entrar y continuar')}</button>
  <button type="button" class="switch" disabled={busy} onclick={()=>{register=!register;error='';}}>{register?ui.text('Ya tengo una cuenta'):ui.text('Crear cuenta de jugador')}</button>
  <p><a href={data.next}>{ui.text('Volver a la aventura')}</a></p>
 </form></section>
</Page>
<style>.player-login{max-width:440px}.switch{background:transparent!important}p{margin-top:18px;font-size:13px}a{color:#47623c}</style>
