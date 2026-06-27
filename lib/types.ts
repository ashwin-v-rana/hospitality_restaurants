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
      agent_restaurants: {
        Row: {
          agent_id: string
          restaurant_id: string
        }
        Insert: {
          agent_id: string
          restaurant_id: string
        }
        Update: {
          agent_id?: string
          restaurant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_restaurants_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_restaurants_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: string
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          role?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: string
        }
        Relationships: []
      }
      auth_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          member_id: string | null
          result: string
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          member_id?: string | null
          result: string
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          member_id?: string | null
          result?: string
        }
        Relationships: [
          {
            foreignKeyName: "auth_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          member_number: string
          phone: string
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          member_number: string
          phone: string
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          member_number?: string
          phone?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          cancelled_at: string | null
          confirmation_code: string
          created_at: string | null
          id: string
          member_id: string
          occasion: string | null
          party_size: number
          restaurant_id: string
          slot_date: string
          slot_time: string
          special_request: string | null
          status: string
          turn_minutes: number
        }
        Insert: {
          cancelled_at?: string | null
          confirmation_code?: string
          created_at?: string | null
          id?: string
          member_id: string
          occasion?: string | null
          party_size: number
          restaurant_id: string
          slot_date: string
          slot_time: string
          special_request?: string | null
          status?: string
          turn_minutes: number
        }
        Update: {
          cancelled_at?: string | null
          confirmation_code?: string
          created_at?: string | null
          id?: string
          member_id?: string
          occasion?: string | null
          party_size?: number
          restaurant_id?: string
          slot_date?: string
          slot_time?: string
          special_request?: string | null
          status?: string
          turn_minutes?: number
        }
        Relationships: [
          {
            foreignKeyName: "reservations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservations_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurants: {
        Row: {
          created_at: string | null
          id: string
          large_party_phone: string | null
          name: string
          slot_interval_minutes: number
          slug: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          large_party_phone?: string | null
          name: string
          slot_interval_minutes?: number
          slug: string
        }
        Update: {
          created_at?: string | null
          id?: string
          large_party_phone?: string | null
          name?: string
          slot_interval_minutes?: number
          slug?: string
        }
        Relationships: []
      }
      service_windows: {
        Row: {
          close_time: string
          day_of_week: number
          id: string
          open_time: string
          restaurant_id: string
          service_name: string
        }
        Insert: {
          close_time: string
          day_of_week: number
          id?: string
          open_time: string
          restaurant_id: string
          service_name?: string
        }
        Update: {
          close_time?: string
          day_of_week?: number
          id?: string
          open_time?: string
          restaurant_id?: string
          service_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_windows_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      time_slots: {
        Row: {
          capacity_remaining: number
          capacity_total: number
          id: string
          restaurant_id: string
          slot_date: string
          slot_time: string
        }
        Insert: {
          capacity_remaining: number
          capacity_total: number
          id?: string
          restaurant_id: string
          slot_date: string
          slot_time: string
        }
        Update: {
          capacity_remaining?: number
          capacity_total?: number
          id?: string
          restaurant_id?: string
          slot_date?: string
          slot_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_slots_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_restaurant: {
        Args: { p_agent_id: string; p_assign: boolean; p_restaurant_id: string }
        Returns: boolean
      }
      admin_set_agent_active: {
        Args: { p_active: boolean; p_agent_id: string }
        Returns: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: string
        }
        SetofOptions: {
          from: "*"
          to: "agents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_set_agent_role: {
        Args: { p_agent_id: string; p_role: string }
        Returns: {
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          role: string
        }
        SetofOptions: {
          from: "*"
          to: "agents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_has_restaurant: {
        Args: { p_restaurant_id: string }
        Returns: boolean
      }
      cancel_reservation: {
        Args: { p_reservation_id: string }
        Returns: boolean
      }
      create_member: {
        Args: {
          p_email?: string
          p_first_name: string
          p_last_name: string
          p_phone: string
        }
        Returns: {
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          member_number: string
          phone: string
        }
        SetofOptions: {
          from: "*"
          to: "members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_reservation: {
        Args: {
          p_member_id: string
          p_occasion?: string
          p_party_size: number
          p_restaurant_id: string
          p_slot_date: string
          p_slot_time: string
          p_special_request?: string
        }
        Returns: {
          confirmation_code: string
          reservation_id: string
        }[]
      }
      gen_cecconis_conf_code: { Args: never; Returns: string }
      gen_confirmation_code: { Args: { p_prefix: string }; Returns: string }
      gen_ned_member_number: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      turn_minutes: { Args: { p_party: number }; Returns: number }
      update_member: {
        Args: {
          p_email?: string
          p_first_name: string
          p_last_name: string
          p_member_id: string
          p_phone: string
        }
        Returns: {
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          member_number: string
          phone: string
        }
        SetofOptions: {
          from: "*"
          to: "members"
          isOneToOne: true
          isSetofReturn: false
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
