const bot = document.querySelector('chat-bot');
const emit = (type, payload = {}) => parent.postMessage({ channel: 'routingtales-chat-v1', type, ...payload }, '*');
let initialized = false;
window.addEventListener('message', event => {
  if (event.source !== parent || event.data?.channel !== 'routingtales-chat-v1' || event.data.type !== 'configure' || initialized) return;
  initialized = true;
  try {
    bot.addEventListener('chatbot:node_added', event => emit('node', { id: event.detail.id }));
    bot.setChatConf(event.data.config, event.data.startNode);
    const style = document.createElement('style');
    style.textContent = ':host{font-family:system-ui;font-size:14px}';
    bot.shadowRoot.append(style);
    emit('configured');
  } catch { emit('error'); }
});
window.addEventListener('error', () => emit('error'));
window.addEventListener('keydown', event => { if (event.key === 'Escape') emit('close'); });
emit('ready');

// Interface changes do not reconfigure the conversation or emit progress events.
window.addEventListener('message', event => {
 if(event.source!==parent||event.data?.channel!=='routingtales-chat-v1'||event.data.type!=='interface')return;
 const {locale,labels}=event.data;if(!['es','en'].includes(locale)||!labels)return;document.documentElement.lang=locale;
 const root=bot.shadowRoot,input=root?.querySelector('.chat-input'),send=root?.querySelector('.send-btn'),clear=root?.querySelector('.clear-btn');
 if(input){input.placeholder=String(labels.input??'');input.setAttribute('aria-label',String(labels.input??''));}
 send?.setAttribute('aria-label',String(labels.send??''));clear?.setAttribute('aria-label',String(labels.clear??''));
});
