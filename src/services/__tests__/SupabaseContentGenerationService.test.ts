import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SupabaseContentGenerationService } from '../SupabaseContentGenerationService';
import { supabase } from '@/integrations/supabase/client';
import type { PieceCapability } from '../contentGeneration/types';

// supabase client is globally mocked in src/test/setup.ts; just mock posthog here.
vi.mock('@/lib/posthogClient', () => ({ captureAlphaEvent: vi.fn() }));

const invoke = vi.mocked(supabase.functions.invoke);

const PIXII_CAP: PieceCapability = {
  provider: 'pixii', capability: 'listing_images', outputKind: 'image', label: 'Listing images', pixiiListingType: 'amazon_listing',
};
const EMAIL_CAP: PieceCapability = {
  provider: 'claude', capability: 'email_copy', outputKind: 'copy', label: 'Email copy',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('start() — Pixii', () => {
  it('routes to pixii-generate with capability + listing_type and returns a pending job', async () => {
    invoke.mockResolvedValue({ data: { ok: true, jobId: 'row-1', externalJobId: 'job-1', status: 'pending' }, error: null } as never);
    const svc = new SupabaseContentGenerationService();
    const { data, error } = await svc.start({
      capability: PIXII_CAP, avatarId: 'av-1', touchpointId: 'amazon_listing_copy', asin: 'B0X', countryCode: 'US',
    });
    expect(error).toBeNull();
    expect(data).toEqual({ provider: 'pixii', jobId: 'row-1', externalJobId: 'job-1', status: 'pending' });
    const [fn, opts] = invoke.mock.calls[0];
    expect(fn).toBe('pixii-generate');
    expect((opts as { body: Record<string, unknown> }).body).toMatchObject({
      capability: 'listing_images', listingType: 'amazon_listing', asin: 'B0X', countryCode: 'US', touchpointId: 'amazon_listing_copy',
    });
  });

  it('surfaces a handled failure (ok:false) with the retry hint', async () => {
    invoke.mockResolvedValue({ data: { ok: false, error: 'Not enough credits', code: 'INSUFFICIENT_CREDITS', retryAfter: 30 }, error: null } as never);
    const svc = new SupabaseContentGenerationService();
    const { data, error } = await svc.start({ capability: PIXII_CAP, avatarId: 'av-1', touchpointId: 'amazon_listing_copy', asin: 'B0X', countryCode: 'US' });
    expect(data).toBeNull();
    expect(error?.message).toBe('Not enough credits (retry in 30s)');
  });
});

describe('start() — Claude', () => {
  it('routes email to brand-copy-generator with format=email and returns completed copy', async () => {
    invoke.mockResolvedValue({ data: { copy: 'Subject: Welcome\nBody…', format: 'email' }, error: null } as never);
    const svc = new SupabaseContentGenerationService();
    const { data, error } = await svc.start({
      capability: EMAIL_CAP, avatarId: 'av-1', touchpointId: 'welcome_series', prompt: 'welcome new buyers', tone: 'warm',
    });
    expect(error).toBeNull();
    expect(data).toMatchObject({ provider: 'claude', status: 'completed', output: { copy: 'Subject: Welcome\nBody…' } });
    const [fn, opts] = invoke.mock.calls[0];
    expect(fn).toBe('brand-copy-generator');
    const body = (opts as { body: Record<string, unknown> }).body;
    expect(body).toMatchObject({ format: 'email', additionalContext: 'welcome new buyers', tone: 'warm' });
    // Regression: brand-copy-generator hard-rejects an empty productName/targetAudience,
    // so the copy path must always send non-empty values for both (else every copy 500s).
    expect(String(body.productName).length).toBeGreaterThan(0);
    expect(String(body.targetAudience).length).toBeGreaterThan(0);
  });

  it('errors when the copy engine returns nothing', async () => {
    invoke.mockResolvedValue({ data: { error: 'model failed' }, error: null } as never);
    const svc = new SupabaseContentGenerationService();
    const { data, error } = await svc.start({ capability: EMAIL_CAP, avatarId: 'av-1', touchpointId: 'welcome_series' });
    expect(data).toBeNull();
    expect(error?.message).toBe('model failed');
  });
});

describe('poll()', () => {
  it('maps a completed Pixii job with images', async () => {
    invoke.mockResolvedValue({ data: { ok: true, status: 'completed', output: { images: [{ storage_path: 'u/funnel/generated/row-1/0.png', signed_url: 'https://s/0', source_url: 'https://cdn.pixii.ai/0.png' }] } }, error: null } as never);
    const svc = new SupabaseContentGenerationService();
    const { data, error } = await svc.poll('row-1');
    expect(error).toBeNull();
    expect(data?.status).toBe('completed');
    expect(data?.output?.images?.[0].storage_path).toBe('u/funnel/generated/row-1/0.png');
  });
});

describe('saveToFunnel() — copy', () => {
  it('inserts a new brand_assets version with the generated copy', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null } as never);
    const insertedRow = {
      id: 'asset-9', avatar_id: 'av-1', touchpoint_id: 'welcome_series', stage: 'retention',
      context_description: 'Generated Email copy', storage_path: null, content_text: 'Subject: Hi', signature_version: null,
      status: 'pending', overall_score: null, previous_score: null, audit_result: null, superseded_by: null,
      created_at: 't', updated_at: 't',
    };
    const supersedeNeq = vi.fn().mockResolvedValue({ error: null });
    const fromMock = {
      insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn().mockResolvedValue({ data: insertedRow, error: null }) })) })),
      update: vi.fn(() => ({ eq: vi.fn(() => ({ eq: vi.fn(() => ({ is: vi.fn(() => ({ neq: supersedeNeq })) })) })) })),
    };
    vi.mocked(supabase.from).mockReturnValue(fromMock as never);

    const svc = new SupabaseContentGenerationService();
    const { data, error } = await svc.saveToFunnel({
      avatarId: 'av-1', touchpointId: 'welcome_series', capability: EMAIL_CAP, output: { copy: 'Subject: Hi' },
    });
    expect(error).toBeNull();
    expect(data?.id).toBe('asset-9');
    expect(fromMock.insert).toHaveBeenCalledWith(expect.objectContaining({ content_text: 'Subject: Hi', touchpoint_id: 'welcome_series', status: 'pending' }));
    expect(supersedeNeq).toHaveBeenCalled();
  });

  it('refuses to save copy when there is none', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'u-1' } }, error: null } as never);
    const svc = new SupabaseContentGenerationService();
    const { data, error } = await svc.saveToFunnel({ avatarId: 'av-1', touchpointId: 'welcome_series', capability: EMAIL_CAP, output: {} });
    expect(data).toBeNull();
    expect(error?.message).toMatch(/No generated copy/);
  });
});
