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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      professional_application_reviews: {
        Row: {
          applicant_id: string
          application_version: number
          created_at: string
          credential: string
          decision: string
          id: string
          reason: string
          reviewer_id: string
          specialty: string
        }
        Insert: {
          applicant_id: string
          application_version: number
          created_at?: string
          credential: string
          decision: string
          id?: string
          reason: string
          reviewer_id: string
          specialty: string
        }
        Update: {
          applicant_id?: string
          application_version?: number
          created_at?: string
          credential?: string
          decision?: string
          id?: string
          reason?: string
          reviewer_id?: string
          specialty?: string
        }
        Relationships: [
          {
            foreignKeyName: "professional_application_reviews_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "professional_applications"
            referencedColumns: ["applicant_id"]
          },
          {
            foreignKeyName: "professional_application_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_applications: {
        Row: {
          applicant_id: string
          applicant_name: string
          credential: string
          requested_at: string
          review_reason: string | null
          reviewed_at: string | null
          specialty: string
          status: string
          version: number
        }
        Insert: {
          applicant_id: string
          applicant_name: string
          credential: string
          requested_at?: string
          review_reason?: string | null
          reviewed_at?: string | null
          specialty: string
          status?: string
          version?: number
        }
        Update: {
          applicant_id?: string
          applicant_name?: string
          credential?: string
          requested_at?: string
          review_reason?: string | null
          reviewed_at?: string | null
          specialty?: string
          status?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_applications_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          display_name: string
          id: string
          role: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          display_name?: string
          id: string
          role?: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          display_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      student_professional_links: {
        Row: {
          accepted_at: string | null
          professional_id: string
          requested_at: string
          revoked_at: string | null
          state: string
          student_id: string
          version: number
        }
        Insert: {
          accepted_at?: string | null
          professional_id: string
          requested_at?: string
          revoked_at?: string | null
          state: string
          student_id: string
          version?: number
        }
        Update: {
          accepted_at?: string | null
          professional_id?: string
          requested_at?: string
          revoked_at?: string | null
          state?: string
          student_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_professional_links_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_professional_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plan_notifications: {
        Row: {
          created_at: string
          plan_id: string
          read_at: string | null
          recipient_id: string
        }
        Insert: {
          created_at?: string
          plan_id: string
          read_at?: string | null
          recipient_id: string
        }
        Update: {
          created_at?: string
          plan_id?: string
          read_at?: string | null
          recipient_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plan_notifications_plan_id_recipient_id_fkey"
            columns: ["plan_id", "recipient_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id", "student_id"]
          },
          {
            foreignKeyName: "training_plan_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          content: string
          created_at: string
          id: string
          link_version: number
          professional_id: string
          request_id: string
          student_id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          link_version: number
          professional_id: string
          request_id: string
          student_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          link_version?: number
          professional_id?: string
          request_id?: string
          student_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plans_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_student_link: {
        Args: { p_expected_version: number; p_student_id: string }
        Returns: {
          accepted_at: string | null
          professional_id: string
          requested_at: string
          revoked_at: string | null
          state: string
          student_id: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "student_professional_links"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_training_plan: {
        Args: {
          p_content: string
          p_expected_link_version: number
          p_request_id: string
          p_student_id: string
          p_title: string
        }
        Returns: {
          content: string
          created_at: string
          id: string
          link_version: number
          professional_id: string
          request_id: string
          student_id: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "training_plans"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      list_approved_professionals: {
        Args: { p_page: number }
        Returns: {
          display_name: string
          professional_id: string
        }[]
      }
      list_participant_links: {
        Args: { p_page: number }
        Returns: {
          accepted_at: string
          participant_name: string
          professional_id: string
          requested_at: string
          revoked_at: string
          state: string
          student_id: string
          version: number
        }[]
      }
      read_training_notification: {
        Args: { p_plan_id: string }
        Returns: {
          created_at: string
          plan_id: string
          read_at: string | null
          recipient_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "training_plan_notifications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      request_student_link: {
        Args: { p_professional_id: string }
        Returns: {
          accepted_at: string | null
          professional_id: string
          requested_at: string
          revoked_at: string | null
          state: string
          student_id: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "student_professional_links"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      review_professional_application: {
        Args: {
          p_applicant_id: string
          p_decision: string
          p_expected_version: number
          p_reason: string
        }
        Returns: {
          applicant_id: string
          applicant_name: string
          credential: string
          requested_at: string
          review_reason: string | null
          reviewed_at: string | null
          specialty: string
          status: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "professional_applications"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      revoke_student_link: {
        Args: { p_expected_version: number; p_student_id: string }
        Returns: {
          accepted_at: string | null
          professional_id: string
          requested_at: string
          revoked_at: string | null
          state: string
          student_id: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "student_professional_links"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      submit_professional_application: {
        Args: { p_credential: string; p_specialty: string }
        Returns: {
          applicant_id: string
          applicant_name: string
          credential: string
          requested_at: string
          review_reason: string | null
          reviewed_at: string | null
          specialty: string
          status: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "professional_applications"
          isOneToOne: false
          isSetofReturn: true
        }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
