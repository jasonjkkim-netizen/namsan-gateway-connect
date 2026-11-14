import { createContext, useContext } from 'react';
import { useFinanceData } from './data';
export type FinanceContextValue = ReturnType<typeof useFinanceData>;
export const FinanceContext=createContext<FinanceContextValue|null>(null);
export function useFinance(){const c=useContext(FinanceContext);if(!c)throw new Error('Missing finance provider');return c;}
