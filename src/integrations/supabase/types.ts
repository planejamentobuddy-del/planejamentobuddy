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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          start_date: string
          end_date: string
          created_at: string
          created_by: string | null
          admin_cost_total: number | null
          admin_cost_received: number | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          start_date: string
          end_date: string
          created_at?: string
          created_by?: string | null
          admin_cost_total?: number | null
          admin_cost_received?: number | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          start_date?: string
          end_date?: string
          created_at?: string
          created_by?: string | null
          admin_cost_total?: number | null
          admin_cost_received?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          parent_id: string | null
          name: string
          description: string | null
          start_date: string
          end_date: string
          duration: number
          percent_complete: number
          responsible: string | null
          predecessors: string[] | null
          has_restriction: boolean
          restriction_type: string | null
          status: string
          observations: string | null
          assignee_id: string | null
          checklists: Json | null
          created_at: string
          last_status: string | null
          last_status_date: string | null
          status_comments: Json | null
        }
        Insert: {
          id?: string
          project_id: string
          parent_id?: string | null
          name: string
          description?: string | null
          start_date: string
          end_date: string
          duration?: number
          percent_complete?: number
          responsible?: string | null
          predecessors?: string[] | null
          has_restriction?: boolean
          restriction_type?: string | null
          status?: string
          observations?: string | null
          assignee_id?: string | null
          checklists?: Json | null
          created_at?: string
          last_status?: string | null
          last_status_date?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          parent_id?: string | null
          name?: string
          description?: string | null
          start_date?: string
          end_date?: string
          duration?: number
          percent_complete?: number
          responsible?: string | null
          predecessors?: string[] | null
          has_restriction?: boolean
          restriction_type?: string | null
          status?: string
          observations?: string | null
          assignee_id?: string | null
          checklists?: Json | null
          created_at?: string
          last_status?: string | null
          last_status_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      weekly_plans: {
        Row: {
          id: string
          project_id: string
          task_id: string
          task_name: string
          responsible: string | null
          week: string
          week_label: string
          status: string
          reason: string | null
          observations: string | null
          created_at: string
          last_status: string | null
          last_status_date: string | null
          status_comments: Json | null
        }
        Insert: {
          id?: string
          project_id: string
          task_id: string
          task_name: string
          responsible?: string | null
          week: string
          week_label: string
          status?: string
          reason?: string | null
          observations?: string | null
          created_at?: string
          last_status?: string | null
          last_status_date?: string | null
          status_comments?: Json | null
        }
        Update: {
          id?: string
          project_id?: string
          task_id?: string
          task_name?: string
          responsible?: string | null
          week?: string
          week_label?: string
          status?: string
          reason?: string | null
          observations?: string | null
          created_at?: string
          last_status?: string | null
          last_status_date?: string | null
          status_comments?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plans_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_plans_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
      weekly_history: {
        Row: {
          id: string
          project_id: string
          week: string
          week_label: string
          planned: number
          completed: number
          ppc: number
          closed_at: string
        }
        Insert: {
          id?: string
          project_id: string
          week: string
          week_label: string
          planned: number
          completed: number
          ppc: number
          closed_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          week?: string
          week_label?: string
          planned?: number
          completed?: number
          ppc?: number
          closed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_history_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
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
      daily_logs: {
        Row: {
          id: string
          project_id: string
          date: string
          content: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          project_id: string
          date: string
          content: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          date?: string
          content?: string
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          }
        ]
      }
      constraints: {
        Row: {
          id: string
          project_id: string
          task_id: string | null
          description: string
          category: string
          status: string
          responsible: string | null
          due_date: string | null
          closed_at: string | null
          created_at: string
          created_by: string | null
          last_status: string | null
          last_status_date: string | null
        }
        Insert: {
          id?: string
          project_id: string
          task_id?: string | null
          description: string
          category: string
          status?: string
          responsible?: string | null
          due_date?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          last_status?: string | null
          last_status_date?: string | null
        }
        Update: {
          id?: string
          project_id?: string
          task_id?: string | null
          description?: string
          category?: string
          status?: string
          responsible?: string | null
          due_date?: string | null
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          last_status?: string | null
          last_status_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "constraints_project_id_fkey"
            columns: ["project_id"]
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constraints_task_id_fkey"
            columns: ["task_id"]
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_status: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_status"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      user_status: "pending" | "active" | "blocked"
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
      user_status: ["pending", "active", "blocked"],
    },
  },
} as const
