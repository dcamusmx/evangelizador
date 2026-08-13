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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      contenido_diario: {
        Row: {
          actualizado_por: string | null
          cita_evangelio: string | null
          created_at: string
          descripcion_base: string | null
          estado: Database["public"]["Enums"]["estado_contenido"]
          fecha: string
          fileid_pcloud: number | null
          link_facebook: string | null
          link_publico_pcloud: string | null
          link_youtube: string | null
          nombre_archivo_pcloud: string | null
          reflexion: string | null
          santo_o_tiempo_liturgico: string | null
          storage_content_type: string | null
          storage_etag: string | null
          storage_filename: string | null
          storage_key: string | null
          storage_provider: string | null
          storage_size: number | null
          storage_uploaded_at: string | null
          subido_por: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          actualizado_por?: string | null
          cita_evangelio?: string | null
          created_at?: string
          descripcion_base?: string | null
          estado?: Database["public"]["Enums"]["estado_contenido"]
          fecha: string
          fileid_pcloud?: number | null
          link_facebook?: string | null
          link_publico_pcloud?: string | null
          link_youtube?: string | null
          nombre_archivo_pcloud?: string | null
          reflexion?: string | null
          santo_o_tiempo_liturgico?: string | null
          storage_content_type?: string | null
          storage_etag?: string | null
          storage_filename?: string | null
          storage_key?: string | null
          storage_provider?: string | null
          storage_size?: number | null
          storage_uploaded_at?: string | null
          subido_por?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          actualizado_por?: string | null
          cita_evangelio?: string | null
          created_at?: string
          descripcion_base?: string | null
          estado?: Database["public"]["Enums"]["estado_contenido"]
          fecha?: string
          fileid_pcloud?: number | null
          link_facebook?: string | null
          link_publico_pcloud?: string | null
          link_youtube?: string | null
          nombre_archivo_pcloud?: string | null
          reflexion?: string | null
          santo_o_tiempo_liturgico?: string | null
          storage_content_type?: string | null
          storage_etag?: string | null
          storage_filename?: string | null
          storage_key?: string | null
          storage_provider?: string | null
          storage_size?: number | null
          storage_uploaded_at?: string | null
          subido_por?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      credenciales: {
        Row: {
          activo: boolean
          actualizado_por: string | null
          created_at: string
          descripcion: string | null
          id: string
          nombre: string
          pista: string | null
          servicio: string
          updated_at: string
          valor_cifrado: string
        }
        Insert: {
          activo?: boolean
          actualizado_por?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre: string
          pista?: string | null
          servicio: string
          updated_at?: string
          valor_cifrado: string
        }
        Update: {
          activo?: boolean
          actualizado_por?: string | null
          created_at?: string
          descripcion?: string | null
          id?: string
          nombre?: string
          pista?: string | null
          servicio?: string
          updated_at?: string
          valor_cifrado?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nombre: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nombre?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nombre?: string | null
          role?: Database["public"]["Enums"]["app_role"]
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
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "editor" | "pendiente"
      estado_contenido:
        | "pendiente_reflexion"
        | "pendiente_video"
        | "listo_para_publicar"
        | "programado"
        | "publicado"
        | "error"
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
      app_role: ["admin", "editor", "pendiente"],
      estado_contenido: [
        "pendiente_reflexion",
        "pendiente_video",
        "listo_para_publicar",
        "programado",
        "publicado",
        "error",
      ],
    },
  },
} as const
