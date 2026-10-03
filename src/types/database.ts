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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          bank_name: string
          created_at: string
          deleted_at: string | null
          id: string
          is_default: boolean
          last4: string | null
          name: string
          user_id: string
        }
        Insert: {
          bank_name: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          last4?: string | null
          name: string
          user_id: string
        }
        Update: {
          bank_name?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_default?: boolean
          last4?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      cheque_history: {
        Row: {
          changed_by: string
          cheque_id: string
          created_at: string | null
          from_status: string
          id: string
          note: string | null
          prev_state: Json | null
          reverts_history_id: string | null
          to_status: string
        }
        Insert: {
          changed_by: string
          cheque_id: string
          created_at?: string | null
          from_status: string
          id?: string
          note?: string | null
          prev_state?: Json | null
          reverts_history_id?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string
          cheque_id?: string
          created_at?: string | null
          from_status?: string
          id?: string
          note?: string | null
          prev_state?: Json | null
          reverts_history_id?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cheque_history_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheque_history_reverts_history_id_fkey"
            columns: ["reverts_history_id"]
            isOneToOne: false
            referencedRelation: "cheque_history"
            referencedColumns: ["id"]
          },
        ]
      }
      cheques: {
        Row: {
          amount: number
          auto_transition_blocked: boolean | null
          bank_account_id: string | null
          bank_name: string
          cheque_number: string
          created_at: string | null
          deleted_at: string | null
          due_date: string
          id: string
          issue_date: string
          notes: string | null
          original_due_date: string | null
          party_id: string
          replaces_cheque_id: string | null
          represent_count: number
          return_reason: string | null
          status: string
          updated_at: string | null
          user_id: string
          write_off_reason: string | null
        }
        Insert: {
          amount: number
          auto_transition_blocked?: boolean | null
          bank_account_id?: string | null
          bank_name: string
          cheque_number: string
          created_at?: string | null
          deleted_at?: string | null
          due_date: string
          id?: string
          issue_date: string
          notes?: string | null
          original_due_date?: string | null
          party_id: string
          replaces_cheque_id?: string | null
          represent_count?: number
          return_reason?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
          write_off_reason?: string | null
        }
        Update: {
          amount?: number
          auto_transition_blocked?: boolean | null
          bank_account_id?: string | null
          bank_name?: string
          cheque_number?: string
          created_at?: string | null
          deleted_at?: string | null
          due_date?: string
          id?: string
          issue_date?: string
          notes?: string | null
          original_due_date?: string | null
          party_id?: string
          replaces_cheque_id?: string | null
          represent_count?: number
          return_reason?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
          write_off_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cheques_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cheques_replaces_cheque_id_fkey"
            columns: ["replaces_cheque_id"]
            isOneToOne: false
            referencedRelation: "cheques"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_deposits: {
        Row: {
          amount: number
          bank_account_id: string | null
          created_at: string | null
          deposit_date: string
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          amount: number
          bank_account_id?: string | null
          created_at?: string | null
          deposit_date?: string
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          bank_account_id?: string | null
          created_at?: string | null
          deposit_date?: string
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_deposits_bank_account_id_fkey"
            columns: ["bank_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      entitlements: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          note: string | null
          payment_ref: string | null
          plan: string
          source: string
          starts_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          payment_ref?: string | null
          plan?: string
          source: string
          starts_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          note?: string | null
          payment_ref?: string | null
          plan?: string
          source?: string
          starts_at?: string
          user_id?: string
        }
        Relationships: []
      }
      instance_config: {
        Row: {
          billing_enabled: boolean
          default_country_code: string | null
          demos_per_hour: number
          id: boolean
          trial_days: number
          updated_at: string
        }
        Insert: {
          billing_enabled?: boolean
          default_country_code?: string | null
          demos_per_hour?: number
          id?: boolean
          trial_days?: number
          updated_at?: string
        }
        Update: {
          billing_enabled?: boolean
          default_country_code?: string | null
          demos_per_hour?: number
          id?: boolean
          trial_days?: number
          updated_at?: string
        }
        Relationships: []
      }
      packs: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          currency: string
          id: string
          months: number
          name: string
          sort: number
          tax_amount: number | null
          tax_name: string | null
          tax_percent: number
          total: number | null
        }
        Insert: {
          active?: boolean
          amount: number
          created_at?: string
          currency: string
          id: string
          months: number
          name: string
          sort?: number
          tax_amount?: never
          tax_name?: string | null
          tax_percent?: number
          total?: never
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          months?: number
          name?: string
          sort?: number
          tax_amount?: never
          tax_name?: string | null
          tax_percent?: number
          total?: never
        }
        Relationships: []
      }
      parties: {
        Row: {
          bank_name: string | null
          contact_name: string | null
          created_at: string | null
          deleted_at: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          user_id: string
        }
        Insert: {
          bank_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          user_id: string
        }
        Update: {
          bank_name?: string | null
          contact_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_orders: {
        Row: {
          amount: number
          created_at: string
          currency: string
          entitlement_id: string | null
          id: string
          months: number
          pack_id: string
          pack_name: string
          paid_at: string | null
          payment_id: string | null
          status: string
          tax_amount: number
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          entitlement_id?: string | null
          id: string
          months: number
          pack_id: string
          pack_name: string
          paid_at?: string | null
          payment_id?: string | null
          status?: string
          tax_amount?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          entitlement_id?: string | null
          id?: string
          months?: number
          pack_id?: string
          pack_name?: string
          paid_at?: string | null
          payment_id?: string | null
          status?: string
          tax_amount?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_orders_entitlement_id_fkey"
            columns: ["entitlement_id"]
            isOneToOne: false
            referencedRelation: "entitlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_orders_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "packs"
            referencedColumns: ["id"]
          },
        ]
      }
      received_cheque_history: {
        Row: {
          changed_by: string
          cheque_id: string
          created_at: string
          from_status: string
          id: string
          note: string | null
          prev_state: Json
          reverts_history_id: string | null
          to_status: string
        }
        Insert: {
          changed_by: string
          cheque_id: string
          created_at?: string
          from_status: string
          id?: string
          note?: string | null
          prev_state: Json
          reverts_history_id?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string
          cheque_id?: string
          created_at?: string
          from_status?: string
          id?: string
          note?: string | null
          prev_state?: Json
          reverts_history_id?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "received_cheque_history_cheque_id_fkey"
            columns: ["cheque_id"]
            isOneToOne: false
            referencedRelation: "received_cheques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_cheque_history_reverts_history_id_fkey"
            columns: ["reverts_history_id"]
            isOneToOne: false
            referencedRelation: "received_cheque_history"
            referencedColumns: ["id"]
          },
        ]
      }
      received_cheques: {
        Row: {
          amount: number | null
          bank_charges: number | null
          bank_name: string
          bounce_reason: string | null
          bounced_on: string | null
          cheque_date: string | null
          cheque_number: string
          cleared_on: string | null
          close_reason: string | null
          created_at: string
          deleted_at: string | null
          deposit_account_id: string | null
          deposited_on: string | null
          due_date: string
          id: string
          kind: string
          notes: string | null
          party_id: string
          received_on: string
          redeposit_count: number
          replaces_id: string | null
          series_id: string | null
          series_index: number | null
          settled_on: string | null
          settled_via: string | null
          settlement_ref: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          bank_charges?: number | null
          bank_name: string
          bounce_reason?: string | null
          bounced_on?: string | null
          cheque_date?: string | null
          cheque_number: string
          cleared_on?: string | null
          close_reason?: string | null
          created_at?: string
          deleted_at?: string | null
          deposit_account_id?: string | null
          deposited_on?: string | null
          due_date: string
          id?: string
          kind?: string
          notes?: string | null
          party_id: string
          received_on: string
          redeposit_count?: number
          replaces_id?: string | null
          series_id?: string | null
          series_index?: number | null
          settled_on?: string | null
          settled_via?: string | null
          settlement_ref?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          bank_charges?: number | null
          bank_name?: string
          bounce_reason?: string | null
          bounced_on?: string | null
          cheque_date?: string | null
          cheque_number?: string
          cleared_on?: string | null
          close_reason?: string | null
          created_at?: string
          deleted_at?: string | null
          deposit_account_id?: string | null
          deposited_on?: string | null
          due_date?: string
          id?: string
          kind?: string
          notes?: string | null
          party_id?: string
          received_on?: string
          redeposit_count?: number
          replaces_id?: string | null
          series_id?: string | null
          series_index?: number | null
          settled_on?: string | null
          settled_via?: string | null
          settlement_ref?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "received_cheques_deposit_account_id_fkey"
            columns: ["deposit_account_id"]
            isOneToOne: false
            referencedRelation: "bank_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_cheques_party_id_fkey"
            columns: ["party_id"]
            isOneToOne: false
            referencedRelation: "parties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "received_cheques_replaces_id_fkey"
            columns: ["replaces_id"]
            isOneToOne: false
            referencedRelation: "received_cheques"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          allocation_sort: string | null
          auto_pass_enabled: boolean
          auto_pass_time: string | null
          banks: string[] | null
          cheque_validity_months: number | null
          clearing_days: number | null
          country_code: string | null
          created_at: string | null
          currency_code: string | null
          currency_symbol: string | null
          date_format: string | null
          id: string
          locale: string | null
          timezone: string | null
          tour_done_at: string | null
          tracks: string
          updated_at: string | null
          user_id: string
          week_starts_on: number | null
        }
        Insert: {
          allocation_sort?: string | null
          auto_pass_enabled?: boolean
          auto_pass_time?: string | null
          banks?: string[] | null
          cheque_validity_months?: number | null
          clearing_days?: number | null
          country_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          currency_symbol?: string | null
          date_format?: string | null
          id?: string
          locale?: string | null
          timezone?: string | null
          tour_done_at?: string | null
          tracks?: string
          updated_at?: string | null
          user_id: string
          week_starts_on?: number | null
        }
        Update: {
          allocation_sort?: string | null
          auto_pass_enabled?: boolean
          auto_pass_time?: string | null
          banks?: string[] | null
          cheque_validity_months?: number | null
          clearing_days?: number | null
          country_code?: string | null
          created_at?: string | null
          currency_code?: string | null
          currency_symbol?: string | null
          date_format?: string | null
          id?: string
          locale?: string | null
          timezone?: string | null
          tour_done_at?: string | null
          tracks?: string
          updated_at?: string | null
          user_id?: string
          week_starts_on?: number | null
        }
        Relationships: []
      }
      trial_refusals: {
        Row: {
          created_at: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      all_cheques: {
        Row: {
          amount: number | null
          bank_name: string | null
          cheque_date: string | null
          cheque_number: string | null
          created_at: string | null
          direction: string | null
          due_date: string | null
          id: string | null
          kind: string | null
          party_id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bounce_received_cheque: {
        Args: {
          p_bank_charges?: number
          p_bounced_on: string
          p_cheque_id: string
          p_note?: string
          p_reason: string
        }
        Returns: undefined
      }
      change_cheque_status: {
        Args: {
          p_changed_by?: string
          p_cheque_id: string
          p_new_status: string
          p_note?: string
          p_return_reason?: string
        }
        Returns: undefined
      }
      cheque_state_snapshot: {
        Args: { c: Database["public"]["Tables"]["cheques"]["Row"] }
        Returns: Json
      }
      clear_received_cheques: {
        Args: { p_cheque_ids: string[]; p_cleared_on: string; p_note?: string }
        Returns: number
      }
      deposit_received_cheques: {
        Args: {
          p_account_id?: string
          p_cheque_ids: string[]
          p_deposited_on: string
          p_note?: string
        }
        Returns: number
      }
      hand_back_received_cheque: {
        Args: { p_cheque_id: string; p_reason?: string }
        Returns: undefined
      }
      end_demo: { Args: never; Returns: undefined }
      has_write_access: { Args: never; Returns: boolean }
      import_data: { Args: { p_data: Json }; Returns: Json }
      is_legacy_represented: {
        Args: { c: Database["public"]["Tables"]["cheques"]["Row"] }
        Returns: boolean
      }
      record_deposit: {
        Args: {
          p_account_id?: string
          p_amount: number
          p_cheque_ids?: string[]
          p_deposit_date: string
          p_notes?: string
        }
        Returns: string
      }
      record_payment: {
        Args: { p_order_id: string; p_payment_id: string }
        Returns: Database["public"]["Tables"]["entitlements"]["Row"]
      }
      redeposit_received_cheque: {
        Args: {
          p_account_id?: string
          p_cheque_id: string
          p_date: string
          p_deposit_now?: boolean
          p_note?: string
        }
        Returns: undefined
      }
      replace_received_cheque: {
        Args: {
          p_amount: number
          p_bank_name: string
          p_cheque_date: string
          p_cheque_id: string
          p_cheque_number: string
          p_due_date?: string
          p_notes?: string
          p_received_on: string
        }
        Returns: string
      }
      represent_cheque: {
        Args: {
          p_cheque_id: string
          p_mark_deposited?: boolean
          p_new_due_date: string
          p_note?: string
        }
        Returns: undefined
      }
      rollback_cheque_status: {
        Args: { p_cheque_id: string; p_note?: string }
        Returns: string
      }
      rollback_received_cheque: {
        Args: { p_cheque_id: string; p_note?: string }
        Returns: string
      }
      settle_received_cheque: {
        Args: {
          p_cheque_id: string
          p_note?: string
          p_reference?: string
          p_settled_on: string
          p_via: string
        }
        Returns: undefined
      }
      start_demo: { Args: { p_region: Json }; Returns: undefined }
      write_off_cheque: {
        Args: { p_cheque_id: string; p_reason: string }
        Returns: undefined
      }
      write_off_received_cheque: {
        Args: { p_cheque_id: string; p_reason: string }
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
