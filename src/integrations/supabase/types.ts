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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: number
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: never
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: never
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          assigned_to: string | null
          category: string
          code: string
          created_at: string
          id: string
          is_asset: boolean
          location: string | null
          name: string
          quantity: number
          reorder_level: number
          unit: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          code: string
          created_at?: string
          id?: string
          is_asset?: boolean
          location?: string | null
          name: string
          quantity?: number
          reorder_level?: number
          unit?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_asset?: boolean
          location?: string | null
          name?: string
          quantity?: number
          reorder_level?: number
          unit?: string
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          end_date: string
          history: Json
          id: string
          leave_type: string
          officer_id: string | null
          reason: string | null
          requested_by: string | null
          stage: number
          start_date: string
          status: string
        }
        Insert: {
          created_at?: string
          end_date: string
          history?: Json
          id?: string
          leave_type: string
          officer_id?: string | null
          reason?: string | null
          requested_by?: string | null
          stage?: number
          start_date: string
          status?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          history?: Json
          id?: string
          leave_type?: string
          officer_id?: string | null
          reason?: string | null
          requested_by?: string | null
          stage?: number
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          role: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      officers: {
        Row: {
          address: string | null
          commendations: string | null
          county: string | null
          created_at: string
          current_assignment: string | null
          date_joined: string | null
          date_of_birth: string | null
          disciplinary_actions: string | null
          education: string | null
          email: string | null
          emergency_contact: string | null
          employment_status: string
          full_name: string
          gender: string | null
          id: string
          marital_status: string | null
          medical_info: string | null
          nationality: string | null
          next_of_kin: string | null
          office_id: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          promotion_history: string | null
          rank: string
          section_id: string | null
          service_number: string
          training_history: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          commendations?: string | null
          county?: string | null
          created_at?: string
          current_assignment?: string | null
          date_joined?: string | null
          date_of_birth?: string | null
          disciplinary_actions?: string | null
          education?: string | null
          email?: string | null
          emergency_contact?: string | null
          employment_status?: string
          full_name: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          medical_info?: string | null
          nationality?: string | null
          next_of_kin?: string | null
          office_id?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          promotion_history?: string | null
          rank: string
          section_id?: string | null
          service_number: string
          training_history?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          commendations?: string | null
          county?: string | null
          created_at?: string
          current_assignment?: string | null
          date_joined?: string | null
          date_of_birth?: string | null
          disciplinary_actions?: string | null
          education?: string | null
          email?: string | null
          emergency_contact?: string | null
          employment_status?: string
          full_name?: string
          gender?: string | null
          id?: string
          marital_status?: string | null
          medical_info?: string | null
          nationality?: string | null
          next_of_kin?: string | null
          office_id?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          promotion_history?: string | null
          rank?: string
          section_id?: string | null
          service_number?: string
          training_history?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officers_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          id: string
          name: string
          rank_order: number
        }
        Insert: {
          id?: string
          name: string
          rank_order?: number
        }
        Update: {
          id?: string
          name?: string
          rank_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          id: string
          name: string
        }
        Insert: {
          id?: string
          name: string
        }
        Update: {
          id?: string
          name?: string
        }
        Relationships: []
      }
      supply_requests: {
        Row: {
          approval_status: string
          collection_status: string
          created_at: string
          description: string | null
          history: Json
          id: string
          item_id: string | null
          item_name: string
          justification: string | null
          priority: string
          quantity: number
          request_date: string
          request_number: string
          requested_by: string | null
          requested_by_name: string | null
          section_id: string | null
          stage: number
          unit: string
        }
        Insert: {
          approval_status?: string
          collection_status?: string
          created_at?: string
          description?: string | null
          history?: Json
          id?: string
          item_id?: string | null
          item_name: string
          justification?: string | null
          priority?: string
          quantity: number
          request_date?: string
          request_number?: string
          requested_by?: string | null
          requested_by_name?: string | null
          section_id?: string | null
          stage?: number
          unit?: string
        }
        Update: {
          approval_status?: string
          collection_status?: string
          created_at?: string
          description?: string | null
          history?: Json
          id?: string
          item_id?: string | null
          item_name?: string
          justification?: string | null
          priority?: string
          quantity?: number
          request_date?: string
          request_number?: string
          requested_by?: string | null
          requested_by_name?: string | null
          section_id?: string | null
          stage?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      act_on_leave: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: undefined
      }
      act_on_supply: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      leave_stage_role: {
        Args: { _stage: number }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
        }[]
      }
      supply_stage_role: {
        Args: { _stage: number }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
    }
    Enums: {
      app_role:
        | "commandant"
        | "deputy_commandant"
        | "dc_admin"
        | "dc_academy"
        | "assistant_commissioner"
        | "section_head"
        | "officer"
        | "storekeeper"
        | "finance_officer"
        | "hr_officer"
        | "ict_admin"
        | "system_admin"
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
    Enums: {
      app_role: [
        "commandant",
        "deputy_commandant",
        "dc_admin",
        "dc_academy",
        "assistant_commissioner",
        "section_head",
        "officer",
        "storekeeper",
        "finance_officer",
        "hr_officer",
        "ict_admin",
        "system_admin",
      ],
    },
  },
} as const
