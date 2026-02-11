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
      change_requests: {
        Row: {
          created_at: string
          id: string
          new_data: Json
          old_data: Json
          player_id: string
          player_name: string | null
          status: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          new_data: Json
          old_data: Json
          player_id: string
          player_name?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          new_data?: Json
          old_data?: Json
          player_id?: string
          player_name?: string | null
          status?: string | null
        }
        Relationships: []
      }
      characters: {
        Row: {
          age: number | null
          agility: number | null
          anomalies: string[] | null
          aptitude: number | null
          bloodline: string | null
          breathing_lvl: number | null
          breathing_style: string | null
          char_name: string | null
          charisma: number | null
          class: string | null
          current_hp: number | null
          discord_username: string | null
          dollars: number | null
          effects: Json | null
          height: string | null
          id: string
          image_url: string | null
          intelligence: number | null
          inventory: Json | null
          is_in_combat: boolean | null
          luck: number | null
          master_editing_id: string | null
          needs_celebration: boolean | null
          nichirin_color: string | null
          precision: number | null
          rank: string | null
          resistance: number | null
          skills: string[] | null
          stat_points_available: number | null
          strength: number | null
        }
        Insert: {
          age?: number | null
          agility?: number | null
          anomalies?: string[] | null
          aptitude?: number | null
          bloodline?: string | null
          breathing_lvl?: number | null
          breathing_style?: string | null
          char_name?: string | null
          charisma?: number | null
          class?: string | null
          current_hp?: number | null
          discord_username?: string | null
          dollars?: number | null
          effects?: Json | null
          height?: string | null
          id: string
          image_url?: string | null
          intelligence?: number | null
          inventory?: Json | null
          is_in_combat?: boolean | null
          luck?: number | null
          master_editing_id?: string | null
          needs_celebration?: boolean | null
          nichirin_color?: string | null
          precision?: number | null
          rank?: string | null
          resistance?: number | null
          skills?: string[] | null
          stat_points_available?: number | null
          strength?: number | null
        }
        Update: {
          age?: number | null
          agility?: number | null
          anomalies?: string[] | null
          aptitude?: number | null
          bloodline?: string | null
          breathing_lvl?: number | null
          breathing_style?: string | null
          char_name?: string | null
          charisma?: number | null
          class?: string | null
          current_hp?: number | null
          discord_username?: string | null
          dollars?: number | null
          effects?: Json | null
          height?: string | null
          id?: string
          image_url?: string | null
          intelligence?: number | null
          inventory?: Json | null
          is_in_combat?: boolean | null
          luck?: number | null
          master_editing_id?: string | null
          needs_celebration?: boolean | null
          nichirin_color?: string | null
          precision?: number | null
          rank?: string | null
          resistance?: number | null
          skills?: string[] | null
          stat_points_available?: number | null
          strength?: number | null
        }
        Relationships: []
      }
      global: {
        Row: {
          approved_once: boolean | null
          created_at: string | null
          current_turn: number | null
          id: number
          image_contrast: boolean | null
          image_title: string | null
          image_url: string | null
          is_combat_active: boolean | null
          is_session_active: boolean | null
          music_playing: boolean | null
          music_timestamp: number | null
          music_updated_at: string | null
          music_url: string | null
        }
        Insert: {
          approved_once?: boolean | null
          created_at?: string | null
          current_turn?: number | null
          id?: number
          image_contrast?: boolean | null
          image_title?: string | null
          image_url?: string | null
          is_combat_active?: boolean | null
          is_session_active?: boolean | null
          music_playing?: boolean | null
          music_timestamp?: number | null
          music_updated_at?: string | null
          music_url?: string | null
        }
        Update: {
          approved_once?: boolean | null
          created_at?: string | null
          current_turn?: number | null
          id?: number
          image_contrast?: boolean | null
          image_title?: string | null
          image_url?: string | null
          is_combat_active?: boolean | null
          is_session_active?: boolean | null
          music_playing?: boolean | null
          music_timestamp?: number | null
          music_updated_at?: string | null
          music_url?: string | null
        }
        Relationships: []
      }
      items: {
        Row: {
          category: string | null
          damageType: string | null
          description: string | null
          hands: string | null
          id: string
          isBackpack: boolean | null
          item_id: string | null
          name: string
          rarity: string
          subtype: string | null
          tier: number | null
          type: string | null
          upgrade: number | null
          value: number
        }
        Insert: {
          category?: string | null
          damageType?: string | null
          description?: string | null
          hands?: string | null
          id?: string
          isBackpack?: boolean | null
          item_id?: string | null
          name: string
          rarity: string
          subtype?: string | null
          tier?: number | null
          type?: string | null
          upgrade?: number | null
          value: number
        }
        Update: {
          category?: string | null
          damageType?: string | null
          description?: string | null
          hands?: string | null
          id?: string
          isBackpack?: boolean | null
          item_id?: string | null
          name?: string
          rarity?: string
          subtype?: string | null
          tier?: number | null
          type?: string | null
          upgrade?: number | null
          value?: number
        }
        Relationships: []
      }
      loot_history: {
        Row: {
          created_at: string
          id: number
          item_name: string | null
          player_name: string | null
          rarity: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          item_name?: string | null
          player_name?: string | null
          rarity?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          item_name?: string | null
          player_name?: string | null
          rarity?: string | null
        }
        Relationships: []
      }
      loot_tables: {
        Row: {
          created_at: string | null
          extra_roll_chance: number | null
          id: number
          items: Json | null
          max_extra_rolls: number | null
          max_rolls: number | null
          min_extra_rolls: number | null
          min_rolls: number | null
          name: string
        }
        Insert: {
          created_at?: string | null
          extra_roll_chance?: number | null
          id?: number
          items?: Json | null
          max_extra_rolls?: number | null
          max_rolls?: number | null
          min_extra_rolls?: number | null
          min_rolls?: number | null
          name: string
        }
        Update: {
          created_at?: string | null
          extra_roll_chance?: number | null
          id?: number
          items?: Json | null
          max_extra_rolls?: number | null
          max_rolls?: number | null
          min_extra_rolls?: number | null
          min_rolls?: number | null
          name?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_system: boolean | null
          player_name: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_system?: boolean | null
          player_name?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_system?: boolean | null
          player_name?: string | null
        }
        Relationships: []
      }
      npcs: {
        Row: {
          agility: number | null
          aptitude: number | null
          armed_pat: string | null
          category: string | null
          created_at: string
          id: string
          image_url: string | null
          is_visible: boolean | null
          name: string
          npc_id: string | null
          precision: number | null
          rank: string | null
          resistance: number | null
          strength: number | null
          type: string | null
        }
        Insert: {
          agility?: number | null
          aptitude?: number | null
          armed_pat?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_visible?: boolean | null
          name: string
          npc_id?: string | null
          precision?: number | null
          rank?: string | null
          resistance?: number | null
          strength?: number | null
          type?: string | null
        }
        Update: {
          agility?: number | null
          aptitude?: number | null
          armed_pat?: string | null
          category?: string | null
          created_at?: string
          id?: string
          image_url?: string | null
          is_visible?: boolean | null
          name?: string
          npc_id?: string | null
          precision?: number | null
          rank?: string | null
          resistance?: number | null
          strength?: number | null
          type?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      toggle_session: { Args: { status: boolean }; Returns: undefined }
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
