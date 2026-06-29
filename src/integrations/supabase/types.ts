export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      artifacts: {
        Row: {
          avatar_id: string | null
          brand_id: string | null
          content: Json
          created_at: string
          evidence_refs: Json
          grounding: string
          id: string
          kind: string
          model: string | null
          schema_version: string | null
          status: string
          superseded_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          brand_id?: string | null
          content: Json
          created_at?: string
          evidence_refs?: Json
          grounding: string
          id?: string
          kind: string
          model?: string | null
          schema_version?: string | null
          status?: string
          superseded_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          brand_id?: string | null
          content?: Json
          created_at?: string
          evidence_refs?: Json
          grounding?: string
          id?: string
          kind?: string
          model?: string | null
          schema_version?: string | null
          status?: string
          superseded_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "artifacts_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artifacts_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_build_state: {
        Row: {
          approved_at: string | null
          avatar_id: string
          stages_done: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          avatar_id: string
          stages_done?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approved_at?: string | null
          avatar_id?: string
          stages_done?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_build_state_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: true
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_field_values: {
        Row: {
          avatar_id: string | null
          chapter_id: string | null
          confidence_score: number | null
          created_at: string | null
          extracted_at: string | null
          field_id: string
          field_source: string | null
          field_value: string | null
          id: string
          is_locked: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_id?: string | null
          chapter_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          extracted_at?: string | null
          field_id: string
          field_source?: string | null
          field_value?: string | null
          id?: string
          is_locked?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_id?: string | null
          chapter_id?: string | null
          confidence_score?: number | null
          created_at?: string | null
          extracted_at?: string | null
          field_id?: string
          field_source?: string | null
          field_value?: string | null
          id?: string
          is_locked?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avatar_field_values_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      avatars: {
        Row: {
          brand_id: string
          buying_behavior: Json | null
          created_at: string
          demographics: Json | null
          description: string | null
          id: string
          is_primary: boolean
          is_template: boolean
          name: string
          psychographics: Json | null
          updated_at: string
          user_id: string
          voice_of_customer: string | null
        }
        Insert: {
          brand_id: string
          buying_behavior?: Json | null
          created_at?: string
          demographics?: Json | null
          description?: string | null
          id?: string
          is_primary?: boolean
          is_template?: boolean
          name: string
          psychographics?: Json | null
          updated_at?: string
          user_id: string
          voice_of_customer?: string | null
        }
        Update: {
          brand_id?: string
          buying_behavior?: Json | null
          created_at?: string
          demographics?: Json | null
          description?: string | null
          id?: string
          is_primary?: boolean
          is_template?: boolean
          name?: string
          psychographics?: Json | null
          updated_at?: string
          user_id?: string
          voice_of_customer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "avatars_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_comments: {
        Row: {
          beta_tester_id: string | null
          comment: string
          commented_at: string
          created_at: string
          id: string
          page_url: string | null
          step_id: string
          user_id: string | null
        }
        Insert: {
          beta_tester_id?: string | null
          comment: string
          commented_at?: string
          created_at?: string
          id?: string
          page_url?: string | null
          step_id: string
          user_id?: string | null
        }
        Update: {
          beta_tester_id?: string | null
          comment?: string
          commented_at?: string
          created_at?: string
          id?: string
          page_url?: string | null
          step_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_comments_beta_tester_id_fkey"
            columns: ["beta_tester_id"]
            isOneToOne: false
            referencedRelation: "beta_testers"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_feedback: {
        Row: {
          areas_tested: string[] | null
          beta_tester_id: string | null
          contact_email: string | null
          created_at: string
          id: string
          improvements: string | null
          issues: string | null
          liked_most: string | null
          overall_rating: number | null
          step_comments: Json | null
          submitted_at: string
          updated_at: string
          user_id: string | null
          would_recommend: string | null
        }
        Insert: {
          areas_tested?: string[] | null
          beta_tester_id?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          improvements?: string | null
          issues?: string | null
          liked_most?: string | null
          overall_rating?: number | null
          step_comments?: Json | null
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
          would_recommend?: string | null
        }
        Update: {
          areas_tested?: string[] | null
          beta_tester_id?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          improvements?: string | null
          issues?: string | null
          liked_most?: string | null
          overall_rating?: number | null
          step_comments?: Json | null
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
          would_recommend?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beta_feedback_beta_tester_id_fkey"
            columns: ["beta_tester_id"]
            isOneToOne: false
            referencedRelation: "beta_testers"
            referencedColumns: ["id"]
          },
        ]
      }
      beta_testers: {
        Row: {
          category_scores: Json | null
          company: string | null
          created_at: string
          diagnostic_completion_date: string
          email: string | null
          id: string
          name: string | null
          notes: string | null
          overall_score: number | null
          updated_at: string
        }
        Insert: {
          category_scores?: Json | null
          company?: string | null
          created_at?: string
          diagnostic_completion_date?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          overall_score?: number | null
          updated_at?: string
        }
        Update: {
          category_scores?: Json | null
          company?: string | null
          created_at?: string
          diagnostic_completion_date?: string
          email?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          overall_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      brand_asset_audits: {
        Row: {
          audit_result: Json | null
          avatar_id: string
          brand_asset_id: string
          brand_id: string
          created_at: string
          evidence_refs: Json
          grounding: string
          id: string
          overall_score: number | null
          superseded_by: string | null
          user_id: string
        }
        Insert: {
          audit_result?: Json | null
          avatar_id: string
          brand_asset_id: string
          brand_id: string
          created_at?: string
          evidence_refs?: Json
          grounding?: string
          id?: string
          overall_score?: number | null
          superseded_by?: string | null
          user_id: string
        }
        Update: {
          audit_result?: Json | null
          avatar_id?: string
          brand_asset_id?: string
          brand_id?: string
          created_at?: string
          evidence_refs?: Json
          grounding?: string
          id?: string
          overall_score?: number | null
          superseded_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_asset_audits_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_asset_audits_brand_asset_id_fkey"
            columns: ["brand_asset_id"]
            isOneToOne: false
            referencedRelation: "brand_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_asset_audits_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_asset_audits_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "brand_asset_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_asset_competitive_insights: {
        Row: {
          analyzed_at: string | null
          asset_id: string | null
          avatar_id: string
          competitors: Json
          created_at: string
          id: string
          modality: string
          status: string
          strategic_angle: string | null
          updated_at: string
          voc_signals: Json | null
        }
        Insert: {
          analyzed_at?: string | null
          asset_id?: string | null
          avatar_id: string
          competitors?: Json
          created_at?: string
          id?: string
          modality: string
          status?: string
          strategic_angle?: string | null
          updated_at?: string
          voc_signals?: Json | null
        }
        Update: {
          analyzed_at?: string | null
          asset_id?: string | null
          avatar_id?: string
          competitors?: Json
          created_at?: string
          id?: string
          modality?: string
          status?: string
          strategic_angle?: string | null
          updated_at?: string
          voc_signals?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_asset_competitive_insights_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "brand_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_asset_competitive_insights_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          audit_result: Json | null
          avatar_id: string | null
          brand_id: string | null
          content_text: string | null
          context_description: string
          created_at: string
          id: string
          overall_score: number | null
          previous_score: number | null
          signature_version: string | null
          stage: string
          status: string
          storage_path: string | null
          superseded_by: string | null
          touchpoint_id: string
          updated_at: string
        }
        Insert: {
          audit_result?: Json | null
          avatar_id?: string | null
          brand_id?: string | null
          content_text?: string | null
          context_description: string
          created_at?: string
          id?: string
          overall_score?: number | null
          previous_score?: number | null
          signature_version?: string | null
          stage: string
          status?: string
          storage_path?: string | null
          superseded_by?: string | null
          touchpoint_id: string
          updated_at?: string
        }
        Update: {
          audit_result?: Json | null
          avatar_id?: string | null
          brand_id?: string | null
          content_text?: string | null
          context_description?: string
          created_at?: string
          id?: string
          overall_score?: number | null
          previous_score?: number | null
          signature_version?: string | null
          stage?: string
          status?: string
          storage_path?: string | null
          superseded_by?: string | null
          touchpoint_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_assets_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "brand_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_defense_alerts: {
        Row: {
          avatar_id: string
          category: string
          created_at: string
          drafted_response: Json | null
          id: string
          interpretation: string | null
          ledger_request_id: string | null
          read_at: string | null
          severity: string
          source_payload: Json
          threatened_dimension: string | null
          title: string
        }
        Insert: {
          avatar_id: string
          category: string
          created_at?: string
          drafted_response?: Json | null
          id?: string
          interpretation?: string | null
          ledger_request_id?: string | null
          read_at?: string | null
          severity?: string
          source_payload?: Json
          threatened_dimension?: string | null
          title: string
        }
        Update: {
          avatar_id?: string
          category?: string
          created_at?: string
          drafted_response?: Json | null
          id?: string
          interpretation?: string | null
          ledger_request_id?: string | null
          read_at?: string | null
          severity?: string
          source_payload?: Json
          threatened_dimension?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_defense_alerts_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_tests: {
        Row: {
          asset_created_at: string | null
          asset_id: string | null
          asset_live_at: string | null
          avatar_id: string | null
          baseline_value: number | null
          channel: string | null
          competitive_insight_id: string | null
          competitor_insight_applied: boolean
          created_at: string
          deployed_at: string | null
          hypothesis: string | null
          id: string
          measured_at: string | null
          messaging_version_after: string | null
          messaging_version_before: string | null
          metric_type: string | null
          name: string | null
          primary_metric: string | null
          result_value: number | null
          source: string
          status: string
          touchpoint_id: string | null
          updated_at: string
          variants: Json
        }
        Insert: {
          asset_created_at?: string | null
          asset_id?: string | null
          asset_live_at?: string | null
          avatar_id?: string | null
          baseline_value?: number | null
          channel?: string | null
          competitive_insight_id?: string | null
          competitor_insight_applied?: boolean
          created_at?: string
          deployed_at?: string | null
          hypothesis?: string | null
          id?: string
          measured_at?: string | null
          messaging_version_after?: string | null
          messaging_version_before?: string | null
          metric_type?: string | null
          name?: string | null
          primary_metric?: string | null
          result_value?: number | null
          source?: string
          status?: string
          touchpoint_id?: string | null
          updated_at?: string
          variants?: Json
        }
        Update: {
          asset_created_at?: string | null
          asset_id?: string | null
          asset_live_at?: string | null
          avatar_id?: string | null
          baseline_value?: number | null
          channel?: string | null
          competitive_insight_id?: string | null
          competitor_insight_applied?: boolean
          created_at?: string
          deployed_at?: string | null
          hypothesis?: string | null
          id?: string
          measured_at?: string | null
          messaging_version_after?: string | null
          messaging_version_before?: string | null
          metric_type?: string | null
          name?: string | null
          primary_metric?: string | null
          result_value?: number | null
          source?: string
          status?: string
          touchpoint_id?: string | null
          updated_at?: string
          variants?: Json
        }
        Relationships: [
          {
            foreignKeyName: "brand_tests_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "brand_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_tests_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_tests_competitive_insight_id_fkey"
            columns: ["competitive_insight_id"]
            isOneToOne: false
            referencedRelation: "brand_asset_competitive_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          industry: string | null
          metadata: Json | null
          name: string
          primary_avatar_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          metadata?: Json | null
          name: string
          primary_avatar_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          industry?: string | null
          metadata?: Json | null
          name?: string
          primary_avatar_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_primary_avatar_id_fkey"
            columns: ["primary_avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      business_facts: {
        Row: {
          content: string | null
          created_at: string
          field_identifier: string
          id: string
          is_current: boolean
          structured_data: Json | null
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          content?: string | null
          created_at?: string
          field_identifier: string
          id?: string
          is_current?: boolean
          structured_data?: Json | null
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          content?: string | null
          created_at?: string
          field_identifier?: string
          id?: string
          is_current?: boolean
          structured_data?: Json | null
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      campaign_metrics: {
        Row: {
          brand_asset_id: string | null
          campaign_id: string
          channel: string
          created_at: string
          funnel_stage: string | null
          granularity: string
          id: string
          journey_stage: string | null
          measured_date: string
          metric_name: string
          metric_value: number
          source: string
          user_id: string
        }
        Insert: {
          brand_asset_id?: string | null
          campaign_id: string
          channel: string
          created_at?: string
          funnel_stage?: string | null
          granularity?: string
          id?: string
          journey_stage?: string | null
          measured_date: string
          metric_name: string
          metric_value: number
          source?: string
          user_id?: string
        }
        Update: {
          brand_asset_id?: string | null
          campaign_id?: string
          channel?: string
          created_at?: string
          funnel_stage?: string | null
          granularity?: string
          id?: string
          journey_stage?: string | null
          measured_date?: string
          metric_name?: string
          metric_value?: number
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_metrics_brand_asset_id_fkey"
            columns: ["brand_asset_id"]
            isOneToOne: false
            referencedRelation: "brand_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brand_id: string
          channel: string
          created_at: string
          description: string | null
          id: string
          name: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          channel: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          brand_id?: string
          channel?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      canva_connections: {
        Row: {
          access_token: string
          canva_team_id: string | null
          canva_user_id: string | null
          connected_at: string
          display_name: string | null
          refresh_token: string
          scopes: string | null
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          canva_team_id?: string | null
          canva_user_id?: string | null
          connected_at?: string
          display_name?: string | null
          refresh_token: string
          scopes?: string | null
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          canva_team_id?: string | null
          canva_user_id?: string | null
          connected_at?: string
          display_name?: string | null
          refresh_token?: string
          scopes?: string | null
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      canva_imported_designs: {
        Row: {
          canva_design_id: string
          edit_url: string | null
          id: string
          imported_at: string
          thumbnail_url: string | null
          title: string | null
          user_id: string
          view_url: string | null
        }
        Insert: {
          canva_design_id: string
          edit_url?: string | null
          id?: string
          imported_at?: string
          thumbnail_url?: string | null
          title?: string | null
          user_id: string
          view_url?: string | null
        }
        Update: {
          canva_design_id?: string
          edit_url?: string | null
          id?: string
          imported_at?: string
          thumbnail_url?: string | null
          title?: string | null
          user_id?: string
          view_url?: string | null
        }
        Relationships: []
      }
      canva_oauth_states: {
        Row: {
          code_verifier: string
          created_at: string
          expires_at: string
          return_url: string
          state: string
          user_id: string
        }
        Insert: {
          code_verifier: string
          created_at?: string
          expires_at: string
          return_url: string
          state: string
          user_id: string
        }
        Update: {
          code_verifier?: string
          created_at?: string
          expires_at?: string
          return_url?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          chatbot_type: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
          session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          chatbot_type: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
          session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          chatbot_type?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
          session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          avatar_id: string | null
          brand_id: string | null
          chapter_id: string | null
          chapter_metadata: Json | null
          chatbot_type: string
          context_avatar_ids: string[] | null
          conversation_type: string
          created_at: string
          field_id: string | null
          field_label: string | null
          id: string
          page_context: string | null
          posthog_distinct_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          brand_id?: string | null
          chapter_id?: string | null
          chapter_metadata?: Json | null
          chatbot_type?: string
          context_avatar_ids?: string[] | null
          conversation_type?: string
          created_at?: string
          field_id?: string | null
          field_label?: string | null
          id?: string
          page_context?: string | null
          posthog_distinct_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          brand_id?: string | null
          chapter_id?: string | null
          chapter_metadata?: Json | null
          chatbot_type?: string
          context_avatar_ids?: string[] | null
          conversation_type?: string
          created_at?: string
          field_id?: string | null
          field_label?: string | null
          id?: string
          page_context?: string | null
          posthog_distinct_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_asset_events: {
        Row: {
          actor: string | null
          asset_id: string
          created_at: string
          event_type: string
          from_status: string | null
          id: string
          notes: string | null
          recommendations: string | null
          scores: Json | null
          summary: string | null
          to_status: string | null
          user_id: string
          verdict: string | null
        }
        Insert: {
          actor?: string | null
          asset_id: string
          created_at?: string
          event_type: string
          from_status?: string | null
          id?: string
          notes?: string | null
          recommendations?: string | null
          scores?: Json | null
          summary?: string | null
          to_status?: string | null
          user_id?: string
          verdict?: string | null
        }
        Update: {
          actor?: string | null
          asset_id?: string
          created_at?: string
          event_type?: string
          from_status?: string | null
          id?: string
          notes?: string | null
          recommendations?: string | null
          scores?: Json | null
          summary?: string | null
          to_status?: string | null
          user_id?: string
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_asset_events_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "coach_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_assets: {
        Row: {
          agent_name: string | null
          approval_status: string
          campaign_id: string | null
          content: string
          content_type: string
          created_at: string
          external_id: string | null
          id: string
          metadata: Json
          model: string | null
          parameters: Json
          performance_metrics: Json
          prompt: string | null
          status: string
          superseded_by: string | null
          tokens_used: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_name?: string | null
          approval_status?: string
          campaign_id?: string | null
          content: string
          content_type?: string
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          parameters?: Json
          performance_metrics?: Json
          prompt?: string | null
          status?: string
          superseded_by?: string | null
          tokens_used?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          agent_name?: string | null
          approval_status?: string
          campaign_id?: string | null
          content?: string
          content_type?: string
          created_at?: string
          external_id?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          parameters?: Json
          performance_metrics?: Json
          prompt?: string | null
          status?: string
          superseded_by?: string | null
          tokens_used?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_assets_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "coach_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      competitor_asin_cache: {
        Row: {
          cache_key: string
          created_at: string
          data_kind: string
          expires_at: string
          fetched_at: string
          id: string
          marketplace: string
          payload: Json
          source: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          data_kind: string
          expires_at: string
          fetched_at?: string
          id?: string
          marketplace?: string
          payload: Json
          source: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          data_kind?: string
          expires_at?: string
          fetched_at?: string
          id?: string
          marketplace?: string
          payload?: Json
          source?: string
        }
        Relationships: []
      }
      competitor_assets: {
        Row: {
          avatar_id: string
          content_text: string | null
          created_at: string
          id: string
          source_url: string | null
          storage_path: string | null
          touchpoint_id: string
        }
        Insert: {
          avatar_id: string
          content_text?: string | null
          created_at?: string
          id?: string
          source_url?: string | null
          storage_path?: string | null
          touchpoint_id: string
        }
        Update: {
          avatar_id?: string
          content_text?: string | null
          created_at?: string
          id?: string
          source_url?: string | null
          storage_path?: string | null
          touchpoint_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "competitor_assets_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      content_generation_jobs: {
        Row: {
          avatar_id: string | null
          brand_asset_id: string | null
          brand_id: string | null
          capability: string
          created_at: string
          error: Json | null
          external_job_id: string | null
          id: string
          output: Json | null
          output_kind: string
          provider: string
          request: Json
          status: string
          touchpoint_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          brand_asset_id?: string | null
          brand_id?: string | null
          capability: string
          created_at?: string
          error?: Json | null
          external_job_id?: string | null
          id?: string
          output?: Json | null
          output_kind: string
          provider: string
          request?: Json
          status?: string
          touchpoint_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          brand_asset_id?: string | null
          brand_id?: string | null
          capability?: string
          created_at?: string
          error?: Json | null
          external_job_id?: string | null
          id?: string
          output?: Json | null
          output_kind?: string
          provider?: string
          request?: Json
          status?: string
          touchpoint_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_generation_jobs_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_generation_jobs_brand_asset_id_fkey"
            columns: ["brand_asset_id"]
            isOneToOne: false
            referencedRelation: "brand_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_generation_jobs_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_ledger: {
        Row: {
          balance_after: number
          created_at: string
          delta: number
          id: number
          input_tokens: number | null
          model: string | null
          op_name: string | null
          output_tokens: number | null
          raw_cost_usd: number | null
          reason: string
          stripe_event_id: string | null
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          delta: number
          id?: never
          input_tokens?: number | null
          model?: string | null
          op_name?: string | null
          output_tokens?: number | null
          raw_cost_usd?: number | null
          reason: string
          stripe_event_id?: string | null
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          delta?: number
          id?: never
          input_tokens?: number | null
          model?: string | null
          op_name?: string | null
          output_tokens?: number | null
          raw_cost_usd?: number | null
          reason?: string
          stripe_event_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_wallets: {
        Row: {
          balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      decision_triggers: {
        Row: {
          avatar_id: string | null
          brand_anchor: string
          brand_id: string | null
          created_at: string
          dominant_confidence: number | null
          dominant_type: string
          evidence_phrases: Json
          generated_at: string
          id: string
          model_version: string | null
          placement_instruction: string
          session_id: string
          supporting_confidence: number | null
          supporting_type: string | null
          updated_at: string
          user_id: string
          why_this_trigger: string | null
        }
        Insert: {
          avatar_id?: string | null
          brand_anchor: string
          brand_id?: string | null
          created_at?: string
          dominant_confidence?: number | null
          dominant_type: string
          evidence_phrases?: Json
          generated_at?: string
          id?: string
          model_version?: string | null
          placement_instruction: string
          session_id: string
          supporting_confidence?: number | null
          supporting_type?: string | null
          updated_at?: string
          user_id: string
          why_this_trigger?: string | null
        }
        Update: {
          avatar_id?: string | null
          brand_anchor?: string
          brand_id?: string | null
          created_at?: string
          dominant_confidence?: number | null
          dominant_type?: string
          evidence_phrases?: Json
          generated_at?: string
          id?: string
          model_version?: string | null
          placement_instruction?: string
          session_id?: string
          supporting_confidence?: number | null
          supporting_type?: string | null
          updated_at?: string
          user_id?: string
          why_this_trigger?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "decision_triggers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_submissions: {
        Row: {
          answers: Json
          avatar_id: string | null
          brand_id: string | null
          completed_at: string
          created_at: string
          id: string
          posthog_distinct_id: string | null
          scores: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          answers: Json
          avatar_id?: string | null
          brand_id?: string | null
          completed_at?: string
          created_at?: string
          id?: string
          posthog_distinct_id?: string | null
          scores: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          avatar_id?: string | null
          brand_id?: string | null
          completed_at?: string
          created_at?: string
          id?: string
          posthog_distinct_id?: string | null
          scores?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_submissions_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_submissions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sequences: {
        Row: {
          brand_id: string
          campaign_id: string | null
          created_at: string
          id: string
          name: string
          sequence_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          name: string
          sequence_type: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          created_at?: string
          id?: string
          name?: string
          sequence_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sequences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sequences_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      email_steps: {
        Row: {
          body: string
          created_at: string
          delay_hours: number
          email_type: string | null
          id: string
          sequence_id: string
          step_number: number
          subject: string
          trigger_event: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          delay_hours?: number
          email_type?: string | null
          id?: string
          sequence_id: string
          step_number: number
          subject: string
          trigger_event?: string | null
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          delay_hours?: number
          email_type?: string | null
          id?: string
          sequence_id?: string
          step_number?: number
          subject?: string
          trigger_event?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "email_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_snapshots: {
        Row: {
          avatar_id: string | null
          brand_id: string | null
          created_at: string
          id: string
          listing: Json | null
          reviews: Json | null
          source: string
          source_ref: string | null
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          listing?: Json | null
          reviews?: Json | null
          source: string
          source_ref?: string | null
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          brand_id?: string | null
          created_at?: string
          id?: string
          listing?: Json | null
          reviews?: Json | null
          source?: string
          source_ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_snapshots_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_events: {
        Row: {
          avatar_id: string | null
          chosen_signature: string | null
          created_at: string
          id: string
          moment: string
          payload: Json
          posthog_distinct_id: string
          q1_score_felt_right: string | null
          q2_signature_felt_right: string | null
          q3_whats_off: string | null
          scores: Json | null
          session_id: string | null
          signature_options: Json | null
          user_id: string | null
        }
        Insert: {
          avatar_id?: string | null
          chosen_signature?: string | null
          created_at?: string
          id?: string
          moment?: string
          payload?: Json
          posthog_distinct_id: string
          q1_score_felt_right?: string | null
          q2_signature_felt_right?: string | null
          q3_whats_off?: string | null
          scores?: Json | null
          session_id?: string | null
          signature_options?: Json | null
          user_id?: string | null
        }
        Update: {
          avatar_id?: string | null
          chosen_signature?: string | null
          created_at?: string
          id?: string
          moment?: string
          payload?: Json
          posthog_distinct_id?: string
          q1_score_felt_right?: string | null
          q2_signature_felt_right?: string | null
          q3_whats_off?: string | null
          scores?: Json | null
          session_id?: string | null
          signature_options?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      figma_connections: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          figma_email: string | null
          figma_handle: string | null
          figma_user_id: string | null
          id: string
          refresh_token: string | null
          scope: string | null
          token_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          figma_email?: string | null
          figma_handle?: string | null
          figma_user_id?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          figma_email?: string | null
          figma_handle?: string | null
          figma_user_id?: string | null
          id?: string
          refresh_token?: string | null
          scope?: string | null
          token_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      figma_imports: {
        Row: {
          brand_id: string | null
          components: Json
          created_at: string
          file_key: string
          file_name: string | null
          id: string
          last_modified: string | null
          pages: Json
          palette: Json
          summary: string | null
          thumbnail_url: string | null
          typography: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          brand_id?: string | null
          components?: Json
          created_at?: string
          file_key: string
          file_name?: string | null
          id?: string
          last_modified?: string | null
          pages?: Json
          palette?: Json
          summary?: string | null
          thumbnail_url?: string | null
          typography?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          brand_id?: string | null
          components?: Json
          created_at?: string
          file_key?: string
          file_name?: string | null
          id?: string
          last_modified?: string | null
          pages?: Json
          palette?: Json
          summary?: string | null
          thumbnail_url?: string | null
          typography?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "figma_imports_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      figma_oauth_state: {
        Row: {
          created_at: string
          expires_at: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          redirect_uri: string
          state: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          redirect_uri?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      idea_framework_submissions: {
        Row: {
          buyer_intent: string | null
          created_at: string
          demographics: string | null
          id: string
          motivation: string | null
          shopper_type: string | null
          triggers: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          buyer_intent?: string | null
          created_at?: string
          demographics?: string | null
          id?: string
          motivation?: string | null
          shopper_type?: string | null
          triggers?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          buyer_intent?: string | null
          created_at?: string
          demographics?: string | null
          id?: string
          motivation?: string | null
          shopper_type?: string | null
          triggers?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leads: {
        Row: {
          answers: Json | null
          company: string | null
          consent: boolean
          created_at: string
          email: string
          emailed_at: string | null
          id: string
          name: string | null
          overall_score: number | null
          posthog_distinct_id: string | null
          primary_gap: string | null
          scores: Json | null
          source: string
          user_agent: string | null
          utm: Json | null
        }
        Insert: {
          answers?: Json | null
          company?: string | null
          consent?: boolean
          created_at?: string
          email: string
          emailed_at?: string | null
          id?: string
          name?: string | null
          overall_score?: number | null
          posthog_distinct_id?: string | null
          primary_gap?: string | null
          scores?: Json | null
          source?: string
          user_agent?: string | null
          utm?: Json | null
        }
        Update: {
          answers?: Json | null
          company?: string | null
          consent?: boolean
          created_at?: string
          email?: string
          emailed_at?: string | null
          id?: string
          name?: string | null
          overall_score?: number | null
          posthog_distinct_id?: string | null
          primary_gap?: string | null
          scores?: Json | null
          source?: string
          user_agent?: string | null
          utm?: Json | null
        }
        Relationships: []
      }
      marketing_audits: {
        Row: {
          constraints: Json | null
          created_at: string
          id: string
          investments: Json | null
          rollout: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          constraints?: Json | null
          created_at?: string
          id?: string
          investments?: Json | null
          rollout?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          constraints?: Json | null
          created_at?: string
          id?: string
          investments?: Json | null
          rollout?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      model_rates: {
        Row: {
          input_per_mtok_usd: number
          model: string
          output_per_mtok_usd: number
          updated_at: string
        }
        Insert: {
          input_per_mtok_usd: number
          model: string
          output_per_mtok_usd: number
          updated_at?: string
        }
        Update: {
          input_per_mtok_usd?: number
          model?: string
          output_per_mtok_usd?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          context_avatar_ids: string[] | null
          created_at: string
          current_avatar_id: string | null
          diagnostic_completed_at: string | null
          email: string
          full_name: string | null
          id: string
          latest_diagnostic_data: Json | null
          latest_diagnostic_score: number | null
          updated_at: string
          version_preference: string | null
        }
        Insert: {
          context_avatar_ids?: string[] | null
          created_at?: string
          current_avatar_id?: string | null
          diagnostic_completed_at?: string | null
          email: string
          full_name?: string | null
          id: string
          latest_diagnostic_data?: Json | null
          latest_diagnostic_score?: number | null
          updated_at?: string
          version_preference?: string | null
        }
        Update: {
          context_avatar_ids?: string[] | null
          created_at?: string
          current_avatar_id?: string | null
          diagnostic_completed_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          latest_diagnostic_data?: Json | null
          latest_diagnostic_score?: number | null
          updated_at?: string
          version_preference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_avatar_id_fkey"
            columns: ["current_avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_job_items: {
        Row: {
          asin: string | null
          attempts: number
          created_at: string
          error: string | null
          id: string
          job_id: string
          reviews_count: number
          status: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          asin?: string | null
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          job_id: string
          reviews_count?: number
          status?: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          asin?: string | null
          attempts?: number
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string
          reviews_count?: number
          status?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "scrape_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      scrape_jobs: {
        Row: {
          avatar_id: string | null
          created_at: string
          done: number
          failed: number
          id: string
          marketplace: string | null
          product_id: string | null
          status: string
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          created_at?: string
          done?: number
          failed?: number
          id?: string
          marketplace?: string | null
          product_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          created_at?: string
          done?: number
          failed?: number
          id?: string
          marketplace?: string | null
          product_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scrape_rate_usage: {
        Row: {
          bucket: string
          count: number
          expires_at: string
        }
        Insert: {
          bucket: string
          count?: number
          expires_at: string
        }
        Update: {
          bucket?: string
          count?: number
          expires_at?: string
        }
        Relationships: []
      }
      signatures: {
        Row: {
          all_options: Json | null
          artifact_id: string | null
          avatar_id: string | null
          brand_id: string | null
          chosen_index: number | null
          created_at: string
          id: string
          inference: boolean | null
          posthog_distinct_id: string | null
          signature_text: string | null
          used_reviews: boolean | null
          user_id: string
        }
        Insert: {
          all_options?: Json | null
          artifact_id?: string | null
          avatar_id?: string | null
          brand_id?: string | null
          chosen_index?: number | null
          created_at?: string
          id?: string
          inference?: boolean | null
          posthog_distinct_id?: string | null
          signature_text?: string | null
          used_reviews?: boolean | null
          user_id: string
        }
        Update: {
          all_options?: Json | null
          artifact_id?: string | null
          avatar_id?: string | null
          brand_id?: string | null
          chosen_index?: number | null
          created_at?: string
          id?: string
          inference?: boolean | null
          posthog_distinct_id?: string | null
          signature_text?: string | null
          used_reviews?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "signatures_artifact_id_fkey"
            columns: ["artifact_id"]
            isOneToOne: false
            referencedRelation: "artifacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signatures_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      trust_gap_snapshots: {
        Row: {
          avatar_drift: Json
          avatar_id: string
          captured_at: string
          competitive_pressure: Json
          composite_score: number
          created_at: string
          decision_trigger_health: Json
          id: string
        }
        Insert: {
          avatar_drift?: Json
          avatar_id: string
          captured_at?: string
          competitive_pressure?: Json
          composite_score?: number
          created_at?: string
          decision_trigger_health?: Json
          id?: string
        }
        Update: {
          avatar_drift?: Json
          avatar_id?: string
          captured_at?: string
          competitive_pressure?: Json
          composite_score?: number
          created_at?: string
          decision_trigger_health?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trust_gap_snapshots_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      uploaded_documents: {
        Row: {
          avatar_id: string | null
          brand_id: string | null
          created_at: string
          extracted_content: string | null
          extraction_completed_at: string | null
          extraction_error: string | null
          extraction_started_at: string | null
          extraction_status: string | null
          fields_extracted: number | null
          file_path: string
          file_size: number
          filename: string
          id: string
          mime_type: string
          pgvector_indexed: boolean | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_id?: string | null
          brand_id?: string | null
          created_at?: string
          extracted_content?: string | null
          extraction_completed_at?: string | null
          extraction_error?: string | null
          extraction_started_at?: string | null
          extraction_status?: string | null
          fields_extracted?: number | null
          file_path: string
          file_size: number
          filename: string
          id?: string
          mime_type: string
          pgvector_indexed?: boolean | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_id?: string | null
          brand_id?: string | null
          created_at?: string
          extracted_content?: string | null
          extraction_completed_at?: string | null
          extraction_error?: string | null
          extraction_started_at?: string | null
          extraction_status?: string | null
          fields_extracted?: number | null
          file_path?: string
          file_size?: number
          filename?: string
          id?: string
          mime_type?: string
          pgvector_indexed?: boolean | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uploaded_documents_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "uploaded_documents_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_diagnostic_results: {
        Row: {
          avatar_id: string | null
          beta_tester_id: string | null
          brand_id: string | null
          category_scores: Json | null
          created_at: string
          diagnostic_completion_date: string
          id: string
          overall_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          beta_tester_id?: string | null
          brand_id?: string | null
          category_scores?: Json | null
          created_at?: string
          diagnostic_completion_date?: string
          id?: string
          overall_score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          beta_tester_id?: string | null
          brand_id?: string | null
          category_scores?: Json | null
          created_at?: string
          diagnostic_completion_date?: string
          id?: string
          overall_score?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_diagnostic_results_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_diagnostic_results_beta_tester_id_fkey"
            columns: ["beta_tester_id"]
            isOneToOne: false
            referencedRelation: "beta_testers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_diagnostic_results_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_knowledge_base: {
        Row: {
          avatar_id: string | null
          brand_id: string | null
          category: string
          content: string
          created_at: string | null
          embedding: string | null
          field_identifier: string
          id: string
          is_current: boolean | null
          last_synced_at: string | null
          local_changes: boolean | null
          metadata: Json | null
          pgvector_synced_at: string | null
          scope: string
          source_page: string | null
          structured_data: Json | null
          subcategory: string | null
          updated_at: string | null
          user_id: string
          version: number
        }
        Insert: {
          avatar_id?: string | null
          brand_id?: string | null
          category: string
          content: string
          created_at?: string | null
          embedding?: string | null
          field_identifier: string
          id?: string
          is_current?: boolean | null
          last_synced_at?: string | null
          local_changes?: boolean | null
          metadata?: Json | null
          pgvector_synced_at?: string | null
          scope?: string
          source_page?: string | null
          structured_data?: Json | null
          subcategory?: string | null
          updated_at?: string | null
          user_id: string
          version?: number
        }
        Update: {
          avatar_id?: string | null
          brand_id?: string | null
          category?: string
          content?: string
          created_at?: string | null
          embedding?: string | null
          field_identifier?: string
          id?: string
          is_current?: boolean | null
          last_synced_at?: string | null
          local_changes?: boolean | null
          metadata?: Json | null
          pgvector_synced_at?: string | null
          scope?: string
          source_page?: string | null
          structured_data?: Json | null
          subcategory?: string | null
          updated_at?: string | null
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_knowledge_base_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_knowledge_base_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      user_knowledge_chunks: {
        Row: {
          avatar_id: string | null
          brand_id: string | null
          category: string | null
          chunk_index: number | null
          content: string
          created_at: string
          embedding: string | null
          field_identifier: string | null
          id: string
          metadata: Json | null
          scope: string
          source_document_id: string | null
          source_id: string | null
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          brand_id?: string | null
          category?: string | null
          chunk_index?: number | null
          content: string
          created_at?: string
          embedding?: string | null
          field_identifier?: string | null
          id?: string
          metadata?: Json | null
          scope?: string
          source_document_id?: string | null
          source_id?: string | null
          source_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          brand_id?: string | null
          category?: string | null
          chunk_index?: number | null
          content?: string
          created_at?: string
          embedding?: string | null
          field_identifier?: string | null
          id?: string
          metadata?: Json | null
          scope?: string
          source_document_id?: string | null
          source_id?: string | null
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_knowledge_chunks_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_knowledge_chunks_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_knowledge_chunks_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      user_memories: {
        Row: {
          content: string
          created_at: string
          id: string
          path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_product_reviews: {
        Row: {
          body: string
          created_at: string
          id: string
          product_id: string
          rating: number | null
          review_date: string | null
          reviewer_name: string | null
          source_url: string | null
          title: string | null
          verified_purchase: boolean
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          product_id: string
          rating?: number | null
          review_date?: string | null
          reviewer_name?: string | null
          source_url?: string | null
          title?: string | null
          verified_purchase?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          product_id?: string
          rating?: number | null
          review_date?: string | null
          reviewer_name?: string | null
          source_url?: string | null
          title?: string | null
          verified_purchase?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "user_product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "user_products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_products: {
        Row: {
          asin: string
          bullets: Json
          created_at: string
          description: string | null
          id: string
          images: Json
          price: number | null
          rating: number | null
          review_count: number
          scraped_at: string
          source_url: string | null
          status: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asin: string
          bullets?: Json
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          price?: number | null
          rating?: number | null
          review_count?: number
          scraped_at?: string
          source_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asin?: string
          bullets?: Json
          created_at?: string
          description?: string | null
          id?: string
          images?: Json
          price?: number | null
          rating?: number | null
          review_count?: number
          scraped_at?: string
          source_url?: string | null
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          interval: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          interval?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          interval?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_knowledge_current: {
        Row: {
          category: string | null
          content: string | null
          created_at: string | null
          embedding: string | null
          field_identifier: string | null
          id: string | null
          is_current: boolean | null
          last_synced_at: string | null
          local_changes: boolean | null
          metadata: Json | null
          source_page: string | null
          structured_data: Json | null
          subcategory: string | null
          updated_at: string | null
          user_id: string | null
          version: number | null
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          field_identifier?: string | null
          id?: string | null
          is_current?: boolean | null
          last_synced_at?: string | null
          local_changes?: boolean | null
          metadata?: Json | null
          source_page?: string | null
          structured_data?: Json | null
          subcategory?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string | null
          embedding?: string | null
          field_identifier?: string | null
          id?: string | null
          is_current?: boolean | null
          last_synced_at?: string | null
          local_changes?: boolean | null
          metadata?: Json | null
          source_page?: string | null
          structured_data?: Json | null
          subcategory?: string | null
          updated_at?: string | null
          user_id?: string | null
          version?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_scrape_items: {
        Args: { p_limit: number }
        Returns: {
          asin: string | null
          attempts: number
          created_at: string
          error: string | null
          id: string
          job_id: string
          reviews_count: number
          status: string
          updated_at: string
          url: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "scrape_job_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      consume_scrape_quota: {
        Args: {
          p_global_daily_max: number
          p_global_window_max: number
          p_user: string
          p_user_daily_max: number
        }
        Returns: Json
      }
      debit_credits: {
        Args: {
          p_in_tok: number
          p_model: string
          p_op: string
          p_out_tok: number
          p_user: string
        }
        Returns: Json
      }
      grant_credits: {
        Args: {
          p_credits: number
          p_reason?: string
          p_set_to_allotment?: boolean
          p_stripe_event_id?: string
          p_user: string
        }
        Returns: number
      }
      handle_ai_insight_guidance: { Args: never; Returns: undefined }
      handle_buyer_intent_analysis: { Args: never; Returns: undefined }
      kick_scrape_drain: { Args: never; Returns: undefined }
      match_document_chunks:
        | {
            Args: {
              filter_categories?: string[]
              match_count?: number
              match_threshold?: number
              match_user_id: string
              query_embedding: string
            }
            Returns: {
              category: string
              chunk_index: number
              content: string
              field_identifier: string
              id: string
              metadata: Json
              similarity: number
              source_type: string
            }[]
          }
        | {
            Args: {
              filter_categories: string[]
              match_avatar_id: string
              match_brand_id: string
              match_count: number
              match_threshold: number
              match_user_id: string
              query_embedding: string
            }
            Returns: {
              category: string
              chunk_index: number
              content: string
              field_identifier: string
              id: string
              metadata: Json
              similarity: number
              source_type: string
            }[]
          }
        | {
            Args: {
              filter_categories: string[]
              match_avatar_ids: string[]
              match_brand_id: string
              match_count: number
              match_threshold: number
              match_user_id: string
              query_embedding: string
            }
            Returns: {
              category: string
              chunk_index: number
              content: string
              field_identifier: string
              id: string
              metadata: Json
              similarity: number
              source_type: string
            }[]
          }
      match_user_documents: {
        Args: {
          filter?: Json
          match_count?: number
          match_user_id: string
          query_embedding: string
        }
        Returns: {
          content: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      match_user_knowledge: {
        Args: {
          match_count?: number
          match_threshold?: number
          p_categories?: string[]
          p_user_id?: string
          query_embedding: string
        }
        Returns: {
          category: string
          content: string
          field_identifier: string
          id: string
          metadata: Json
          similarity: number
        }[]
      }
      refresh_scrape_job: { Args: { p_job: string }; Returns: undefined }
      save_artifact_atomic:
        | {
            Args: {
              p_avatar_id: string
              p_content: Json
              p_evidence_refs: Json
              p_grounding: string
              p_kind: string
              p_user_id: string
            }
            Returns: {
              avatar_id: string | null
              brand_id: string | null
              content: Json
              created_at: string
              evidence_refs: Json
              grounding: string
              id: string
              kind: string
              model: string | null
              schema_version: string | null
              status: string
              superseded_by: string | null
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "artifacts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              p_avatar_id: string
              p_brand_id: string
              p_content: Json
              p_evidence_refs: Json
              p_grounding: string
              p_kind: string
              p_user_id: string
            }
            Returns: {
              avatar_id: string | null
              brand_id: string | null
              content: Json
              created_at: string
              evidence_refs: Json
              grounding: string
              id: string
              kind: string
              model: string | null
              schema_version: string | null
              status: string
              superseded_by: string | null
              updated_at: string
              user_id: string
            }
            SetofOptions: {
              from: "*"
              to: "artifacts"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      save_asset_audit_atomic: {
        Args: {
          p_audit_result: Json
          p_avatar_id: string
          p_brand_asset_id: string
          p_evidence_refs: Json
          p_grounding: string
          p_overall_score: number
        }
        Returns: {
          audit_result: Json | null
          avatar_id: string
          brand_asset_id: string
          brand_id: string
          created_at: string
          evidence_refs: Json
          grounding: string
          id: string
          overall_score: number | null
          superseded_by: string | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "brand_asset_audits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_context_avatars: {
        Args: { p_avatar_ids: string[] }
        Returns: undefined
      }
      set_current_avatar: { Args: { p_avatar_id: string }; Returns: undefined }
      set_primary_avatar: { Args: { p_avatar_id: string }; Returns: undefined }
      update_knowledge_entry: {
        Args: {
          p_category: string
          p_field_identifier: string
          p_new_content: string
          p_new_metadata?: Json
          p_new_structured_data?: Json
          p_user_id: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
