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
      esg_project_reviews: {
        Row: {
          created_at: string
          decision: string
          project_id: string
          reason: string
          reviewed_version: number
          reviewer_id: string
        }
        Insert: {
          created_at?: string
          decision: string
          project_id: string
          reason: string
          reviewed_version: number
          reviewer_id: string
        }
        Update: {
          created_at?: string
          decision?: string
          project_id?: string
          reason?: string
          reviewed_version?: number
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "esg_project_reviews_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "esg_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "esg_project_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      esg_projects: {
        Row: {
          category: string
          description: string
          id: string
          owner_id: string
          request_id: string
          review_reason: string | null
          reviewed_at: string | null
          status: string
          submitted_at: string
          title: string
          version: number
        }
        Insert: {
          category: string
          description: string
          id?: string
          owner_id: string
          request_id: string
          review_reason?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string
          title: string
          version?: number
        }
        Update: {
          category?: string
          description?: string
          id?: string
          owner_id?: string
          request_id?: string
          review_reason?: string | null
          reviewed_at?: string | null
          status?: string
          submitted_at?: string
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "esg_projects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
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
      professional_availability_days: {
        Row: {
          available_hours: number[]
          day: string
          professional_id: string
          released: boolean
          updated_at: string
          version: number
        }
        Insert: {
          available_hours?: number[]
          day: string
          professional_id: string
          released?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          available_hours?: number[]
          day?: string
          professional_id?: string
          released?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_availability_days_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_booking_terms: {
        Row: {
          created_at: string
          deposit_basis_points: number
          deposit_cents: number | null
          free_cancel_hours: number
          id: string
          no_show_deposit_retained: boolean
          price_cents: number
          professional_id: string
          request_id: string
          version: number
        }
        Insert: {
          created_at?: string
          deposit_basis_points: number
          deposit_cents?: number | null
          free_cancel_hours: number
          id?: string
          no_show_deposit_retained?: boolean
          price_cents: number
          professional_id: string
          request_id: string
          version: number
        }
        Update: {
          created_at?: string
          deposit_basis_points?: number
          deposit_cents?: number | null
          free_cancel_hours?: number
          id?: string
          no_show_deposit_retained?: boolean
          price_cents?: number
          professional_id?: string
          request_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "professional_booking_terms_professional_id_fkey"
            columns: ["professional_id"]
            isOneToOne: false
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
      ranking_policy_drafts: {
        Row: {
          created_at: string
          created_by: string
          id: string
          notes: string
          partner_services: string
          pool_basis: string
          rating: string
          referrals: string
          request_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          notes?: string
          partner_services: string
          pool_basis: string
          rating: string
          referrals: string
          request_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          notes?: string
          partner_services?: string
          pool_basis?: string
          rating?: string
          referrals?: string
          request_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ranking_policy_drafts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      training_completions: {
        Row: {
          completed_at: string
          plan_id: string
          student_id: string
        }
        Insert: {
          completed_at?: string
          plan_id: string
          student_id: string
        }
        Update: {
          completed_at?: string
          plan_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_completions_plan_id_student_id_fkey"
            columns: ["plan_id", "student_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id", "student_id"]
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
      wallet_accounts: {
        Row: {
          available_cents: number
          reserved_cents: number
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          available_cents?: number
          reserved_cents?: number
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          available_cents?: number
          reserved_cents?: number
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "wallet_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_reservation_events: {
        Row: {
          account_version: number
          amount_cents: number
          available_after: number
          available_before: number
          created_at: string
          id: string
          kind: string
          reserved_after: number
          reserved_before: number
          user_id: string
          withdrawal_id: string
        }
        Insert: {
          account_version: number
          amount_cents: number
          available_after: number
          available_before: number
          created_at?: string
          id?: string
          kind: string
          reserved_after: number
          reserved_before: number
          user_id: string
          withdrawal_id: string
        }
        Update: {
          account_version?: number
          amount_cents?: number
          available_after?: number
          available_before?: number
          created_at?: string
          id?: string
          kind?: string
          reserved_after?: number
          reserved_before?: number
          user_id?: string
          withdrawal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_reservation_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "wallet_reservation_events_withdrawal_id_user_id_fkey"
            columns: ["withdrawal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "wallet_withdrawals"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      wallet_withdrawals: {
        Row: {
          amount_cents: number
          cancelled_at: string | null
          created_at: string
          id: string
          request_id: string
          status: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          request_id: string
          status?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          cancelled_at?: string | null
          created_at?: string
          id?: string
          request_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "wallet_accounts"
            referencedColumns: ["user_id"]
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
      admin_participant_overview: {
        Args: { p_page: number; p_query: string }
        Returns: {
          available_cents: number
          checked_at: string
          display_name: string
          esg_approved: number
          esg_pending: number
          esg_rejected: number
          joined_at: string
          participant_id: string
          participant_role: string
          professional_approved: boolean
          reserved_cents: number
          wallet_initialized: boolean
          wallet_updated_at: string
          wallet_version: number
        }[]
      }
      cancel_wallet_withdrawal: {
        Args: { p_withdrawal_id: string }
        Returns: {
          amount_cents: number
          cancelled_at: string | null
          created_at: string
          id: string
          request_id: string
          status: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "wallet_withdrawals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_training_plan: {
        Args: { p_plan_id: string }
        Returns: {
          completed_at: string
          plan_id: string
          student_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "training_completions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      create_ranking_policy_draft: {
        Args: {
          p_notes: string
          p_partner_services: string
          p_pool_basis: string
          p_rating: string
          p_referrals: string
          p_request_id: string
          p_title: string
        }
        Returns: {
          created_at: string
          created_by: string
          id: string
          notes: string
          partner_services: string
          pool_basis: string
          rating: string
          referrals: string
          request_id: string
          title: string
        }[]
        SetofOptions: {
          from: "*"
          to: "ranking_policy_drafts"
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
      ensure_wallet_account: {
        Args: never
        Returns: {
          available_cents: number
          reserved_cents: number
          updated_at: string
          user_id: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "wallet_accounts"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_professional_booking_terms: {
        Args: { p_professional_id: string }
        Returns: {
          created_at: string
          deposit_basis_points: number
          deposit_cents: number
          free_cancel_hours: number
          id: string
          no_show_deposit_retained: boolean
          price_cents: number
          professional_id: string
          version: number
        }[]
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
      list_released_availability: {
        Args: { p_month: string; p_professional_id: string }
        Returns: {
          available_hours: number[]
          day: string
          professional_id: string
        }[]
      }
      quote_booking_slot: {
        Args: { p_day: string; p_hour: number; p_professional_id: string }
        Returns: {
          availability_version: number
          balance_cents: number
          day: string
          deposit_basis_points: number
          deposit_cents: number
          ends_at: string
          free_cancel_deadline: string
          free_cancel_hours: number
          hour: number
          no_show_deposit_retained: boolean
          price_cents: number
          professional_id: string
          quoted_at: string
          starts_at: string
          terms_id: string
          terms_version: number
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
      reserve_wallet_withdrawal: {
        Args: { p_amount_cents: number; p_request_id: string }
        Returns: {
          amount_cents: number
          cancelled_at: string | null
          created_at: string
          id: string
          request_id: string
          status: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "wallet_withdrawals"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      review_esg_project: {
        Args: {
          p_decision: string
          p_expected_version: number
          p_project_id: string
          p_reason: string
        }
        Returns: {
          category: string
          description: string
          id: string
          owner_id: string
          request_id: string
          review_reason: string | null
          reviewed_at: string | null
          status: string
          submitted_at: string
          title: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "esg_projects"
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
      save_professional_availability: {
        Args: {
          p_day: string
          p_expected_version: number
          p_hours: number[]
          p_released: boolean
        }
        Returns: {
          available_hours: number[]
          day: string
          professional_id: string
          released: boolean
          updated_at: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "professional_availability_days"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      save_professional_booking_terms: {
        Args: {
          p_deposit_basis_points: number
          p_expected_version: number
          p_free_cancel_hours: number
          p_price_cents: number
          p_request_id: string
        }
        Returns: {
          created_at: string
          deposit_basis_points: number
          deposit_cents: number | null
          free_cancel_hours: number
          id: string
          no_show_deposit_retained: boolean
          price_cents: number
          professional_id: string
          request_id: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "professional_booking_terms"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      submit_esg_project: {
        Args: {
          p_category: string
          p_description: string
          p_request_id: string
          p_title: string
        }
        Returns: {
          category: string
          description: string
          id: string
          owner_id: string
          request_id: string
          review_reason: string | null
          reviewed_at: string | null
          status: string
          submitted_at: string
          title: string
          version: number
        }[]
        SetofOptions: {
          from: "*"
          to: "esg_projects"
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
