import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const access = vi.hoisted(() => ({
  user: null as null | { id: string },
  sources: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: access.user }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'en', t: (key: string) => key }) }));
vi.mock('@/components/Header', () => ({ Header: () => null }));
vi.mock('@/components/market/ProductShowcaseSection', () => ({ ProductShowcaseSection: () => { access.sources('investment_products'); return null; } }));
vi.mock('@/components/flagship/FlagshipPortfolio', () => ({ FlagshipPortfolio: () => { access.sources('flagship_portfolio_items'); return null; } }));
vi.mock('@/components/market/InterestNewsSection', () => ({ InterestNewsSection: () => { access.sources('research_reports'); return null; } }));
vi.mock('@/components/market/StockPickNewsSection', () => ({ StockPickNewsSection: () => { access.sources('stock_pick_news'); return null; } }));
vi.mock('@/components/market/RiskReturnMatrix', () => ({ RiskReturnMatrix: () => { access.sources('app_settings'); return null; } }));
vi.mock('@/components/market/MarketNewsSection', () => ({ MarketNewsSection: () => null }));
vi.mock('@/components/market/WeeklyStockPicksTable', () => ({ WeeklyStockPicksTable: () => null }));
vi.mock('@/components/market/NamsanViewpointSection', () => ({ NamsanViewpointSection: () => null }));
vi.mock('@/components/market/MarketOverviewSection', () => ({ MarketOverviewSection: () => null }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: (table: string) => {
  access.sources(table);
  return { select: () => ({ eq: () => ({ order: async () => ({ data: [], error: null }) }) }) };
} } }));

import MarketData from './MarketData';

function openMarket() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><MarketData /></MemoryRouter></QueryClientProvider>);
}

describe('Market Data access boundaries', () => {
  beforeEach(() => { access.user = null; access.sources.mockClear(); });
  it('signed-out visitors read market indices without activating private data sources', async () => {
    openMarket();
    await waitFor(() => expect(access.sources).toHaveBeenCalledWith('market_indices'));
    for (const table of ['investment_products', 'research_reports', 'flagship_portfolio_items', 'stock_pick_news', 'app_settings']) {
      expect(access.sources).not.toHaveBeenCalledWith(table);
    }
  });
  it('signed-in members retain private widgets subject to their database policies', () => {
    access.user = { id: 'member' };
    openMarket();
    for (const table of ['investment_products', 'research_reports', 'flagship_portfolio_items', 'stock_pick_news', 'app_settings']) {
      expect(access.sources).toHaveBeenCalledWith(table);
    }
  });
});