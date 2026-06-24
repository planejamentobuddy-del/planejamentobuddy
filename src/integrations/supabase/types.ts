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
      constraints: {
        Row: {
          category: string
          closed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          last_status: string | null
          last_status_date: string | null
          project_id: string
          responsible: string | null
          status: string
          status_comments: Json | null
          task_id: string | null
        }
        Insert: {
          category: string
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          last_status?: string | null
          last_status_date?: string | null
          project_id: string
          responsible?: string | null
          status?: string
          status_comments?: Json | null
          task_id?: string | null
        }
        Update: {
          category?: string
          closed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          last_status?: string | null
          last_status_date?: string | null
          project_id?: string
          responsible?: string | null
          status?: string
          status_comments?: Json | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "constraints_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constraints_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          project_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          project_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_receipts: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          project_id: string
          received_at: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          project_id: string
          received_at?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          project_id?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_receipts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
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
      project_resources: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          monthly_cost: number | null
          name: string
          project_id: string
          role: string | null
          status: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          monthly_cost?: number | null
          name: string
          project_id: string
          role?: string | null
          status?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          monthly_cost?: number | null
          name?: string
          project_id?: string
          role?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_resources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          admin_cost_received: number | null
          admin_cost_total: number | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          id: string
          name: string
          start_date: string
          status: string
        }
        Insert: {
          admin_cost_received?: number | null
          admin_cost_total?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          id?: string
          name: string
          start_date: string
          status?: string
        }
        Update: {
          admin_cost_received?: number | null
          admin_cost_total?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          id?: string
          name?: string
          start_date?: string
          status?: string
        }
        Relationships: []
      }
      supply_packages: {
        Row: {
          actual_delivery_date: string | null
          created_at: string
          created_by: string | null
          estimated_value: number | null
          expected_delivery_date: string | null
          id: string
          is_critical: boolean
          lead_time_days: number
          name: string
          notes: string | null
          order_date: string | null
          order_deadline: string | null
          project_id: string
          quantitative_done_date: string | null
          status: string
          supplier: string | null
          task_id: string | null
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          expected_delivery_date?: string | null
          id?: string
          is_critical?: boolean
          lead_time_days?: number
          name: string
          notes?: string | null
          order_date?: string | null
          order_deadline?: string | null
          project_id: string
          quantitative_done_date?: string | null
          status?: string
          supplier?: string | null
          task_id?: string | null
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string
          created_by?: string | null
          estimated_value?: number | null
          expected_delivery_date?: string | null
          id?: string
          is_critical?: boolean
          lead_time_days?: number
          name?: string
          notes?: string | null
          order_date?: string | null
          order_deadline?: string | null
          project_id?: string
          quantitative_done_date?: string | null
          status?: string
          supplier?: string | null
          task_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_packages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_packages_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_reschedules: {
        Row: {
          id: string
          is_cascade: boolean
          new_end: string
          new_start: string
          previous_end: string
          previous_start: string
          project_id: string
          reason_category: string
          reason_detail: string | null
          rescheduled_at: string
          rescheduled_by: string | null
          rescheduled_by_name: string | null
          task_id: string
        }
        Insert: {
          id?: string
          is_cascade?: boolean
          new_end: string
          new_start: string
          previous_end: string
          previous_start: string
          project_id: string
          reason_category: string
          reason_detail?: string | null
          rescheduled_at?: string
          rescheduled_by?: string | null
          rescheduled_by_name?: string | null
          task_id: string
        }
        Update: {
          id?: string
          is_cascade?: boolean
          new_end?: string
          new_start?: string
          previous_end?: string
          previous_start?: string
          project_id?: string
          reason_category?: string
          reason_detail?: string | null
          rescheduled_at?: string
          rescheduled_by?: string | null
          rescheduled_by_name?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_reschedules_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_reschedules_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          checklists: Json | null
          created_at: string
          current_end: string | null
          current_start: string | null
          description: string | null
          discipline: string | null
          duration: number | null
          end_date: string
          frentes: Json | null
          frentes_mode: string
          has_restriction: boolean | null
          id: string
          last_status: string | null
          last_status_date: string | null
          location: string | null
          name: string
          observations: string | null
          order_index: number | null
          parent_id: string | null
          percent_complete: number | null
          planned_end: string | null
          planned_start: string | null
          predecessors: string[] | null
          progress: number
          project_id: string
          reschedule_count: number
          reschedules: Json
          responsible: string | null
          restriction_type: string | null
          start_date: string
          status: string
          status_comments: Json | null
        }
        Insert: {
          assignee_id?: string | null
          checklists?: Json | null
          created_at?: string
          current_end?: string | null
          current_start?: string | null
          description?: string | null
          discipline?: string | null
          duration?: number | null
          end_date: string
          frentes?: Json | null
          frentes_mode?: string
          has_restriction?: boolean | null
          id?: string
          last_status?: string | null
          last_status_date?: string | null
          location?: string | null
          name: string
          observations?: string | null
          order_index?: number | null
          parent_id?: string | null
          percent_complete?: number | null
          planned_end?: string | null
          planned_start?: string | null
          predecessors?: string[] | null
          progress?: number
          project_id: string
          reschedule_count?: number
          reschedules?: Json
          responsible?: string | null
          restriction_type?: string | null
          start_date: string
          status?: string
          status_comments?: Json | null
        }
        Update: {
          assignee_id?: string | null
          checklists?: Json | null
          created_at?: string
          current_end?: string | null
          current_start?: string | null
          description?: string | null
          discipline?: string | null
          duration?: number | null
          end_date?: string
          frentes?: Json | null
          frentes_mode?: string
          has_restriction?: boolean | null
          id?: string
          last_status?: string | null
          last_status_date?: string | null
          location?: string | null
          name?: string
          observations?: string | null
          order_index?: number | null
          parent_id?: string | null
          percent_complete?: number | null
          planned_end?: string | null
          planned_start?: string | null
          predecessors?: string[] | null
          progress?: number
          project_id?: string
          reschedule_count?: number
          reschedules?: Json
          responsible?: string | null
          restriction_type?: string | null
          start_date?: string
          status?: string
          status_comments?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      weekly_history: {
        Row: {
          closed_at: string
          completed: number
          id: string
          planned: number
          ppc: number
          project_id: string
          week: string
          week_label: string
        }
        Insert: {
          closed_at?: string
          completed: number
          id?: string
          planned: number
          ppc: number
          project_id: string
          week: string
          week_label: string
        }
        Update: {
          closed_at?: string
          completed?: number
          id?: string
          planned?: number
          ppc?: number
          project_id?: string
          week?: string
          week_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_plans: {
        Row: {
          created_at: string
          id: string
          last_status: string | null
          last_status_date: string | null
          observations: string | null
          project_id: string
          reason: string | null
          responsible: string | null
          status: string
          status_comments: Json | null
          task_id: string | null
          task_name: string
          week: string
          week_label: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_status?: string | null
          last_status_date?: string | null
          observations?: string | null
          project_id: string
          reason?: string | null
          responsible?: string | null
          status?: string
          status_comments?: Json | null
          task_id?: string | null
          task_name: string
          week: string
          week_label: string
        }
        Update: {
          created_at?: string
          id?: string
          last_status?: string | null
          last_status_date?: string | null
          observations?: string | null
          project_id?: string
          reason?: string | null
          responsible?: string | null
          status?: string
          status_comments?: Json | null
          task_id?: string | null
          task_name?: string
          week?: string
          week_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_plans_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_entries: {
        Row: {
          activity: string | null
          created_at: string
          id: string
          month: string
          notes: string | null
          own_workers: number
          phase: string
          project_id: string
          third_party_workers: number
        }
        Insert: {
          activity?: string | null
          created_at?: string
          id?: string
          month: string
          notes?: string | null
          own_workers?: number
          phase: string
          project_id: string
          third_party_workers?: number
        }
        Update: {
          activity?: string | null
          created_at?: string
          id?: string
          month?: string
          notes?: string | null
          own_workers?: number
          phase?: string
          project_id?: string
          third_party_workers?: number
        }
        Relationships: [
          {
            foreignKeyName: "workforce_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
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
      update_tasks: { Args: { updates: Json }; Returns: undefined }
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
