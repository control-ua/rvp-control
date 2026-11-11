import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
// The pilot is deliberately restricted to the newly created empty test group.
const CHAT=-1004217838709;
const USERNAME='gidra_tasks_test_bot';
const TOKEN=Deno.env.get('GIDRA_INTERNAL_TASK_BOT_TOKEN')||'';
const DB=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const TOPICS=['Для обговорення','Термнові оплати','Сплатити рахунок','Виставити рахунок','Паливо ДТ','Первинні акти'];
const E=(v:unknown)=>String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!));
const name=(u:any)=>[u.first_name,u.last_name].filter(Boolean).join(' ').slice(0,100)||String(u.id);
async function api(method:string,body:Record<string,unknown>={}){
 const r=await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 const j=await r.json();if(!j.ok)throw new Error(`Telegram ${method}: ${j.error_code} ${j.description||''}`);return j.result;
}
async function secret(){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`gidra-internal-tasks-v1:${TOKEN}`));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');}
function sourceLink(id:number){return `https://t.me/c/${String(CHAT).slice(4)}/${id}`;}
const states:Record<string,string>={new:'🆕 Нова',working:'🔵 У роботі',blocked:'🟠 Потрібні дані',done:'✅ Готово'};
function buttons(t:any){const b=(text:string,a:string)=>({text,callback_data:`it:${a}:${t.id}:${t.version}`});return{inline_keyboard:t.state==='new'?[[b('🙋 Взяти в роботу','take')]]:t.state==='done'?[[b('↩️ Повернути в роботу','reopen')]]:[[b('✅ Готово','done'),b(t.state==='blocked'?'▶️ Продовжити':'❓ Потрібні дані',t.state==='blocked'?'resume':'block')]]};}
function text(t:any){return `<b>Задача №${t.number} · ${states[t.state]}</b>\n\n${E(t.body)}\n\nСтворив: ${E(t.creator_name)}\nВідповідальний: ${E(t.assignee_name||'ще не взяв')}\n${t.reason?`Потрібно уточнити: ${E(t.reason)}\n`:''}<a href="${sourceLink(t.source_message_id)}">Вихідне повідомлення та файли</a>\n\nОбговорюйте відповідями під цією карткою. «Готово» — статус задачі, не підтвердження банківської оплати.`;}
async function say(thread:number,text:string,markup?:any,reply?:number){return api('sendMessage',{chat_id:CHAT,message_thread_id:thread===1?undefined:thread,text,parse_mode:'HTML',reply_markup:markup,reply_parameters:reply?{message_id:reply,allow_sending_without_reply:true}:undefined,link_preview_options:{is_disabled:true}});}
async function member(user:number){const m=await api('getChatMember',{chat_id:CHAT,user_id:user});if(!['creator','administrator','member','restricted'].includes(m.status)||(m.status==='restricted'&&!m.is_member))throw new Error('Доступ закрито.');return ['creator','administrator'].includes(m.status);}
async function render(t:any){
 if(t.card_message_id){try{await api('editMessageText',{chat_id:CHAT,message_id:t.card_message_id,text:text(t),parse_mode:'HTML',reply_markup:buttons(t),link_preview_options:{is_disabled:true}});}catch(e){if(!String(e).includes('message is not modified'))throw e;}return;}
 const m=await say(t.thread_id,text(t),buttons(t),t.source_message_id);
 const r=await DB.from('gidra_internal_tasks').update({card_message_id:m.message_id}).eq('id',t.id).is('card_message_id',null);if(r.error)throw r.error;
}
async function prompt(thread:number,user:number,kind:string,id='',version=0){return say(thread,`<a href="tg://user?id=${user}">Ваша відповідь</a>\n`+(kind==='new'?`<b>Нова задача</b>\nДайте відповідь на це повідомлення:\nОб’єкт / контрагент:\nЩо зробити:\nСума / тариф (якщо потрібно):\nКому доручено:\nТермін:\n\nМожна додати файл.\n[IT_NEW:${user}]`:`Чого саме не вистачає? Відповідайте на це повідомлення (3–1000 символів).\n[IT_BLOCK:${user}:${id}:${version}]`),{force_reply:true,selective:true,input_field_placeholder:'Відповідь для задачі'});}
async function create(m:any,body:string){
 if(body.length<3||body.length>2500){await say(m.message_thread_id||1,'Опис має містити від 3 до 2500 символів.');return;}
 const row={chat_id:CHAT,thread_id:m.message_thread_id||1,source_message_id:m.message_id,creator_id:m.from.id,creator_name:name(m.from),body};
 const r=await DB.from('gidra_internal_tasks').upsert(row,{onConflict:'chat_id,source_message_id',ignoreDuplicates:true});if(r.error)throw r.error;
 const t=await DB.from('gidra_internal_tasks').select('*').eq('chat_id',CHAT).eq('source_message_id',m.message_id).single();if(t.error)throw t.error;await render(t.data);
}
async function list(thread:number,user:number,mine=false){
 let q=DB.from('gidra_internal_tasks').select('*').eq('chat_id',CHAT).eq('thread_id',thread).neq('state','done').order('created_at').limit(21);if(mine)q=q.eq('assignee_id',user);
 const r=await q;if(r.error)throw r.error;
 await say(thread,r.data.length?`<b>${mine?'Мої':'Відкриті'} задачі цієї теми</b>\n`+r.data.slice(0,20).map(t=>`${states[t.state]} · <a href="${sourceLink(t.card_message_id||t.source_message_id)}">№${t.number}</a> · ${E(t.body.slice(0,90))}`).join('\n')+(r.data.length>20?'\nПоказано перші 20.':''):'У цій темі немає відкритих задач.');
}
async function setup(){
 const me=await api('getMe');if(me.username!==USERNAME)throw new Error('Wrong bot token');
 await api('setWebhook',{url:`${Deno.env.get('SUPABASE_URL')}/functions/v1/gidra-internal-tasks`,secret_token:await secret(),allowed_updates:['message','callback_query','my_chat_member'],max_connections:1});
 await api('setMyCommands',{commands:[{command:'menu',description:'Меню задач у поточній темі'},{command:'task',description:'Створити задачу'},{command:'tasks',description:'Відкриті задачі теми'},{command:'mine',description:'Мої задачі теми'}]});
}
let configured:Promise<void>|null=null;
Deno.serve(async req=>{
 if(!TOKEN)return new Response('Bot token not configured',{status:503});
 try{
 if(req.method==='GET'){
  // Only reassert our fixed webhook; no caller-controlled destination or secret.
  configured??=setup();await configured;return Response.json({ok:true,bot:USERNAME});
 }
 if(req.method!=='POST')return new Response('',{status:405});
 if(req.headers.get('X-Telegram-Bot-Api-Secret-Token')!==await secret())return new Response('',{status:403});
 const u=await req.json(),c=u.callback_query,m=u.message;
 if(c){
  if(c.message?.chat?.id!==CHAT||!c.from||c.from.is_bot)return Response.json({ok:true});
  const thread=c.message.message_thread_id||1,admin=await member(c.from.id);
  const ack=(s='')=>api('answerCallbackQuery',{callback_query_id:c.id,text:s});
  if(c.data==='new'){await prompt(thread,c.from.id,'new');await ack();return Response.json({ok:true});}
  if(c.data==='tasks'||c.data==='mine'){await list(thread,c.from.id,c.data==='mine');await ack();return Response.json({ok:true});}
  const a=/^it:(take|done|block|resume|reopen):([a-f0-9-]{36}):(\d+)$/.exec(c.data||'');if(!a){await ack();return Response.json({ok:true});}
  const task=await DB.from('gidra_internal_tasks').select('*').eq('id',a[2]).eq('chat_id',CHAT).eq('thread_id',thread).eq('card_message_id',c.message.message_id).single();
  if(task.error){await ack('Задача недоступна.');return Response.json({ok:true});}
  if(a[1]==='block'){if(!admin&&![task.data.creator_id,task.data.assignee_id].includes(c.from.id)){await ack('Тільки відповідальний або автор.');return Response.json({ok:true});}await prompt(thread,c.from.id,'block',a[2],Number(a[3]));await ack();return Response.json({ok:true});}
  const r=await DB.rpc('gidra_internal_task_action',{p_task:a[2],p_chat:CHAT,p_thread:thread,p_actor:c.from.id,p_name:name(c.from),p_action:a[1],p_version:Number(a[3]),p_update:u.update_id,p_admin:admin});
  if(r.error){await render(task.data);await ack('Задача змінилася або дія недоступна. Оновіть картку.');return Response.json({ok:true});}
  await render(r.data);await ack('Збережено');return Response.json({ok:true});
 }
 if(m&&m.chat?.id===CHAT&&m.from&&!m.from.is_bot&&!m.sender_chat){
  const thread=m.message_thread_id||1,admin=await member(m.from.id),body=String(m.text||m.caption||'').trim();
  const reply=m.reply_to_message;const trustedReply=reply?.from?.username===USERNAME&&reply?.from?.is_bot;
  const newMatch=trustedReply?/\[IT_NEW:(\d+)\]/.exec(reply.text||''):null;
  const blockMatch=trustedReply?/\[IT_BLOCK:(\d+):([a-f0-9-]{36}):(\d+)\]/.exec(reply.text||''):null;
  if(newMatch&&Number(newMatch[1])===m.from.id){await create(m,body);return Response.json({ok:true});}
  if(blockMatch&&Number(blockMatch[1])===m.from.id){
   const r=await DB.rpc('gidra_internal_task_action',{p_task:blockMatch[2],p_chat:CHAT,p_thread:thread,p_actor:m.from.id,p_name:name(m.from),p_action:'block',p_version:Number(blockMatch[3]),p_update:u.update_id,p_admin:admin,p_reason:body});
   if(r.error)await say(thread,'Не збережено: потрібна причина 3–1000 символів і актуальна задача.');else await render(r.data);return Response.json({ok:true});
  }
  const command=/^\/(menu|task|tasks|mine|setup)(?:@([A-Za-z0-9_]+))?(?:\s+([\s\S]*))?$/.exec(body);if(!command||command[2]&&command[2].toLowerCase()!==USERNAME)return Response.json({ok:true});
  if(command[1]==='setup'&&admin){
   for(const title of TOPICS){const existing=await DB.from('gidra_internal_topics').select('thread_id').eq('chat_id',CHAT).eq('name',title).maybeSingle();if(existing.error)throw existing.error;if(existing.data)continue;const topic=await api('createForumTopic',{chat_id:CHAT,name:title});const r=await DB.from('gidra_internal_topics').insert({chat_id:CHAT,name:title,thread_id:topic.message_thread_id});if(r.error)throw r.error;}
   await say(thread,'Теми створені. Робоча «Бухгалтерия» не змінюється. /menu — створити першу задачу.');
  }else if(command[1]==='task'){if(command[3])await create(m,command[3]);else await prompt(thread,m.from.id,'new');}
  else if(command[1]==='tasks'||command[1]==='mine')await list(thread,m.from.id,command[1]==='mine');
  else await say(thread,'<b>Гідра Сервіс · ТЕСТ задач</b>\nОдна задача — одна картка. Файли й уточнення залишаються в її обговоренні. Кнопка «Готово» не проводить оплату.\n\n/task — нова задача; /tasks — відкриті; /mine — мої.',{inline_keyboard:[[{text:'➕ Нова задача',callback_data:'new'}],[{text:'📋 Відкриті',callback_data:'tasks'},{text:'🙋 Мої',callback_data:'mine'}]]});
 }
 return Response.json({ok:true});
 }catch{console.error('Internal task bot request failed');configured=null;return new Response('Temporary processing error',{status:503});}
});
