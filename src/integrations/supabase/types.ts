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
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      handle_ai_insight_guidance: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      handle_buyer_intent_analysis: {
        Args: Record<PropertyKey, never>
        Returns: undefined
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
