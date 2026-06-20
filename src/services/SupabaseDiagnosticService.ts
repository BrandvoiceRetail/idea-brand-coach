/**
 * SupabaseDiagnosticService
 * Implements IDiagnosticService for Supabase backend
 */

import { supabase } from '@/integrations/supabase/client';
import { IDiagnosticService } from './interfaces/IDiagnosticService';
import { DiagnosticCreate, DiagnosticScores, DiagnosticSubmission } from '@/types/diagnostic';
import { getPostHogDistinctId } from '@/lib/posthogClient';

const DIAGNOSTIC_STORAGE_KEY = 'diagnosticData'; // Match key used in FreeDiagnostic component

export class SupabaseDiagnosticService implements IDiagnosticService {
  /**
   * Resolve the authenticated user's brand id (one brand per user — P1 `uq_brands_user_id`).
   * Mirrors SupabaseAvatarService.getBrandId: brand_id is resolved server-side, never
   * accepted from the caller. Returns null (rather than throwing) when no brand exists yet,
   * so a baseline diagnostic from a brand-less account still persists (brand_id NULL).
   */
  private async resolveBrandId(userId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('brands')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.id ?? null;
  }

  async saveDiagnostic(data: DiagnosticCreate): Promise<DiagnosticSubmission> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Resolve the brand server-side; avatar_id is the overlay scope (NULL = baseline, locked #5).
    const brandId = await this.resolveBrandId(user.id);
    const avatarId = data.avatar_id ?? null;

    // 1. Save to diagnostic_submissions table
    const insertData = {
      user_id: user.id,
      brand_id: brandId,
      avatar_id: avatarId,
      answers: data.answers,
      scores: data.scores,
      completed_at: new Date().toISOString(),
      // Join key back to the PostHog funnel + replay (parity with feedback_events).
      posthog_distinct_id: getPostHogDistinctId(),
    };

    const { data: submission, error: submissionError } = await supabase
      .from('diagnostic_submissions')
      .insert(insertData)
      .select()
      .single();

    if (submissionError) throw submissionError;

    // 2. Update profiles table with latest diagnostic data
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        latest_diagnostic_data: data.scores as any,
        latest_diagnostic_score: data.scores.overall,
        diagnostic_completed_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileError) throw profileError;

    // Embedding sync retired: sync-diagnostic-to-embeddings is a 410 tombstone
    // (user-KB chunks come from the pgvector path now). Calling it only produced
    // console errors after every submission.

    return {
      id: submission.id,
      user_id: user.id,
      answers: submission.answers as any,
      scores: submission.scores as unknown as DiagnosticScores,
      brand_id: (submission as { brand_id?: string | null }).brand_id ?? brandId,
      avatar_id: (submission as { avatar_id?: string | null }).avatar_id ?? avatarId,
      completed_at: submission.completed_at,
      created_at: submission.created_at,
      updated_at: submission.updated_at,
    };
  }

  async getLatestDiagnostic(avatarId?: string | null): Promise<DiagnosticSubmission | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let query = supabase
      .from('diagnostic_submissions')
      .select('*')
      .eq('user_id', user.id);

    // Scope (locked #5): `undefined` = any scope; `null` = brand baseline; uuid = overlay.
    if (avatarId === null) {
      query = query.is('avatar_id', null);
    } else if (typeof avatarId === 'string') {
      query = query.eq('avatar_id', avatarId);
    }

    const { data, error } = await query
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      user_id: user.id,
      answers: data.answers as any,
      scores: data.scores as unknown as DiagnosticScores,
      brand_id: (data as { brand_id?: string | null }).brand_id ?? null,
      avatar_id: (data as { avatar_id?: string | null }).avatar_id ?? null,
      completed_at: data.completed_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async getDiagnosticHistory(limit = 10): Promise<DiagnosticSubmission[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('diagnostic_submissions')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false })
      .limit(limit * 2); // Get extra to allow for deduplication

    if (error) throw error;

    // Group by date and keep only the latest/best submission per day
    const deduplicatedData = this.deduplicateByDate(data);

    return deduplicatedData.slice(0, limit).map(item => ({
      id: item.id,
      user_id: user.id,
      answers: item.answers as any,
      scores: item.scores as unknown as DiagnosticScores,
      completed_at: item.completed_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  private deduplicateByDate(submissions: any[]): any[] {
    const grouped = new Map<string, any>();

    submissions.forEach(submission => {
      const date = new Date(submission.completed_at).toDateString();
      const existing = grouped.get(date);

      // Keep the submission with the highest overall score for each date
      const currentScore = submission.scores?.overall || 0;
      const existingScore = existing?.scores?.overall || 0;

      if (!existing || currentScore > existingScore) {
        grouped.set(date, submission);
      }
    });

    // Return as array, sorted by date descending
    return Array.from(grouped.values()).sort((a, b) =>
      new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
    );
  }

  async syncFromLocalStorage(avatarId?: string | null): Promise<DiagnosticSubmission | null> {
    // Get data from localStorage
    const storedData = localStorage.getItem(DIAGNOSTIC_STORAGE_KEY);
    if (!storedData) return null;

    try {
      const parsed = JSON.parse(storedData);
      
      // Validate structure
      if (!parsed.scores || typeof parsed.scores !== 'object') {
        console.error('Invalid diagnostic data in localStorage');
        return null;
      }

      // Calculate scores with backward compatibility for old data format
      const scores = (() => {
        // If answers exist and have the right structure, calculate from them
        if (parsed.answers && typeof parsed.answers === 'object') {
          // Check if answers contain score values directly (new format)
          if ('insight' in parsed.answers || 'distinctive' in parsed.answers) {
            return this.calculateScores(parsed.answers);
          }
        }

        // Handle new format (scores.overall)
        if (parsed.scores && typeof parsed.scores.overall === 'number') {
          return parsed.scores;
        }

        // Handle old format (separate overallScore)
        if (parsed.overallScore !== undefined && parsed.scores) {
          return {
            ...parsed.scores,
            overall: parsed.overallScore
          };
        }

        // Default fallback
        return parsed.scores || { overall: 0, insight: 0, distinctive: 0, empathetic: 0, authentic: 0 };
      })();

      // Save to database. avatar_id scopes the write (locked #5): NULL = brand
      // baseline; a uuid = the overlay for the avatar that was current when the
      // diagnostic was (re)taken. The first-signup sync (Auth.tsx) passes no
      // avatar, so it always establishes the baseline.
      const submission = await this.saveDiagnostic({
        answers: parsed.answers || {},
        scores,
        avatar_id: avatarId ?? null,
      });

      // Clear localStorage after successful sync
      localStorage.removeItem(DIAGNOSTIC_STORAGE_KEY);

      return submission;
    } catch (error) {
      console.error('Failed to sync diagnostic from localStorage:', error);
      return null;
    }
  }

  calculateScores(answers: Record<string, number>): DiagnosticScores {
    // Extract IDEA scores from answers
    const insight = answers.insight || 0;
    const distinctive = answers.distinctive || 0;
    const empathetic = answers.empathetic || 0;
    const authentic = answers.authentic || 0;

    // Calculate overall score as average
    const overall = Math.round((insight + distinctive + empathetic + authentic) / 4);

    return {
      overall,
      insight,
      distinctive,
      empathetic,
      authentic,
    };
  }
}
