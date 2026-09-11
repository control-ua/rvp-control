import { useState } from 'react';
import { Bell, FileText, LayoutDashboard, Menu, Users, X, ClipboardCheck, Wallet, BarChart3, TriangleAlert, MapPinned, ShieldCheck, History, Settings, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Page='dashboard'|'applications'|'contractors'|'acts'|'payouts'|'statistics'|'administrators'|'audit-log'|'notifications'|'settings'|'problems'|'object-map';
interface Props{currentPage:Page;onNavigate:(page:Page)=>void}
const mainItems=[
{id:'dashboard' as Page,label:'Головна',icon:LayoutDashboard},{id:'applications' as Page,label:'Заявки',icon:FileText},
{id:'contractors' as Page,label:'Підрядники',icon:Users},{id:'notifications' as Page,label:'Сповіщення',icon:Bell}];
const moreItems=[
{id:'acts' as Page,label:'Акти',icon:ClipboardCheck},{id:'problems' as Page,label:'Проблеми',icon:TriangleAlert},
{id:'object-map' as Page,label:'Карта обʼєктів',icon:MapPinned},{id:'payouts' as Page,label:'Виплати',icon:Wallet},
{id:'statistics' as Page,label:'Статистика',icon:BarChart3},{id:'administrators' as Page,label:'Адміністратори',icon:ShieldCheck},
{id:'audit-log' as Page,label:'Журнал дій',icon:History},{id:'settings' as Page,label:'Налаштування',icon:Settings}];

export default function MobileNav({currentPage,onNavigate}:Props){
 const[open,setOpen]=useState(false);const go=(p:Page)=>{setOpen(false);onNavigate(p)};
 return <>{open&&<div className="fixed inset-0 z-[70] lg:hidden">
 <button aria-label="Закрити меню" onClick={()=>setOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm"/>
 <div className="absolute bottom-[calc(70px+env(safe-area-inset-bottom))] left-3 right-3 max-h-[68dvh] overflow-y-auto rounded-2xl border border-white/10 bg-[#121720] p-3 shadow-2xl">
 <div className="mb-2 flex items-center justify-between px-2 py-1"><div><p className="text-sm font-semibold text-white">RVP Control</p><p className="text-[11px] text-slate-500">Усі розділи</p></div>
 <button onClick={()=>setOpen(false)} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-slate-400"><X size={18}/></button></div>
 <div className="grid grid-cols-2 gap-2">{moreItems.map(({id,label,icon:Icon})=><button key={id} onClick={()=>go(id)} className={`flex min-h-[62px] items-center gap-3 rounded-xl border px-3 py-3 text-left ${currentPage===id?'border-blue-500/30 bg-blue-500/10 text-blue-400':'border-white/5 bg-white/[0.02] text-slate-400'}`}><Icon size={18}/><span className="text-xs font-medium">{label}</span></button>)}</div>
 <button onClick={()=>supabase.auth.signOut()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/15 bg-red-500/[0.06] py-3 text-sm text-red-400"><LogOut size={16}/>Вийти</button>
 </div></div>}
 <nav className="fixed bottom-0 left-0 right-0 z-[80] border-t border-white/10 bg-[#0f131a]/95 px-1 backdrop-blur-xl lg:hidden" style={{paddingBottom:'env(safe-area-inset-bottom)'}}>
 <div className="mx-auto flex h-16 max-w-xl">{mainItems.map(({id,label,icon:Icon})=><button key={id} onClick={()=>go(id)} className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium ${currentPage===id?'text-blue-400':'text-slate-500'}`}>{currentPage===id&&<span className="absolute top-0 h-0.5 w-8 rounded-full bg-blue-500"/>}<Icon size={19}/><span className="max-w-full truncate px-1">{label}</span></button>)}
 <button onClick={()=>setOpen(v=>!v)} className={`relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium ${open?'text-blue-400':'text-slate-500'}`}>{open&&<span className="absolute top-0 h-0.5 w-8 rounded-full bg-blue-500"/>}<Menu size={19}/><span>Ще</span></button>
 </div></nav></>;
}