import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, Json } from '@/integrations/supabase/types';
import type { Terms } from './engine';
import { toast } from 'sonner';
export type TableName = 'finance_projects'|'finance_tasks'|'finance_documents'|'finance_invoices'|'finance_monthly_actuals'|'finance_history'|'finance_company'|'finance_counterparties'|'finance_entries'|'finance_expenses';
export type FinanceRow = {id:string|number;[key:string]:unknown};
export interface Project {id:string;name:string;status:string;terms:Terms}
export const tables:TableName[]=['finance_projects','finance_tasks','finance_documents','finance_invoices','finance_monthly_actuals','finance_history','finance_company','finance_counterparties','finance_entries','finance_expenses'];
export function useFinanceData() {
 const client=useQueryClient();
 const query=useQuery({queryKey:['finance'],queryFn:async()=>{
  const results=await Promise.all(tables.map(async table=>{const {data,error}=await supabase.from(table).select('*');if(error)throw error;return [table,data] as const;}));
  return Object.fromEntries(results) as Record<TableName,FinanceRow[]>;
 }});
 async function save(table:TableName,record:Record<string,unknown>,existing=false){
  const cleaned=Object.fromEntries(Object.entries(record).filter(([k])=>k!=='created_at'&&k!=='updated_at'));
  type Insert=Database['public']['Tables'][TableName]['Insert'];
  const result=existing?await supabase.from(table).update(cleaned as Insert).eq('id',record.id as string).select():await supabase.from(table).insert(cleaned as Insert).select();
  if(result.error){toast.error(result.error.message);throw result.error;} await client.invalidateQueries({queryKey:['finance']});toast.success('저장되었습니다 / Saved');return result.data as FinanceRow[];
 }
 async function remove(table:TableName,id:string|number){const {error}=await supabase.from(table).delete().eq('id',id);if(error){toast.error(error.message);throw error;}await client.invalidateQueries({queryKey:['finance']});toast.success('삭제되었습니다 / Deleted');}
 return {...query,save,remove,refresh:()=>client.invalidateQueries({queryKey:['finance']})};
}
export function asJson(value:unknown):Json {return value as Json;}
