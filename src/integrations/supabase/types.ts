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
      analytics_events: {
        Row: {
          artist: string | null
          category: string
          client: string
          created_at: string
          duration_ms: number | null
          event: string
          id: string
          meta: Json
          query: string | null
          reason: string | null
          result_count: number | null
          source: string | null
          status: string
          title: string | null
          track_id: string | null
          user_id: string | null
        }
        Insert: {
          artist?: string | null
          category: string
          client?: string
          created_at?: string
          duration_ms?: number | null
          event: string
          id?: string
          meta?: Json
          query?: string | null
          reason?: string | null
          result_count?: number | null
          source?: string | null
          status?: string
          title?: string | null
          track_id?: string | null
          user_id?: string | null
        }
        Update: {
          artist?: string | null
          category?: string
          client?: string
          created_at?: string
          duration_ms?: number | null
          event?: string
          id?: string
          meta?: Json
          query?: string | null
          reason?: string | null
          result_count?: number | null
          source?: string | null
          status?: string
          title?: string | null
          track_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      liked_songs: {
        Row: {
          artist: string
          artwork_url: string | null
          duration_sec: number
          liked_at: string
          source: string
          title: string
          track_id: string
          user_id: string
        }
        Insert: {
          artist: string
          artwork_url?: string | null
          duration_sec?: number
          liked_at?: string
          source: string
          title: string
          track_id: string
          user_id: string
        }
        Update: {
          artist?: string
          artwork_url?: string | null
          duration_sec?: number
          liked_at?: string
          source?: string
          title?: string
          track_id?: string
          user_id?: string
        }
        Relationships: []
      }
      listening_history: {
        Row: {
          artist: string
          artwork_url: string | null
          completed: boolean
          created_at: string
          duration_sec: number
          id: string
          played_at: string
          seconds_played: number
          source: string
          title: string
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artist: string
          artwork_url?: string | null
          completed?: boolean
          created_at?: string
          duration_sec?: number
          id?: string
          played_at?: string
          seconds_played?: number
          source: string
          title: string
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artist?: string
          artwork_url?: string | null
          completed?: boolean
          created_at?: string
          duration_sec?: number
          id?: string
          played_at?: string
          seconds_played?: number
          source?: string
          title?: string
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      playback_positions: {
        Row: {
          artist: string
          artwork_url: string | null
          created_at: string
          duration_sec: number
          position_sec: number
          source: string
          title: string
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artist: string
          artwork_url?: string | null
          created_at?: string
          duration_sec?: number
          position_sec?: number
          source: string
          title: string
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artist?: string
          artwork_url?: string | null
          created_at?: string
          duration_sec?: number
          position_sec?: number
          source?: string
          title?: string
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      playlist_collaborators: {
        Row: {
          created_at: string
          id: string
          playlist_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          playlist_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          playlist_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_collaborators_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_tracks: {
        Row: {
          added_at: string
          added_by: string | null
          artist: string
          artwork_url: string | null
          duration_sec: number
          id: string
          playlist_id: string
          position: number
          source: string
          source_external_id: string | null
          source_provider: string | null
          title: string
          track_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          artist: string
          artwork_url?: string | null
          duration_sec?: number
          id?: string
          playlist_id: string
          position?: number
          source: string
          source_external_id?: string | null
          source_provider?: string | null
          title: string
          track_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          artist?: string
          artwork_url?: string | null
          duration_sec?: number
          id?: string
          playlist_id?: string
          position?: number
          source?: string
          source_external_id?: string | null
          source_provider?: string | null
          title?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_collaborative: boolean
          is_hidden: boolean
          is_public: boolean
          moderated_at: string | null
          moderated_by: string | null
          moderation_note: string | null
          owner_id: string
          source_external_id: string | null
          source_provider: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_collaborative?: boolean
          is_hidden?: boolean
          is_public?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          owner_id: string
          source_external_id?: string | null
          source_provider?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_collaborative?: boolean
          is_hidden?: boolean
          is_public?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          moderation_note?: string | null
          owner_id?: string
          source_external_id?: string | null
          source_provider?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          suspended_at: string | null
          suspended_by: string | null
          suspended_until: string | null
          suspension_reason: string | null
          theme_preference: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          theme_preference?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          suspended_at?: string | null
          suspended_by?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          theme_preference?: string
        }
        Relationships: []
      }
      recently_played: {
        Row: {
          artist: string
          artwork_url: string | null
          duration_sec: number
          id: string
          played_at: string
          source: string
          title: string
          track_id: string
          user_id: string
        }
        Insert: {
          artist: string
          artwork_url?: string | null
          duration_sec?: number
          id?: string
          played_at?: string
          source: string
          title: string
          track_id: string
          user_id: string
        }
        Update: {
          artist?: string
          artwork_url?: string | null
          duration_sec?: number
          id?: string
          played_at?: string
          source?: string
          title?: string
          track_id?: string
          user_id?: string
        }
        Relationships: []
      }
      user_music_connections: {
        Row: {
          account_label: string | null
          created_at: string
          expires_at: string | null
          id: string
          last_synced_at: string | null
          provider: string
          scopes: string | null
          token_ciphertext: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_label?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider: string
          scopes?: string | null
          token_ciphertext: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_label?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          last_synced_at?: string | null
          provider?: string
          scopes?: string | null
          token_ciphertext?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      can_edit_playlist: {
        Args: { _playlist_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_playlist: {
        Args: { _playlist_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_suspended: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
