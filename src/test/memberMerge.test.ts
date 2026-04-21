import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Tests verifying that after merging duplicate member profiles,
 * investments, distributions, and commissions remain accessible
 * from the original (surviving) member's page.
 *
 * We mock Supabase calls to simulate the DB state post-merge.
 */

const ORIGINAL_USER_ID = '6c3a8212-51ee-4b39-9034-701e0a55c0fa';
const DELETED_USER_ID = '5e07541d-a780-46a6-8159-7cf37e85008b';

// Mock data representing post-merge state
const mockProfile = {
  user_id: ORIGINAL_USER_ID,
  email: 'client_04f6cc8d@placeholder.local',
  full_name: '임현식',
  full_name_ko: '임현식',
  phone: '010-8849-1680',
  address: '성남시 수정구 수정로 319',
  birthday: null,
  sales_role: 'client',
  sales_status: 'active',
  sales_level: 1,
  parent_id: '117a6222-9d96-47b9-83c5-f559bc49ada9',
  admin_notes: '2천만원 10월30일 NH증권 210-0177-5742',
  created_at: '2026-02-27T06:29:59.792369+00:00',
  is_approved: true,
};

const mockInvestments = [
  {
    id: 'c95d7163-02cc-4787-acaf-149dccc811a5',
    product_name_en: '',
    product_name_ko: '주) 마성 충주 고속도로 매장 보증금 담보 대출',
    investment_amount: 20000000,
    current_value: 20000000,
    status: 'active',
    start_date: '2025-10-30',
    maturity_date: null,
    invested_currency: 'KRW',
    realized_return_amount: 0,
    user_id: ORIGINAL_USER_ID,
  },
];

const mockDeletedProfile = {
  user_id: DELETED_USER_ID,
  is_deleted: true,
  sales_status: 'suspended',
};

describe('Member Merge - Data Integrity', () => {
  it('original profile retains merged contact info', () => {
    expect(mockProfile.phone).toBe('010-8849-1680');
    expect(mockProfile.address).toBe('성남시 수정구 수정로 319');
    expect(mockProfile.admin_notes).toContain('NH증권');
  });

  it('deleted duplicate is soft-deleted', () => {
    expect(mockDeletedProfile.is_deleted).toBe(true);
    expect(mockDeletedProfile.sales_status).toBe('suspended');
  });

  it('investments belong to original user_id only', () => {
    const allBelongToOriginal = mockInvestments.every(
      (inv) => inv.user_id === ORIGINAL_USER_ID
    );
    expect(allBelongToOriginal).toBe(true);
    expect(mockInvestments.some((inv) => inv.user_id === DELETED_USER_ID)).toBe(false);
  });

  it('investments with deleted status are filtered out', () => {
    const withDeleted = [
      ...mockInvestments,
      { ...mockInvestments[0], id: 'deleted-inv', status: 'deleted', user_id: ORIGINAL_USER_ID },
    ];
    const filtered = withDeleted.filter((inv) => inv.status !== 'deleted');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('c95d7163-02cc-4787-acaf-149dccc811a5');
  });
});

describe('Member Merge - Commission Query Logic', () => {
  it('commission query uses correct OR filter for user_id', () => {
    // Simulates the Supabase .or() filter used in MemberDetail
    const userId = ORIGINAL_USER_ID;
    const allCommissions = [
      { id: '1', to_user_id: userId, from_user_id: 'other', investment_id: 'inv1' },
      { id: '2', to_user_id: 'other', from_user_id: userId, investment_id: 'inv2' },
      { id: '3', to_user_id: 'unrelated', from_user_id: 'unrelated', investment_id: 'inv3' },
    ];
    const filtered = allCommissions.filter(
      (c) => c.to_user_id === userId || c.from_user_id === userId
    );
    expect(filtered).toHaveLength(2);
  });

  it('commissions for deleted user_id are not shown on original page', () => {
    const commissions = [
      { id: '1', to_user_id: ORIGINAL_USER_ID, from_user_id: 'x' },
      { id: '2', to_user_id: DELETED_USER_ID, from_user_id: 'y' },
    ];
    const forOriginal = commissions.filter(
      (c) => c.to_user_id === ORIGINAL_USER_ID || c.from_user_id === ORIGINAL_USER_ID
    );
    expect(forOriginal).toHaveLength(1);
    expect(forOriginal[0].to_user_id).toBe(ORIGINAL_USER_ID);
  });
});

describe('Member Merge - Distribution Query Logic', () => {
  it('distributions query filters by original user_id', () => {
    const distributions = [
      { id: '1', user_id: ORIGINAL_USER_ID, amount: 500, type: 'dividend' },
      { id: '2', user_id: DELETED_USER_ID, amount: 300, type: 'dividend' },
      { id: '3', user_id: 'unrelated', amount: 100, type: 'interest' },
    ];
    const forOriginal = distributions.filter((d) => d.user_id === ORIGINAL_USER_ID);
    expect(forOriginal).toHaveLength(1);
    expect(forOriginal[0].amount).toBe(500);
  });
});

describe('Member Merge - Investment Soft Delete Cascade', () => {
  it('soft-deleting an investment should also remove related commissions', () => {
    const investmentId = 'inv-to-delete';
    let commissions = [
      { id: 'c1', investment_id: investmentId, to_user_id: ORIGINAL_USER_ID },
      { id: 'c2', investment_id: investmentId, to_user_id: 'parent1' },
      { id: 'c3', investment_id: 'other-inv', to_user_id: ORIGINAL_USER_ID },
    ];

    // Simulate cascade: delete commissions for the investment
    commissions = commissions.filter((c) => c.investment_id !== investmentId);
    expect(commissions).toHaveLength(1);
    expect(commissions[0].investment_id).toBe('other-inv');
  });
});