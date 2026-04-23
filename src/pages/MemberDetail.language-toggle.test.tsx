import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import MemberDetail from '@/pages/MemberDetail';
import { LanguageProvider } from '@/contexts/LanguageContext';

const { mockUseAuth, authSignOutMock, supabaseMock } = vi.hoisted(() => {
  const authSignOutMock = vi.fn();
  const supabaseMock = {
    auth: {
      signOut: authSignOutMock,
    },
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(() => ({ id: 'channel-1' })),
    })),
    removeChannel: vi.fn(),
    rpc: vi.fn((fn: string) => {
      if (fn === 'get_sales_ancestors' || fn === 'get_sales_subtree') {
        return Promise.resolve({ data: [], error: null });
      }

      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn((table: string) => createQueryBuilder(table)),
  };

  return {
    mockUseAuth: vi.fn(),
    authSignOutMock,
    supabaseMock,
  };
});

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/components/NotificationBell', () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

vi.mock('@/components/ConsultationButton', () => ({
  ConsultationButton: () => <button type="button">Consultation</button>,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: supabaseMock,
}));

function createQueryBuilder(table: string) {
  const state: Record<string, unknown> = {};

  const resolveResult = () => {
    if (table === 'profiles') {
      return {
        data: {
          user_id: 'member-1',
          email: 'member@example.com',
          full_name: 'Kwon Migi',
          full_name_ko: '권미기',
          phone: null,
          address: null,
          birthday: null,
          sales_role: 'client',
          sales_status: 'active',
          sales_level: 5,
          parent_id: null,
          admin_notes: null,
          created_at: '2026-01-01T00:00:00Z',
          is_approved: true,
        },
        error: null,
      };
    }

    if (table === 'client_investments') {
      return {
        data: [
          {
            id: 'investment-1',
            product_id: 'product-1',
            product_name_en: 'Test Bond',
            product_name_ko: '테스트 채권',
            investment_amount: 100000,
            current_value: 98500,
            status: 'active',
            start_date: '2026-01-01',
            maturity_date: null,
            invested_currency: 'USD',
            realized_return_amount: 0,
          },
        ],
        error: null,
      };
    }

    if (table === 'commission_distributions') {
      return { data: [], error: null };
    }

    if (table === 'investment_products') {
      return {
        data: [
          {
            id: 'product-1',
            fixed_return_percent: 12,
            target_return: null,
            maturity_date: null,
          },
        ],
        error: null,
      };
    }

    return { data: [], error: null };
  };

  const builder = {
    select: vi.fn((value: string) => {
      state.select = value;
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      state[column] = value;
      return builder;
    }),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => Promise.resolve(resolveResult())),
    then: (resolve: (value: unknown) => unknown, reject?: (reason?: unknown) => unknown) =>
      Promise.resolve(resolveResult()).then(resolve, reject),
  };

  return builder;
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}{location.search}</div>;
}

function extractNumericText(value: string | null) {
  return (value || '').replace(/[^0-9.-]/g, '');
}

describe('MemberDetail language toggle valuation consistency', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T00:00:00Z'));
    localStorage.setItem('preferredLanguage', 'ko');
    mockUseAuth.mockReturnValue({
      user: { id: 'member-1', email: 'member@example.com' },
      session: null,
      profile: { sales_role: 'client', full_name: 'Kwon Migi', full_name_ko: '권미기' },
      isAdmin: false,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: authSignOutMock,
    });
  });

  it('keeps accrued interest and mark-to-market values the same after toggling KR/EN on the investments tab', async () => {
    render(
      <MemoryRouter initialEntries={['/members/member-1?tab=investments']}>
        <LanguageProvider>
          <Routes>
            <Route
              path="/members/:userId"
              element={
                <>
                  <LocationDisplay />
                  <MemberDetail />
                </>
              }
            />
          </Routes>
        </LanguageProvider>
      </MemoryRouter>
    );

    const koreanProduct = await screen.findByText('테스트 채권');
    const koreanRow = koreanProduct.closest('tr');
    expect(koreanRow).not.toBeNull();

    const koreanCells = within(koreanRow as HTMLElement).getAllByRole('cell');
    const currentValueKo = extractNumericText(koreanCells[2].textContent);
    const returnValueKo = extractNumericText(koreanCells[3].textContent);

    expect(screen.getByTestId('location-display')).toHaveTextContent('/members/member-1?tab=investments');

    fireEvent.click(screen.getByRole('button', { name: /EN/i }));

    const englishProduct = await screen.findByText('Test Bond');
    const englishRow = englishProduct.closest('tr');
    expect(englishRow).not.toBeNull();

    const englishCells = within(englishRow as HTMLElement).getAllByRole('cell');
    const currentValueEn = extractNumericText(englishCells[2].textContent);
    const returnValueEn = extractNumericText(englishCells[3].textContent);

    expect(currentValueEn).toBe(currentValueKo);
    expect(returnValueEn).toBe(returnValueKo);

    await waitFor(() => {
      expect(screen.getByTestId('location-display')).toHaveTextContent('/members/member-1?tab=investments');
    });
  });
});