/**
 * SupabaseDiagnosticService
 * Implements IDiagnosticService for Supabase backend
 */

import { supabase } from '@/integrations/supabase/client';
import { IDiagnosticService } from './interfaces/IDiagnosticService';
import { DiagnosticCreate, DiagnosticScores, DiagnosticSubmission } from '@/types/diagnostic';

const DIAGNOSTIC_STORAGE_KEY = 'diagnosticData'; // Match key used in FreeDiagnostic component

export class SupabaseDiagnosticService implements IDiagnosticService {
  async saveDiagnostic(data: DiagnosticCreate): Promise<DiagnosticSubmission> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // 1. Save to diagnostic_submissions table
    const insertData: any = {
      user_id: user.id,
      answers: data.answers,
      scores: data.scores,
      completed_at: new Date().toISOString(),
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

    // 3. Trigger embedding generation via edge function
    console.log('🔄 Triggering diagnostic embedding sync for submission:', submission.id);
    try {
      const { data: syncResult, error: syncError } = await supabase.functions.invoke('sync-diagnostic-to-embeddings', {
        body: { submission_id: submission.id },
      });
      
      if (syncError) {
        console.error('❌ Failed to sync diagnostic to embeddings:', syncError);
      } else {
        console.log('✅ Diagnostic embedding sync result:', syncResult);
      }
    } catch (error) {
      console.error('❌ Exception during diagnostic embedding sync:', error);
      // Don't throw - embeddings can be generated async or retried later
    }

    // TODO: Phase 2 - Implement server-side trigger for User KB sync
    // Current issue: Edge function auth not working from client-side invocation

    return {
      id: submission.id,
      user_id: user.id,
      answers: submission.answers as any,
      scores: submission.scores as unknown as DiagnosticScores,
      completed_at: submission.completed_at,
      created_at: submission.created_at,
      updated_at: submission.updated_at,
    };
  }

  async getLatestDiagnostic(): Promise<DiagnosticSubmission | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('diagnostic_submissions')
      .select('*')
      .eq('user_id', user.id)
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
      completed_at: data.completed_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  }

  async getDiagnosticHistory(): Promise<DiagnosticSubmission[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('diagnostic_submissions')
      .select('*')
      .eq('user_id', user.id)
      .order('completed_at', { ascending: false });

    if (error) throw error;

    return data.map(item => ({
      id: item.id,
      user_id: user.id,
      answers: item.answers as any,
      scores: item.scores as unknown as DiagnosticScores,
      completed_at: item.completed_at,
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  async syncFromLocalStorage(): Promise<DiagnosticSubmission | null> {
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

      // Calculate scores if answers exist
      const scores = parsed.answers 
        ? this.calculateScores(parsed.answers)
        : parsed.scores;

      // Save to database
      const submission = await this.saveDiagnostic({
        answers: parsed.answers || {},
        scores,
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
