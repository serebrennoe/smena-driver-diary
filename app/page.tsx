'use client';
import { useCallback, useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, CreditCard, Banknote, CarFront, Clock3, X, Check, CircleAlert, RotateCcw, ArrowUpRight, Route, Wallet, LoaderCircle } from 'lucide-react';
import type { Trip, Summary, Payment } from '@/lib/trips';

type DayData = { date: string; trips: Trip[]; summary: Summary };
const money = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(n);
const time = (s: string) => new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Almaty', hour: '2-digit', minute: '2-digit' }).format(new Date(s));
const dateObj = (s: string) => new Date(s + 'T12:00:00+05:00');
const shift = (s: string, n: number) => { const d = dateObj(s); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const longDate = (s: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Almaty' }).format(dateObj(s));
const duration = (n: number) => { const m = Math.round(n); return m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}` : `${m} мин`; };
const plural = (n: number) => n % 10 === 1 && n % 100 !== 11 ? 'поездка' : n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14) ? 'поездки' : 'поездок';

function Sheet({ title, children, close, className = '' }: { title: string; children: ReactNode; close: () => void; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current!; d.showModal(); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = prev; d.close(); }; }, []);
  return <dialog ref={ref} className={`sheet ${className}`} aria-labelledby="sheet-title" onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="sheet-inner"><div className="sheet-handle" /><header className="sheet-head"><h2 id="sheet-title">{title}</h2><button className="icon-button" aria-label="Закрыть" onClick={close}><X size={22}/></button></header>{children}</div>
  </dialog>;
}

function TripForm({ date, close, saved }: { date: string; close: () => void; saved: (day: string, duplicate: boolean) => void }) {
  const [v, setV] = useState({ date, start: '15:00', end: '15:25', amount: '', commission: '', payment: 'card' as Payment, overnight: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false), [failure, setFailure] = useState('');
  const key = useRef(crypto.randomUUID());
  function field(name: string, value: string | boolean) { setV(p => ({ ...p, [name]: value })); key.current = crypto.randomUUID(); setErrors(p => ({ ...p, [name]: '' })); setFailure(''); }
  const amount = Number(v.amount.replace(',', '.')), fee = Number(v.commission.replace(',', '.'));
  async function submit(event: FormEvent) {
    event.preventDefault(); if (pending) return;
    const e: Record<string, string> = {};
    if (!v.date) e.date = 'Выберите дату.';
    if (!v.start) e.start = 'Укажите начало.';
    if (!v.end || (!v.overnight && v.end <= v.start)) e.end = 'Окончание должно быть позже начала.';
    if (!v.amount || !Number.isFinite(amount) || amount <= 0) e.amount = 'Введите сумму больше нуля.';
    if (!v.commission || !Number.isFinite(fee) || fee < 0 || fee > amount) e.commission = 'Введите комиссию от 0 до суммы поездки.';
    if (Object.keys(e).length) { setErrors(e); return; }
    setPending(true); setFailure('');
    try {
      const response = await fetch('/api/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: key.current, start: `${v.date}T${v.start}:00+05:00`, end: `${v.overnight ? shift(v.date, 1) : v.date}T${v.end}:00+05:00`, amount, commission: fee, payment: v.payment }) });
      const result = await response.json() as { fields?: Record<string, string>; error?: string; day: string; duplicate: boolean };
      if (!response.ok) { setErrors(result.fields ?? {}); throw new Error(result.error ?? 'Не удалось сохранить поездку.'); }
      saved(result.day, result.duplicate);
    } catch (error) { setFailure(error instanceof Error ? error.message : 'Нет соединения. Данные формы сохранены, попробуйте ещё раз.'); }
    finally { setPending(false); }
  }
  const err = (name: string) => errors[name] ? <span className="field-error" id={`${name}-error`}>{errors[name]}</span> : null;
  return <Sheet title="Новая поездка" close={() => { if (!pending) close(); }}>
    <form onSubmit={submit} noValidate className="trip-form">
      <fieldset disabled={pending}>
        <label className="field">Дата поездки<input autoFocus type="date" value={v.date} onChange={e => field('date', e.target.value)} aria-invalid={!!errors.date} aria-describedby={errors.date ? 'date-error' : undefined}/>{err('date')}</label>
        <div className="field-grid"><label className="field">Начало<input type="time" value={v.start} onChange={e => field('start', e.target.value)} aria-invalid={!!errors.start} aria-describedby={errors.start ? 'start-error' : undefined}/>{err('start')}</label><label className="field">Окончание<input type="time" value={v.end} onChange={e => field('end', e.target.value)} aria-invalid={!!errors.end} aria-describedby={errors.end ? 'end-error' : undefined}/>{err('end')}</label></div>
        <label className="check-field"><input type="checkbox" checked={v.overnight} onChange={e => field('overnight', e.target.checked)}/> Закончилась на следующий день</label>
        <div className="field-grid"><label className="field">Сумма поездки<div className="money-input"><input type="text" inputMode="decimal" placeholder="0" value={v.amount} onChange={e => field('amount', e.target.value)} aria-invalid={!!errors.amount} aria-describedby={errors.amount ? 'amount-error' : undefined}/><span>₸</span></div>{err('amount')}</label><label className="field">Комиссия<div className="money-input"><input type="text" inputMode="decimal" placeholder="0" value={v.commission} onChange={e => field('commission', e.target.value)} aria-invalid={!!errors.commission} aria-describedby={errors.commission ? 'commission-error' : undefined}/><span>₸</span></div>{err('commission')}</label></div>
        <fieldset className="payment-field"><legend>Способ оплаты</legend><div className="payment-toggle" role="radiogroup" aria-label="Способ оплаты">{(['card', 'cash'] as Payment[]).map(p => <button type="button" key={p} role="radio" aria-checked={v.payment === p} className={v.payment === p ? 'chosen' : ''} onClick={() => field('payment', p)}>{p === 'card' ? <CreditCard size={20}/> : <Banknote size={20}/>} {p === 'card' ? 'Картой' : 'Наличными'}{v.payment === p && <Check size={16}/>}</button>)}</div>{err('payment')}</fieldset>
        <div className="form-net"><div><Wallet size={20}/><span>Останется на руки</span></div><strong>{Number.isFinite(amount) && Number.isFinite(fee) && amount >= fee && amount > 0 ? money(amount - fee) : '0'} ₸</strong></div>
      </fieldset>
      {failure && <div className="form-error" role="alert"><CircleAlert size={18}/><span>{failure}</span></div>}
      <button type="submit" className="button primary full" disabled={pending}>{pending ? <><LoaderCircle className="spin" size={20}/>Сохраняем…</> : <><Plus size={20}/>Добавить поездку</>}</button>
      <p className="form-note">Дата и время по Астане · UTC+5</p>
    </form>
  </Sheet>;
}

function TripDetails({ trip: t, close }: { trip: Trip; close: () => void }) {
  return <Sheet title="Детали поездки" close={close} className="details-sheet"><div className="details-content">
    <div className="detail-hero"><span className="detail-car"><CarFront size={30}/></span><span>{longDate(new Date(Date.parse(t.start) + 5 * 3600_000).toISOString().slice(0,10))}</span><h3>{time(t.start)} <span>—</span> {time(t.end)}</h3><p>{duration(t.duration)} в поездке</p></div>
    <dl className="detail-lines"><div><dt>Способ оплаты</dt><dd>{t.payment === 'card' ? 'Картой' : 'Наличными'}</dd></div><div><dt>Сумма поездки</dt><dd>{money(t.amount)} ₸</dd></div><div><dt>Комиссия сервиса</dt><dd>−{money(t.commission)} ₸</dd></div><div className="detail-total"><dt>На руки</dt><dd>{money(t.net)} ₸</dd></div></dl>
    <button className="button primary full" onClick={close}>Понятно</button></div></Sheet>;
}

export default function Home() {
  const [day, setDay] = useState('2026-10-08');
  const [data, setData] = useState<DayData | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0), [adding, setAdding] = useState(false), [selected, setSelected] = useState<Trip | null>(null), [toast, setToast] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    fetch(`/api/trips?date=${day}`, { signal: controller.signal }).then(async r => { const value = await r.json() as DayData & { error?: string }; if (!r.ok) throw new Error(value.error ?? 'Не удалось загрузить поездки.'); return value; }).then(value => { setData(value); setLoading(false); }).catch(e => { if (e.name !== 'AbortError') { setError('Не удалось загрузить день. Проверьте соединение и попробуйте снова.'); setLoading(false); } });
    return () => controller.abort();
  }, [day, refresh]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 4500); return () => clearTimeout(t); }, [toast]);
  const onSaved = useCallback((date: string, duplicate: boolean) => { setAdding(false); setDay(date); setRefresh(n => n + 1); setToast(duplicate ? 'Эта поездка уже есть в дневнике' : 'Поездка добавлена'); }, []);
  const s = data?.summary;
  const weekday = (dateObj(day).getUTCDay() + 6) % 7;
  const week = Array.from({ length: 7 }, (_, i) => shift(day, i - weekday));
  const weekdays = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
  const usable = !loading && !error && !!s;
  return <div className="app-shell">
    <header className="app-header"><a href="/" className="brand" aria-label="Смена, главная"><span className="brand-mark"><Route size={24} strokeWidth={2.3}/></span>смена<span className="brand-dot">.</span></a><div className="header-end"><span className="header-caption">Дневник водителя</span><span className="demo-badge">Демо</span></div></header>
    <main className="main"><div className="page-heading"><div><h1>Мой день</h1></div><button className="button primary desktop-add" onClick={() => setAdding(true)}><Plus size={20}/>Добавить поездку</button></div>
      <section className="date-strip" aria-label="Выбор дня"><div className="date-controls"><div className="date-title"><button className="calendar-control" onClick={() => { try { picker.current?.showPicker(); } catch { picker.current?.focus(); } }} aria-label="Выбрать дату"><CalendarDays size={19}/><span>{new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(dateObj(day)).replace(' г.', '')}</span></button><input className="date-picker" ref={picker} type="date" value={day} aria-label="Дата дневника" onChange={e => { if(e.target.value) setDay(e.target.value); }}/></div><div className="date-arrows"><button className="icon-button" onClick={() => setDay(shift(day, -1))} aria-label="Предыдущий день"><ChevronLeft size={22}/></button><button className="icon-button" onClick={() => setDay(shift(day, 1))} aria-label="Следующий день"><ChevronRight size={22}/></button></div></div><div className="week" role="group" aria-label="Дни недели">{week.map((d, i) => <button key={d} className={`day ${d === day ? 'active' : ''}`} aria-pressed={d === day} aria-label={longDate(d)} onClick={() => setDay(d)}><span>{weekdays[i]}</span><strong>{Number(d.slice(-2))}</strong></button>)}</div></section>
      {error ? <section className="error-state" role="alert"><CircleAlert size={32}/><h2>Дневник пока недоступен</h2><p>{error}</p><button className="button primary" onClick={() => setRefresh(n=>n+1)}><RotateCcw size={18}/>Попробовать снова</button></section> : <div className="day-layout" aria-busy={loading}>
        <aside className="summary-column" aria-label="Сводка за день">
          <section className="earnings"><div className="earnings-top"><span>На руки</span><span className="balance-icon"><ArrowUpRight size={22}/></span></div><div className={`big-money ${loading ? 'is-loading' : ''}`} style={s && s.net >= 1e6 ? { fontSize: s.net >= 1e9 ? '1.8rem' : '2.4rem' } : undefined}>{usable ? money(s!.net) : '0'}<span>₸</span></div><p className="earnings-subtitle">После комиссии сервиса</p><div className="earnings-bottom"><div><span>Выручка</span><strong className={loading?'is-loading':''}>{usable ? money(s!.revenue) : '0'} ₸</strong></div><div><span>Комиссия</span><strong className={loading?'is-loading':''}>−{usable ? money(s!.commission) : '0'} ₸</strong></div></div></section>
          <section className="day-stats"><div><span className="stat-icon"><CarFront size={22}/></span><div><strong className={loading?'is-loading':''}>{usable ? s!.count : '0'}</strong><span>{usable ? plural(s!.count) : 'поездок'}</span></div></div><div><span className="stat-icon"><Clock3 size={22}/></span><div><strong className={loading?'is-loading':''}>{usable ? duration(s!.duration) : '0 мин'}</strong><span>в поездках</span></div></div></section>
          <section className="payments"><h2>Способы оплаты</h2><div className="payment-bar" aria-hidden="true"><span style={{width:`${s && s.revenue ? s.card/s.revenue*100 : 50}%`}}/></div><div className="payment-row"><span className="payment-symbol card-symbol"><CreditCard size={20}/></span><span>Картой</span><strong className={loading?'is-loading':''}>{usable ? money(s!.card) : '0'} ₸</strong></div><div className="payment-row"><span className="payment-symbol cash-symbol"><Banknote size={20}/></span><span>Наличными</span><strong className={loading?'is-loading':''}>{usable ? money(s!.cash) : '0'} ₸</strong></div><p className="payment-caption">Суммы до вычета комиссии</p></section>
          
        </aside>
        <section className="trips-panel" aria-labelledby="trips-heading"><div className="trips-heading"><div><h2 id="trips-heading">Поездки <span className="count-badge">{usable ? s!.count : '·'}</span></h2><p>{longDate(day)} · Сначала новые</p></div><span className="trips-heading-icon"><Route size={23}/></span></div>
          {loading ? <div className="skeleton-list" aria-label="Загрузка поездок">{[0,1,2,3].map(n=><div className="skeleton-row" key={n}><span/><div><i/><i/></div><i/></div>)}</div> : data?.trips.length ? <div className="trip-list">{data.trips.map(t => <button className="trip-row" key={t.id} onClick={() => setSelected(t)} aria-label={`Поездка ${time(t.start)}, сумма ${money(t.amount)} тенге, открыть детали`}><span className="trip-icon"><CarFront size={23}/></span><div className="trip-info"><strong>{time(t.start)} <span>—</span> {time(t.end)}</strong><div className="trip-meta"><span>{duration(t.duration)}</span><span className="meta-separator">·</span><span>{t.payment==='card'?<CreditCard size={13}/>:<Banknote size={14}/>} {t.payment==='card'?'Картой':'Наличными'}</span></div></div><div className="trip-money"><strong>{money(t.amount)} <span>₸</span></strong><span>На руки {money(t.net)} ₸</span></div><ChevronRight className="row-chevron" size={18}/></button>)}</div> : <div className="empty-state"><span><CarFront size={34}/></span><h3>Новый день, новые поездки</h3><p>Добавьте первую поездку.<br/>Заработок посчитается сам.</p><button className="button secondary" onClick={()=>setAdding(true)}><Plus size={18}/>Добавить поездку</button></div>}
          {!loading && !!data?.trips.length && <div className="list-total"><span>Итого на руки</span><strong>{money(s!.net)} ₸</strong></div>}
        </section>
      </div>}
      <footer className="page-footer"><span>₸ KZT <span>·</span> Время Астаны</span></footer>
    </main>
    <div className="mobile-action"><button className="button primary full" onClick={()=>setAdding(true)}><Plus size={21}/>Добавить поездку</button></div>
    {toast && <div className="toast" role="status"><span><Check size={16}/></span>{toast}</div>}
    {adding && <TripForm date={day} close={()=>setAdding(false)} saved={onSaved}/>}
    {selected && <TripDetails trip={selected} close={()=>setSelected(null)}/>}
  </div>;
}
