export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      rk_project: {
        Row: {
          id: string;
          name: string;
          go_live_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          go_live_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          go_live_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rk_sections: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          color: string;
          position: number;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          color?: string;
          position: number;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          color?: string;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rk_sections_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "rk_project";
            referencedColumns: ["id"];
          },
        ];
      };
      rk_tasks: {
        Row: {
          id: string;
          project_id: string;
          section_id: string;
          activity: string;
          owner: string;
          plan_start: string;
          plan_duration: number;
          actual_start: string | null;
          actual_duration: number;
          percent_complete: number;
          position: number;
        };
        Insert: {
          id?: string;
          project_id: string;
          section_id: string;
          activity: string;
          owner?: string;
          plan_start: string;
          plan_duration: number;
          actual_start?: string | null;
          actual_duration?: number;
          percent_complete?: number;
          position: number;
        };
        Update: {
          id?: string;
          project_id?: string;
          section_id?: string;
          activity?: string;
          owner?: string;
          plan_start?: string;
          plan_duration?: number;
          actual_start?: string | null;
          actual_duration?: number;
          percent_complete?: number;
          position?: number;
        };
        Relationships: [
          {
            foreignKeyName: "rk_tasks_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "rk_project";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rk_tasks_section_id_fkey";
            columns: ["section_id"];
            isOneToOne: false;
            referencedRelation: "rk_sections";
            referencedColumns: ["id"];
          },
        ];
      };
      rk_team: {
        Row: {
          id: string;
          project_id: string;
          email: string;
          name: string;
          added_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          email: string;
          name?: string;
          added_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          email?: string;
          name?: string;
          added_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rk_team_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "rk_project";
            referencedColumns: ["id"];
          },
        ];
      };
      rk_stakeholders: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          role: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          role: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          name?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rk_stakeholders_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "rk_project";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type PublicSchema = Database[Extract<keyof Database, "public">];

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    ? (PublicSchema["Tables"] & PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof PublicSchema["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  PublicEnumNameOrOptions extends keyof PublicSchema["Enums"] | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never;
