import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioItem, PortfolioItemRow } from './portfolioTypes';
import { mapRowToItem } from './portfolioUtils';

export function usePortfolioData() {
  const { data: items = [], isLoading: loading } = useQuery({
    queryKey: ['flagship-portfolio-items'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('flagship_portfolio_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return ((data || []) as unknown as PortfolioItemRow[]).map(mapRowToItem);
    },
    staleTime: 30 * 1000,
  });

  return { items, loading };
}
