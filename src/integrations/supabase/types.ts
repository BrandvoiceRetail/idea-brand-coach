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
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      avatars: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          name: string
          persona_data: Json | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          name: string
          persona_data?: Json | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          name?: string
          persona_data?: Json | null
          updated_at?: string
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
          chatbot_type: string
          conversation_type: string
          created_at: string
          field_id: string | null
          field_label: string | null
          id: string
          page_context: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_id?: string | null
          chatbot_type?: string
          conversation_type?: string
          created_at?: string
          field_id?: string | null
          field_label?: string | null
          id?: string
          page_context?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_id?: string | null
          chatbot_type?: string
          conversation_type?: string
          created_at?: string
          field_id?: string | null
          field_label?: string | null
          id?: string
          page_context?: string | null
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
        ]
      }
      diagnostic_submissions: {
        Row: {
          answers: Json
          completed_at: string
          created_at: string
          id: string
          scores: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          answers: Json
          completed_at?: string
          created_at?: string
          id?: string
          scores: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string
          created_at?: string
          id?: string
          scores?: Json
          updated_at?: string
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
      performance_metrics: {
        Row: {
          avatar_id: string
          created_at: string
          id: string
          metadata: Json | null
          metric_type: string
          metric_value: number
          recorded_at: string
        }
        Insert: {
          avatar_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_value: number
          recorded_at?: string
        }
        Update: {
          avatar_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_value?: number
          recorded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_metrics_avatar_id_fkey"
            columns: ["avatar_id"]
            isOneToOne: false
            referencedRelation: "avatars"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          diagnostic_completed_at: string | null
          email: string
          full_name: string | null
          id: string
          latest_diagnostic_data: Json | null
          latest_diagnostic_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          diagnostic_completed_at?: string | null
          email: string
          full_name?: string | null
          id: string
          latest_diagnostic_data?: Json | null
          latest_diagnostic_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          diagnostic_completed_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          latest_diagnostic_data?: Json | null
          latest_diagnostic_score?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      uploaded_documents: {
        Row: {
          created_at: string
          extracted_content: string | null
          file_path: string
          file_size: number
          filename: string
          id: string
          mime_type: string
          openai_file_id: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          extracted_content?: string | null
          file_path: string
          file_size: number
          filename: string
          id?: string
          mime_type: string
          openai_file_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          extracted_content?: string | null
          file_path?: string
          file_size?: number
          filename?: string
          id?: string
          mime_type?: string
          openai_file_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_diagnostic_results: {
        Row: {
          beta_tester_id: string | null
          category_scores: Json | null
          created_at: string
          diagnostic_completion_date: string
          id: string
          overall_score: number
          updated_at: string
          user_id: string
        }
        Insert: {
          beta_tester_id?: string | null
          category_scores?: Json | null
          created_at?: string
          diagnostic_completion_date?: string
          id?: string
          overall_score: number
          updated_at?: string
          user_id: string
        }
        Update: {
          beta_tester_id?: string | null
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
            foreignKeyName: "user_diagnostic_results_beta_tester_id_fkey"
            columns: ["beta_tester_id"]
            isOneToOne: false
            referencedRelation: "beta_testers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_knowledge_base: {
        Row: {
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
          openai_file_id: string | null
          openai_synced_at: string | null
          source_page: string | null
          structured_data: Json | null
          subcategory: string | null
          updated_at: string | null
          user_id: string
          version: number
        }
        Insert: {
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
          openai_file_id?: string | null
          openai_synced_at?: string | null
          source_page?: string | null
          structured_data?: Json | null
          subcategory?: string | null
          updated_at?: string | null
          user_id: string
          version?: number
        }
        Update: {
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
          openai_file_id?: string | null
          openai_synced_at?: string | null
          source_page?: string | null
          structured_data?: Json | null
          subcategory?: string | null
          updated_at?: string | null
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      user_knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json | null
          source_id: string | null
          source_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string | null
          source_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_vector_stores: {
        Row: {
          avatar_store_id: string
          canvas_store_id: string
          capture_store_id: string
          core_store_id: string
          created_at: string
          diagnostic_store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_store_id: string
          canvas_store_id: string
          capture_store_id: string
          core_store_id: string
          created_at?: string
          diagnostic_store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_store_id?: string
          canvas_store_id?: string
          capture_store_id?: string
          core_store_id?: string
          created_at?: string
          diagnostic_store_id?: string
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
      handle_ai_insight_guidance: { Args: never; Returns: undefined }
      handle_buyer_intent_analysis: { Args: never; Returns: undefined }
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
