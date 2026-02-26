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
      alert_log: {
        Row: {
          category: string
          channel: string
          id: string
          is_manual: boolean
          recipient_email: string | null
          recipient_name: string | null
          recipient_user_id: string
          sent_at: string
          sent_by: string | null
          subject: string
        }
        Insert: {
          category: string
          channel?: string
          id?: string
          is_manual?: boolean
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_user_id: string
          sent_at?: string
          sent_by?: string | null
          subject: string
        }
        Update: {
          category?: string
          channel?: string
          id?: string
          is_manual?: boolean
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_user_id?: string
          sent_at?: string
          sent_by?: string | null
          subject?: string
        }
        Relationships: []
      }
      alert_settings: {
        Row: {
          category: string
          channel: string
          id: string
          is_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          channel?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          channel?: string
          id?: string
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string
          content_en: string
          content_ko: string
          created_at: string
          id: string
          is_active: boolean
          published_at: string
          summary_en: string | null
          summary_ko: string | null
          thumbnail_url: string | null
          title_en: string
          title_ko: string
          updated_at: string
        }
        Insert: {
          author?: string
          content_en?: string
          content_ko?: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          summary_en?: string | null
          summary_ko?: string | null
          thumbnail_url?: string | null
          title_en?: string
          title_ko?: string
          updated_at?: string
        }
        Update: {
          author?: string
          content_en?: string
          content_ko?: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          summary_en?: string | null
          summary_ko?: string | null
          thumbnail_url?: string | null
          title_en?: string
          title_ko?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_investments: {
        Row: {
          created_at: string
          created_by: string | null
          current_value: number
          date_invested: string | null
          expected_return: number | null
          id: string
          invested_currency: string | null
          investment_amount: number
          maturity_date: string | null
          product_id: string | null
          product_name_en: string
          product_name_ko: string
          realized_return_amount: number | null
          realized_return_percent: number | null
          start_date: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          current_value: number
          date_invested?: string | null
          expected_return?: number | null
          id?: string
          invested_currency?: string | null
          investment_amount: number
          maturity_date?: string | null
          product_id?: string | null
          product_name_en: string
          product_name_ko: string
          realized_return_amount?: number | null
          realized_return_percent?: number | null
          start_date: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          current_value?: number
          date_invested?: string | null
          expected_return?: number | null
          id?: string
          invested_currency?: string | null
          investment_amount?: number
          maturity_date?: string | null
          product_id?: string | null
          product_name_en?: string
          product_name_ko?: string
          realized_return_amount?: number | null
          realized_return_percent?: number | null
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
      commission_audit_log: {
        Row: {
          action: string
          changed_by: string
          created_at: string
          id: string
          new_values: Json | null
          old_values: Json | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          changed_by: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          changed_by?: string
          created_at?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      commission_distributions: {
        Row: {
          created_at: string
          currency: string | null
          from_user_id: string | null
          id: string
          investment_id: string
          layer: number
          performance_amount: number | null
          rate_used: number | null
          set_by_user_id: string | null
          status: string
          to_user_id: string
          upfront_amount: number | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          from_user_id?: string | null
          id?: string
          investment_id: string
          layer: number
          performance_amount?: number | null
          rate_used?: number | null
          set_by_user_id?: string | null
          status?: string
          to_user_id: string
          upfront_amount?: number | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          from_user_id?: string | null
          id?: string
          investment_id?: string
          layer?: number
          performance_amount?: number | null
          rate_used?: number | null
          set_by_user_id?: string | null
          status?: string
          to_user_id?: string
          upfront_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_distributions_investment_id_fkey"
            columns: ["investment_id"]
            isOneToOne: false
            referencedRelation: "client_investments"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_rates: {
        Row: {
          created_at: string
          id: string
          is_override: boolean | null
          max_rate: number | null
          min_rate: number | null
          override_user_id: string | null
          performance_rate: number
          product_id: string
          sales_level: number
          sales_role: string
          set_by: string | null
          updated_at: string
          upfront_rate: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_override?: boolean | null
          max_rate?: number | null
          min_rate?: number | null
          override_user_id?: string | null
          performance_rate?: number
          product_id: string
          sales_level: number
          sales_role: string
          set_by?: string | null
          updated_at?: string
          upfront_rate?: number
        }
        Update: {
          created_at?: string
          id?: string
          is_override?: boolean | null
          max_rate?: number | null
          min_rate?: number | null
          override_user_id?: string | null
          performance_rate?: number
          product_id?: string
          sales_level?: number
          sales_role?: string
          set_by?: string | null
          updated_at?: string
          upfront_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_rates_product_id_fkey"
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
      interest_news: {
        Row: {
          content_en: string
          content_ko: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          title_en: string
          title_ko: string
          updated_at: string
          url: string
        }
        Insert: {
          content_en?: string
          content_ko?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          title_en?: string
          title_ko?: string
          updated_at?: string
          url?: string
        }
        Update: {
          content_en?: string
          content_ko?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          title_en?: string
          title_ko?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      investment_products: {
        Row: {
          created_at: string
          currency: string | null
          default_currency: string | null
          description_en: string | null
          description_ko: string | null
          fixed_return_percent: number | null
          fundraising_amount: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          management_fee_percent: number | null
          min_investment_amount: number | null
          minimum_investment: number | null
          name_en: string
          name_ko: string
          performance_fee_percent: number | null
          status: string | null
          target_return: number | null
          target_return_percent: number | null
          type: string
          updated_at: string
          upfront_commission_percent: number | null
          募集_deadline: string | null
        }
        Insert: {
          created_at?: string
          currency?: string | null
          default_currency?: string | null
          description_en?: string | null
          description_ko?: string | null
          fixed_return_percent?: number | null
          fundraising_amount?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          management_fee_percent?: number | null
          min_investment_amount?: number | null
          minimum_investment?: number | null
          name_en: string
          name_ko: string
          performance_fee_percent?: number | null
          status?: string | null
          target_return?: number | null
          target_return_percent?: number | null
          type: string
          updated_at?: string
          upfront_commission_percent?: number | null
          募集_deadline?: string | null
        }
        Update: {
          created_at?: string
          currency?: string | null
          default_currency?: string | null
          description_en?: string | null
          description_ko?: string | null
          fixed_return_percent?: number | null
          fundraising_amount?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          management_fee_percent?: number | null
          min_investment_amount?: number | null
          minimum_investment?: number | null
          name_en?: string
          name_ko?: string
          performance_fee_percent?: number | null
          status?: string | null
          target_return?: number | null
          target_return_percent?: number | null
          type?: string
          updated_at?: string
          upfront_commission_percent?: number | null
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
      namsan_viewpoints: {
        Row: {
          content_en: string
          content_ko: string
          created_at: string
          display_order: number
          id: string
          image_url: string | null
          is_active: boolean
          title_en: string
          title_ko: string
          updated_at: string
        }
        Insert: {
          content_en?: string
          content_ko?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          title_en?: string
          title_ko?: string
          updated_at?: string
        }
        Update: {
          content_en?: string
          content_ko?: string
          created_at?: string
          display_order?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          title_en?: string
          title_ko?: string
          updated_at?: string
        }
        Relationships: []
      }
      newsletters: {
        Row: {
          blog_post_id: string | null
          content_en: string
          content_ko: string
          created_at: string
          id: string
          recipient_count: number | null
          sent_at: string | null
          sent_by: string | null
          status: string
          subject_en: string
          subject_ko: string
          updated_at: string
        }
        Insert: {
          blog_post_id?: string | null
          content_en?: string
          content_ko?: string
          created_at?: string
          id?: string
          recipient_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject_en?: string
          subject_ko?: string
          updated_at?: string
        }
        Update: {
          blog_post_id?: string | null
          content_en?: string
          content_ko?: string
          created_at?: string
          id?: string
          recipient_count?: number | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject_en?: string
          subject_ko?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletters_blog_post_id_fkey"
            columns: ["blog_post_id"]
            isOneToOne: false
            referencedRelation: "blog_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body_en: string
          body_ko: string
          created_at: string
          id: string
          is_read: boolean
          link: string | null
          title_en: string
          title_ko: string
          type: string
          user_id: string
        }
        Insert: {
          body_en?: string
          body_ko?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title_en?: string
          title_ko?: string
          type?: string
          user_id: string
        }
        Update: {
          body_en?: string
          body_ko?: string
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string | null
          title_en?: string
          title_ko?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      popup_ads: {
        Row: {
          button_link: string | null
          button_text_en: string | null
          button_text_ko: string | null
          created_at: string
          description_en: string | null
          description_ko: string | null
          display_order: number
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean
          start_date: string | null
          title_en: string
          title_ko: string
          updated_at: string
        }
        Insert: {
          button_link?: string | null
          button_text_en?: string | null
          button_text_ko?: string | null
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          start_date?: string | null
          title_en?: string
          title_ko?: string
          updated_at?: string
        }
        Update: {
          button_link?: string | null
          button_text_en?: string | null
          button_text_ko?: string | null
          created_at?: string
          description_en?: string | null
          description_ko?: string | null
          display_order?: number
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          start_date?: string | null
          title_en?: string
          title_ko?: string
          updated_at?: string
        }
        Relationships: []
      }
      popup_dismissals: {
        Row: {
          dismissed_at: string
          id: string
          popup_id: string
          user_id: string
        }
        Insert: {
          dismissed_at?: string
          id?: string
          popup_id: string
          user_id: string
        }
        Update: {
          dismissed_at?: string
          id?: string
          popup_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "popup_dismissals_popup_id_fkey"
            columns: ["popup_id"]
            isOneToOne: false
            referencedRelation: "popup_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      product_documents: {
        Row: {
          created_at: string
          display_order: number
          document_type: string
          file_size: number | null
          file_url: string
          id: string
          name_en: string
          name_ko: string
          product_id: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          display_order?: number
          document_type?: string
          file_size?: number | null
          file_url: string
          id?: string
          name_en?: string
          name_ko?: string
          product_id: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          display_order?: number
          document_type?: string
          file_size?: number | null
          file_url?: string
          id?: string
          name_en?: string
          name_ko?: string
          product_id?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_documents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "investment_products"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address: string | null
          approved_at: string | null
          approved_by: string | null
          birthday: string | null
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          email: string
          full_name: string
          full_name_ko: string | null
          id: string
          is_admin: boolean | null
          is_approved: boolean | null
          is_deleted: boolean | null
          is_rejected: boolean | null
          parent_id: string | null
          phone: string | null
          preferred_currency: string | null
          preferred_language: string | null
          rejected_at: string | null
          rejected_by: string | null
          sales_level: number | null
          sales_role: string | null
          sales_status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          birthday?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          full_name: string
          full_name_ko?: string | null
          id?: string
          is_admin?: boolean | null
          is_approved?: boolean | null
          is_deleted?: boolean | null
          is_rejected?: boolean | null
          parent_id?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          sales_level?: number | null
          sales_role?: string | null
          sales_status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          approved_at?: string | null
          approved_by?: string | null
          birthday?: string | null
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          full_name?: string
          full_name_ko?: string | null
          id?: string
          is_admin?: boolean | null
          is_approved?: boolean | null
          is_deleted?: boolean | null
          is_rejected?: boolean | null
          parent_id?: string | null
          phone?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          rejected_at?: string | null
          rejected_by?: string | null
          sales_level?: number | null
          sales_role?: string | null
          sales_status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_profiles_parent"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
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
          market: string
          price_reference_date: string | null
          recommendation_date: string
          sold_date: string | null
          sold_price: number | null
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
          market?: string
          price_reference_date?: string | null
          recommendation_date: string
          sold_date?: string | null
          sold_price?: number | null
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
          market?: string
          price_reference_date?: string | null
          recommendation_date?: string
          sold_date?: string | null
          sold_price?: number | null
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
      get_sales_ancestors: {
        Args: { _user_id: string }
        Returns: {
          depth: number
          full_name: string
          sales_level: number
          sales_role: string
          user_id: string
        }[]
      }
      get_sales_subtree: {
        Args: { _user_id: string }
        Returns: {
          depth: number
          full_name: string
          parent_id: string
          sales_level: number
          sales_role: string
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_district_manager: { Args: { _user_id: string }; Returns: boolean }
      is_in_subtree: {
        Args: { _ancestor_id: string; _descendant_id: string }
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
