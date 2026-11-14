import { describe,it,expect } from 'vitest';
import { DEFAULT_TERMS, cashMonth, costs, deposits, canOpenFinance, earliestDeadline, termination } from './engine';
const sub={...DEFAULT_TERMS,schedule_premium_percent:1.5,service_fee:1248750000,overseas_deposit:7482783000};
describe('monthly cashflow rules',()=>{
 it('domestic fixed includes VAT exactly once',()=>{expect(costs(DEFAULT_TERMS)).toEqual({rent:610500000,internet:3850000,power:317433600,fixed:614350000});});
 it('first 12 sublease months include service fee',()=>{expect(cashMonth('2026-12-01').sublease).toBe(1872315250);expect(cashMonth('2027-11-01').sublease).toBe(1872315250+322195104);});
 it('service fee stops after month 12 and rent escalates 3%',()=>{expect(cashMonth('2027-12-01').sublease).toBe(Math.round(619657500*1.03)+3907750+322195104);expect(cashMonth('2027-12-01').domestic).toBe(628815000+3850000+317433600);});
 it('power is billed the following month and uses the prior actual kW',()=>{const actual=[{project_id:'lease',month:'2026-12-01',currency:'KRW',actual_paid:100,actual_received:0,average_power_kw:1000}];expect(cashMonth('2026-12-01',DEFAULT_TERMS,sub,actual).domesticPower).toBe(0);expect(cashMonth('2027-01-01',DEFAULT_TERMS,sub,actual).domesticPower).toBe(211622400);});
 it('actuals sum KRW without adding USD',()=>{const actual=[{project_id:'lease',month:'2026-11-01',currency:'KRW',actual_paid:368610000,actual_received:0,average_power_kw:1500},{project_id:'b300',month:'2026-11-01',currency:'USD',actual_paid:50000,actual_received:0,average_power_kw:0}];expect(cashMonth('2026-11-01',DEFAULT_TERMS,sub,actual).actualPaid).toBe(368610000);});
 it('60-month term ends with final power bill the next month',()=>{expect(cashMonth('2031-12-01').domestic).toBe(317433600);expect(cashMonth('2032-01-01').domestic).toBe(0);});
 it('calculates the remaining rent penalty plus extra deduction',()=>{const result=termination({...DEFAULT_TERMS,escalation:0},6,1000);expect(result.penalty).toBe(610500000*54*.6);expect(result.total).toBe(result.penalty+1000);});
});
describe('deposit schedule',()=>{
 it('has exact 10/20/70 payments and dates',()=>{expect(deposits().stages).toEqual([{date:'2026-11-13',amount:368610000,percent:10},{date:'2026-11-18',amount:737220000,percent:20},{date:'2026-11-30',amount:2580270000,percent:70}]);expect(deposits().total).toBe(3686100000);});
 it('overseas deposit, initial receipt and difference match brief',()=>{const november=cashMonth('2026-11-01');expect(november.depositReceived).toBe(7482783000);expect(november.depositReceived+cashMonth('2026-12-01').sublease).toBe(9355098250);expect(november.depositReceived-deposits().total).toBe(3796683000);});
});
describe('webmaster gate',()=>{
 it('signed-in webmaster allowed',()=>expect(canOpenFinance({id:'u'},'webmaster')).toBe(true));
 it('admin without webmaster denied',()=>expect(canOpenFinance({isAdmin:true},'client')).toBe(false));
 it('signed-out webmaster denied',()=>expect(canOpenFinance(null,'webmaster')).toBe(false));
 it('all other or absent roles denied',()=>{for(const role of ['district_manager','agent','client',null,undefined])expect(canOpenFinance({id:'u'},role)).toBe(false);});
 it('earliest open deadline includes overdue, excludes done and undated',()=>{expect(earliestDeadline([{due_date:null,status:'decision needed'},{due_date:'2026-11-12',status:'done'},{due_date:'2026-11-18',status:'confirmed'},{due_date:'2026-11-13',status:'needs checking'}])?.due_date).toBe('2026-11-13');});
});
