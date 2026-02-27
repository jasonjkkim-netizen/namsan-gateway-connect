import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PortfolioItem, PortfolioItemRow } from './portfolioTypes';
import { mapRowToItem } from './portfolioUtils';

export function usePortfolioData() {
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItems() {
      setLoading(true);
      const { data, error } = await supabase
        .from('flagship_portfolio_items')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (!error && data) {
        setItems((data as unknown as PortfolioItemRow[]).map(mapRowToItem));
      }
      setLoading(false);
    }
    fetchItems();
  }, []);

  return { items, loading };
}
