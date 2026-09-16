import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, ClipboardCheck, FileText, Search, TriangleAlert, Wallet } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabase';

type Item = { id:string; title:string; description:string; type:'application'|'problem'|'act'|'payout'; createdAt:string; read:boolean };
const KEY='rvp-notification-center-v2';

interface Props {
  onNavigateToApplications?: () => void;
  onNavigateToActs?: () => void;
  onNavigateToPayouts?: () => void;
}

export default function Notifications({ onNavigateToApplications, onNavigateToActs, onNavigateToPayouts }: Props) {
  const [items,setItems]=useState<Item[]>(() => { try { return JSON.parse(localStorage.getItem(KEY)||'[]'); } catch { return []; }});
  const [search,setSearch]=useState('');
  useEffect(()=>{ localStorage.setItem(KEY,JSON.stringify(items.slice(0,200))); },[items]);

  useEffect(()=>{
    const add=(item:Item)=>setItems(prev=>[item,...prev.filter(x=>x.id!==item.id)].slice(0,200));
    const apps=supabase.channel('notification-center-apps')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'applications'},p=>{
        const r:any=p.new; add({id:`app-${r.id}-${Date.now()}`,title:`Нова заявка ${r.application_number||''}`,description:r.title||r.address||'Створено заявку',type:'application',createdAt:new Date().toISOString(),read:false});
      })
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'applications'},p=>{
        const r:any=p.new;
        if(r.contractor_stage==='problem') add({id:`problem-${r.id}-${r.updated_at||Date.now()}`,title:`Проблема ${r.application_number||''}`,description:r.title||r.address||'Підрядник повідомив про проблему',type:'problem',createdAt:new Date().toISOString(),read:false});
        if(r.payout_status==='pending') add({id:`pay-${r.id}-${r.updated_at||Date.now()}`,title:`Очікує виплати ${r.application_number||''}`,description:`Сума: ${Number(r.payout_amount||0).toLocaleString('uk-UA')} ₴`,type:'payout',createdAt:new Date().toISOString(),read:false});
      }).subscribe();

    const acts=supabase.channel('notification-center-acts')
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'acts'},p=>{
        const r:any=p.new; add({id:`act-${r.id}`,title:'Новий акт на перевірці',description:r.act_number?`Акт ${r.act_number}`:'Підрядник завантажив акт',type:'act',createdAt:new Date().toISOString(),read:false});
      }).subscribe();

    return()=>{supabase.removeChannel(apps);supabase.removeChannel(acts);};
  },[]);

  const filtered=useMemo(()=>{const q=search.toLowerCase().trim();return q?items.filter(x=>`${x.title} ${x.description}`.toLowerCase().includes(q)):items;},[items,search]);
  const unread=items.filter(x=>!x.read).length;
  const icon=(type:Item['type'])=> type==='problem'?<TriangleAlert size={16}/>:type==='act'?<ClipboardCheck size={16}/>:type==='payout'?<Wallet size={16}/>:<FileText size={16}/>;

  const openItem = (item: Item) => {
    setItems(p=>p.map(x=>x.id===item.id?{...x,read:true}:x));
    if (item.type === 'act') onNavigateToActs?.();
    else if (item.type === 'payout') onNavigateToPayouts?.();
    else onNavigateToApplications?.();
  };

  return <PageHeader pageTitle="Сповіщення" pageSubtitle={`${unread} непрочитаних`}
    actions={<div className="flex gap-2"><button onClick={()=>setItems(p=>p.map(x=>({...x,read:true})))} className="flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-300 hover:bg-white/10"><CheckCheck size={14}/>Прочитати все</button><button onClick={()=>setItems([])} className="rounded-lg bg-white/5 px-3 py-2 text-sm text-slate-400 hover:bg-white/10">Очистити</button></div>}>
    <div className="mb-4 rounded-xl border border-white/5 bg-[#141821] p-4"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Пошук..." className="w-full rounded-lg border border-white/5 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-slate-200 outline-none"/></div></div>
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#141821]">
      {filtered.length===0?<div className="py-20 text-center"><Bell size={24} className="mx-auto text-slate-600"/><p className="mt-3 text-sm text-slate-400">Сповіщень поки немає</p></div>:
      filtered.map(item=><button key={item.id} onClick={()=>openItem(item)} className="flex w-full items-start gap-4 border-b border-white/5 px-5 py-4 text-left last:border-0 hover:bg-white/[0.025]">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${item.type==='problem'?'bg-red-500/10 text-red-400':item.type==='act'?'bg-amber-500/10 text-amber-400':item.type==='payout'?'bg-violet-500/10 text-violet-400':'bg-blue-500/10 text-blue-400'}`}>{icon(item.type)}</div>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium text-slate-200">{item.title}</p>{!item.read&&<span className="h-1.5 w-1.5 rounded-full bg-blue-400"/>}</div><p className="mt-1 text-sm text-slate-500">{item.description}</p><p className="mt-2 text-xs text-slate-600">{new Date(item.createdAt).toLocaleString('uk-UA')}</p></div>
      </button>)}
    </div>
  </PageHeader>;
}