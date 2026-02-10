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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      client_investments: {
        Row: {
          created_at: string
          current_value: number
          expected_return: number | null
          id: string
          investment_amount: number
          maturity_date: string | null
          product_id: string | null
          product_name_en: string
          product_name_ko: string
          start_date: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_value: number
          expected_return?: number | null
          id?: string
          investment_amount: number
          maturity_date?: string | null
          product_id?: string | null
          product_name_en: string
          product_name_ko: string
          start_date: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_value?: number
          expected_return?: number | null
          id?: string
          investment_amount?: number
          maturity_date?: string | null
          product_id?: string | null
          product_name_en?: string
          product_name_ko?: string
          start_date?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_investments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      client_product_access: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_product_access_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      distributions: {
        Row: {
          amount: number
          created_at: string
          description_en: string | null
          description_ko: string | null
          distribution_date: string
          id: string
          investment_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          distribution_date: string
          id?: string
          investment_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          distribution_date?: string
          id?: string
          investment_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "distributions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "client_investments"
            referencedColumns: ["id"]
          },
        ]
      }
      investment_products: {
        Row: {
          created_at: string
          description_en: string | null
          description_ko: string | null
          id: string
          is_active: boolean | null
          minimum_investment: number | null
          name_en: string
          name_ko: string
          status: string | null
          target_return: number | null
          type: string
          updated_at: string
          募集_deadline: string | null
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          minimum_investment?: number | null
          name_en: string
          name_ko: string
          status?: string | null
          target_return?: number | null
          type: string
          updated_at?: string
          募集_deadline?: string | null
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          minimum_investment?: number | null
          name_en?: string
          name_ko?: string
          status?: string | null
          target_return?: number | null
          type?: string
          updated_at?: string
          募集_deadline?: string | null
        }
        Relationships: []
      }
      market_indices: {
        Row: {
          change_percent: number | null
          change_value: number | null
          color_class: string | null
          created_at: string
          current_value: number
          display_order: number | null
          external_link: string | null
          id: string
          is_active: boolean | null
          name_en: string
          name_ko: string
          symbol: string
          updated_at: string
        }
        Insert: {
          change_percent?: number | null
          change_value?: number | null
          color_class?: string | null
          created_at?: string
          current_value: number
          display_order?: number | null
          external_link?: string | null
          id?: string
          is_active?: boolean | null
          name_en: string
          name_ko: string
          symbol: string
          updated_at?: string
        }
        Update: {
          change_percent?: number | null
          change_value?: number | null
          color_class?: string | null
          created_at?: string
          current_value?: number
          display_order?: number | null
          external_link?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          name_ko?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: []
      }
      market_overview_items: {
        Row: {
          change_percent: number | null
          change_value: number | null
          created_at: string
          current_value: number | null
          display_order: number
          id: string
          is_active: boolean
          symbol: string
          title_en: string
          title_ko: string
          updated_at: string
        }
        Insert: {
          change_percent?: number | null
          change_value?: number | null
          created_at?: string
          current_value?: number | null
          display_order?: number
          id?: string
          is_active?: boolean
          symbol: string
          title_en: string
          title_ko: string
          updated_at?: string
        }
        Update: {
          change_percent?: number | null
          change_value?: number | null
          created_at?: string
          current_value?: number | null
          display_order?: number
          id?: string
          is_active?: boolean
          symbol?: string
          title_en?: string
          title_ko?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          birthday: string | null
          created_at: string
          email: string
          full_name: string
          full_name_ko: string | null
          id: string
          is_admin: boolean | null
          is_approved: boolean | null
          phone: string | null
          preferred_language: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          birthday?: string | null
          created_at?: string
          email: string
          full_name: string
          full_name_ko?: string | null
          id?: string
          is_admin?: boolean | null
          is_approved?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          birthday?: string | null
          created_at?: string
          email?: string
          full_name?: string
          full_name_ko?: string | null
          id?: string
          is_admin?: boolean | null
          is_approved?: boolean | null
          phone?: string | null
          preferred_language?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      research_reports: {
        Row: {
          admin_note: string | null
          category: string
          created_at: string
          id: string
          is_active: boolean | null
          pdf_url: string | null
          publication_date: string
          summary_en: string | null
          summary_ko: string | null
          title_en: string
          title_ko: string
        }
        Insert: {
          admin_note?: string | null
          category: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          pdf_url?: string | null
          publication_date?: string
          summary_en?: string | null
          summary_ko?: string | null
          title_en: string
          title_ko: string
        }
        Update: {
          admin_note?: string | null
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          pdf_url?: string | null
          publication_date?: string
          summary_en?: string | null
          summary_ko?: string | null
          title_en?: string
          title_ko?: string
        }
        Relationships: []
      }
      stock_pick_news: {
        Row: {
          citations: Json
          created_at: string
          fetched_at: string
          id: string
          news_bullets: Json
          stock_code: string | null
          stock_name: string
        }
        Insert: {
          citations?: Json
          created_at?: string
          fetched_at?: string
          id?: string
          news_bullets?: Json
          stock_code?: string | null
          stock_name: string
        }
        Update: {
          citations?: Json
          created_at?: string
          fetched_at?: string
          id?: string
          news_bullets?: Json
          stock_code?: string | null
          stock_name?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      videos: {
        Row: {
          category: string
          created_at: string
          description_en: string | null
          description_ko: string | null
          id: string
          is_active: boolean | null
          thumbnail_url: string | null
          title_en: string
          title_ko: string
          youtube_url: string
        }
        Insert: {
          category: string
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          thumbnail_url?: string | null
          title_en: string
          title_ko: string
          youtube_url: string
        }
        Update: {
          category?: string
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          thumbnail_url?: string | null
          title_en?: string
          title_ko?: string
          youtube_url?: string
        }
        Relationships: []
      }
      weekly_stock_picks: {
        Row: {
          closing_price_at_recommendation: number
          created_at: string
          current_closing_price: number | null
          display_order: number
          id: string
          is_active: boolean
          price_reference_date: string | null
          recommendation_date: string
          stock_code: string | null
          stock_name: string
          updated_at: string
        }
        Insert: {
          closing_price_at_recommendation: number
          created_at?: string
          current_closing_price?: number | null
          display_order?: number
          id?: string
          is_active?: boolean
          price_reference_date?: string | null
          recommendation_date: string
          stock_code?: string | null
          stock_name: string
          updated_at?: string
        }
        Update: {
          closing_price_at_recommendation?: number
          created_at?: string
          current_closing_price?: number | null
          display_order?: number
          id?: string
          is_active?: boolean
          price_reference_date?: string | null
          recommendation_date?: string
          stock_code?: string | null
          stock_name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
