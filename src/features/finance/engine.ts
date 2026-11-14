export type Terms = Record<string, string | number | boolean | null>;
export interface Actual { id?: string; project_id: string; month: string; currency: string; actual_paid: number; actual_received: number; average_power_kw: number }
export const DEFAULT_TERMS: Terms = {capacity_kw:1500,racks:100,kw_per_rack:15,rent:370000,internet:3500000,power:192384,vat:10,deposit_months:6,term_months:60,elapsed_months:6,escalation:3,penalty:60,start_date:'2026-12-01',rates_vat_included:false,deposit_vat_included:true};
export function number(t: Terms, key: string, fallback = 0) { const v=t[key]; return v === null || v === undefined || v === '' ? fallback : Number(v); }
export function money(value: number, currency = 'KRW') { return `${currency} ${new Intl.NumberFormat('ko-KR',{minimumFractionDigits:currency==='USD'?2:0,maximumFractionDigits:currency==='USD'?2:0}).format(value)}`; }
export function kstToday(now = new Date()) { return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(now); }
export function monthIndex(value: string) { const [y,m]=value.split('-').map(Number); return y*12+m-1; }
export function monthString(index: number) { return `${Math.floor(index/12)}-${String(index%12+1).padStart(2,'0')}-01`; }
export function costs(t: Terms, year = 0) {
 const vat=t.rates_vat_included ? 1 : 1+number(t,'vat',10)/100;
 const growth=Math.pow(1+number(t,'escalation',3)/100,year);
 const rent=Math.round(number(t,'capacity_kw',1500)*number(t,'rent',370000)*vat*growth);
 const internet=Math.round(number(t,'internet',3500000)*vat);
 const power=Math.round(number(t,'capacity_kw',1500)*number(t,'power',192384)*vat);
 return {rent,internet,power,fixed:rent+internet};
}
export function deposits(t: Terms = DEFAULT_TERMS) {
 const total=costs(t).fixed*number(t,'deposit_months',6);
 const first=Math.round(total*.1),second=Math.round(total*.2);
 return {total,stages:[{date:String(t.first_due||'2026-11-13'),amount:first,percent:10},{date:String(t.second_due||'2026-11-18'),amount:second,percent:20},{date:String(t.final_due||'2026-11-30'),amount:total-first-second,percent:70}]};
}
export function termination(t: Terms, elapsed: number, deduction=0) {
 const total=number(t,'term_months',60),clamped=Math.max(0,Math.min(total,elapsed));
 let remainingRent=0;
 for(let m=clamped;m<total;m++) remainingRent+=costs(t,Math.floor(m/12)).rent;
 const penalty=Math.round(remainingRent*number(t,'penalty',60)/100);
 return {remainingRent,penalty,deduction,total:penalty+deduction};
}
export interface CashMonth {month:string;domestic:number;sublease:number;depositPaid:number;depositReceived:number;scheduledNet:number;actualPaid:number;actualReceived:number;actualNet:number;domesticPower:number;subleasePower:number}
export function cashMonth(month: string, lease: Terms=DEFAULT_TERMS, sub: Terms={...DEFAULT_TERMS,schedule_premium_percent:1.5,service_fee:1248750000,overseas_deposit:7482783000}, actuals: Actual[]=[]): CashMonth {
 const index=monthIndex(month),start=monthIndex(String(lease.start_date||'2026-12-01')),subStart=monthIndex(String(sub.start_date||'2026-12-01'));
 const elapsed=index-start,subElapsed=index-subStart;
 const active=elapsed>=0&&elapsed<number(lease,'term_months',60),subActive=subElapsed>=0&&subElapsed<number(sub,'term_months',60);
 const prev=monthString(index-1);
 const masterKw=actuals.find(a=>a.project_id==='lease'&&a.month===prev)?.average_power_kw ?? number(lease,'capacity_kw',1500);
 const subKw=actuals.find(a=>a.project_id==='sub'&&a.month===prev)?.average_power_kw ?? number(sub,'capacity_kw',1500);
 const premium=1+number(sub,'schedule_premium_percent',1.5)/100;
 const domesticPower=elapsed>0&&elapsed<=number(lease,'term_months',60)?Math.round(masterKw*number(lease,'power',192384)*(lease.rates_vat_included?1:1+number(lease,'vat',10)/100)):0;
 const subleasePower=subElapsed>0&&subElapsed<=number(sub,'term_months',60)?Math.round(subKw*number(sub,'power',192384)*(sub.rates_vat_included?1:1+number(sub,'vat',10)/100)*premium):0;
 const master=costs(lease,Math.max(0,Math.floor(elapsed/12))),tenant=costs(sub,Math.max(0,Math.floor(subElapsed/12)));
 const domestic=(active?master.fixed:0)+domesticPower;
 const sublease=(subActive?Math.round(tenant.rent*premium)+Math.round(tenant.internet*premium)+(subElapsed<12?number(sub,'service_fee',1248750000):0):0)+subleasePower;
 const depositPaid=deposits(lease).stages.filter(d=>d.date.slice(0,7)===month.slice(0,7)).reduce((sum,d)=>sum+d.amount,0);
 const depositReceived=month.slice(0,7)===String(sub.overseas_due||'2026-11-16').slice(0,7)?number(sub,'overseas_deposit',7482783000):0;
 const rows=actuals.filter(a=>a.month.slice(0,7)===month.slice(0,7)&&a.currency==='KRW'&&['lease','sub'].includes(a.project_id));
 const actualPaid=rows.reduce((s,a)=>s+Number(a.actual_paid),0),actualReceived=rows.reduce((s,a)=>s+Number(a.actual_received),0);
 return {month,domestic,sublease,depositPaid,depositReceived,scheduledNet:sublease+depositReceived-domestic-depositPaid,actualPaid,actualReceived,actualNet:actualReceived-actualPaid,domesticPower,subleasePower};
}
export function cashYears() {return Array.from({length:7},(_,i)=>2026+i);}
export function cashMonths(year: number,lease:Terms,sub:Terms,actuals:Actual[]) {return Array.from({length:12},(_,i)=>`${year}-${String(i+1).padStart(2,'0')}-01`).filter(m=>m>='2026-11-01'&&m<='2032-12-01').map(m=>cashMonth(m,lease,sub,actuals));}
export function canOpenFinance(user: unknown, role: string|null|undefined) {return Boolean(user)&&role==='webmaster';}
export function earliestDeadline<T extends {due_date:string|null;status:string}>(tasks:T[]) {return tasks.filter(t=>t.status!=='done'&&t.due_date).sort((a,b)=>(a.due_date||'').localeCompare(b.due_date||''))[0];}
export const comparisonKeys=['party','address','capacity_kw','rent','currency','vat','payment_schedule','delivery_date','start_date','deposit_months','first_due','second_due','final_due','payment_days','metered_minimum','handover','escalation','term_months','penalty','inspection','title_condition','title_date','rates_vat_included'];
export function compare(a: unknown,b:unknown) {if(a===undefined||a===null||a===''||b===undefined||b===null||b===''||String(a).toLowerCase().includes('checking')||String(b).toLowerCase().includes('checking'))return 'insufficient evidence'; return String(a)===String(b)?'match':'mismatch';}
