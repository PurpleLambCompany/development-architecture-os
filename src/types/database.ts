export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      activity_log: {
        Row: {
          action_type: string;
          actor_user_id: string | null;
          created_at: string;
          engagement_id: string | null;
          entity_id: string | null;
          entity_type: string;
          id: number;
          metadata_json: NonNullable<Json>;
          organization_id: string | null;
        };
        Insert: {
          action_type: string;
          actor_user_id?: string | null;
          created_at?: string;
          engagement_id?: string | null;
          entity_id?: string | null;
          entity_type: string;
          id?: never;
          metadata_json?: NonNullable<Json>;
          organization_id?: string | null;
        };
        Update: {
          action_type?: string;
          actor_user_id?: string | null;
          created_at?: string;
          engagement_id?: string | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: never;
          metadata_json?: NonNullable<Json>;
          organization_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_log_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activity_log_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      engagement_member_capability_overrides: {
        Row: {
          capability: Database["public"]["Enums"]["engagement_capability"];
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          engagement_member_id: string;
          granted: boolean;
          id: string;
          reason: string;
          updated_at: string;
        };
        Insert: {
          capability: Database["public"]["Enums"]["engagement_capability"];
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          engagement_member_id: string;
          granted: boolean;
          id?: string;
          reason?: string;
          updated_at?: string;
        };
        Update: {
          capability?: Database["public"]["Enums"]["engagement_capability"];
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          engagement_member_id?: string;
          granted?: boolean;
          id?: string;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "engagement_member_capability_override_engagement_member_id_fkey";
            columns: ["engagement_member_id"];
            isOneToOne: false;
            referencedRelation: "engagement_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_member_capability_overrides_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_member_capability_overrides_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      engagement_members: {
        Row: {
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          side: Database["public"]["Enums"]["member_side"];
          status: Database["public"]["Enums"]["record_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          side: Database["public"]["Enums"]["member_side"];
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          side?: Database["public"]["Enums"]["member_side"];
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "engagement_members_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_members_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      engagements: {
        Row: {
          client_organization_id: string;
          created_at: string;
          created_by: string | null;
          current_phase: string;
          description: string;
          engagement_type: Database["public"]["Enums"]["engagement_type"];
          id: string;
          methodology_version: string;
          objective: string;
          slug: string;
          start_date: string | null;
          status: Database["public"]["Enums"]["engagement_status"];
          target_end_date: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          client_organization_id: string;
          created_at?: string;
          created_by?: string | null;
          current_phase?: string;
          description?: string;
          engagement_type: Database["public"]["Enums"]["engagement_type"];
          id?: string;
          methodology_version?: string;
          objective?: string;
          slug: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["engagement_status"];
          target_end_date?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          client_organization_id?: string;
          created_at?: string;
          created_by?: string | null;
          current_phase?: string;
          description?: string;
          engagement_type?: Database["public"]["Enums"]["engagement_type"];
          id?: string;
          methodology_version?: string;
          objective?: string;
          slug?: string;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["engagement_status"];
          target_end_date?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "engagements_client_organization_id_fkey";
            columns: ["client_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      method_assets: {
        Row: {
          category: string;
          created_at: string;
          created_by: string | null;
          description: string;
          id: string;
          ip_classification: Database["public"]["Enums"]["ip_classification"];
          methodology_domain: Database["public"]["Enums"]["architecture_domain"] | null;
          owner_user_id: string | null;
          status: string;
          title: string;
          updated_at: string;
          version: string;
        };
        Insert: {
          category: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          ip_classification?: Database["public"]["Enums"]["ip_classification"];
          methodology_domain?: Database["public"]["Enums"]["architecture_domain"] | null;
          owner_user_id?: string | null;
          status?: string;
          title: string;
          updated_at?: string;
          version?: string;
        };
        Update: {
          category?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          id?: string;
          ip_classification?: Database["public"]["Enums"]["ip_classification"];
          methodology_domain?: Database["public"]["Enums"]["architecture_domain"] | null;
          owner_user_id?: string | null;
          status?: string;
          title?: string;
          updated_at?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_assets_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          organization_id: string;
          role: Database["public"]["Enums"]["app_role"];
          status: Database["public"]["Enums"]["record_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id: string;
          role: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          slug: string;
          status: Database["public"]["Enums"]["record_status"];
          type: Database["public"]["Enums"]["organization_type"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          slug: string;
          status?: Database["public"]["Enums"]["record_status"];
          type: Database["public"]["Enums"]["organization_type"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["record_status"];
          type?: Database["public"]["Enums"]["organization_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          status: Database["public"]["Enums"]["record_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email: string;
          first_name?: string;
          id: string;
          last_name?: string;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string;
          first_name?: string;
          id?: string;
          last_name?: string;
          status?: Database["public"]["Enums"]["record_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      role_capability_defaults: {
        Row: {
          capability: Database["public"]["Enums"]["engagement_capability"];
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          capability: Database["public"]["Enums"]["engagement_capability"];
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          capability?: Database["public"]["Enums"]["engagement_capability"];
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: Record<PropertyKey, never>; Returns: undefined };
      capability_side: {
        Args: { capability: Database["public"]["Enums"]["engagement_capability"] };
        Returns: Database["public"]["Enums"]["member_side"];
      };
      is_financial_capability: {
        Args: { capability: Database["public"]["Enums"]["engagement_capability"] };
        Returns: boolean;
      };
      my_engagement_capabilities: {
        Args: { target_engagement_id: string };
        Returns: Database["public"]["Enums"]["engagement_capability"][];
      };
      role_side: {
        Args: { role: Database["public"]["Enums"]["app_role"] };
        Returns: Database["public"]["Enums"]["member_side"];
      };
    };
    Enums: {
      app_role:
        | "system_administrator"
        | "principal_architect"
        | "architect"
        | "researcher"
        | "project_administrator"
        | "finance_administrator"
        | "executive_sponsor"
        | "client_project_lead"
        | "client_finance"
        | "client_contributor"
        | "client_viewer";
      architecture_domain: "knowledge" | "capability" | "strategic_model" | "application";
      engagement_capability:
        | "view_financials"
        | "approve_change_orders"
        | "pay_invoices"
        | "approve_architecture"
        | "manage_client_team"
        | "view_confidential_deliverables";
      engagement_status: "proposed" | "active" | "paused" | "completed" | "archived";
      engagement_type:
        | "development_architecture_sprint"
        | "development_architecture_intensive"
        | "embedded_development_partner"
        | "cohort"
        | "custom";
      ip_classification:
        | "tplco_method_ip"
        | "client_confidential"
        | "client_owned_source_material"
        | "project_work_product"
        | "public_source"
        | "licensed_third_party_source"
        | "generated_analysis";
      member_side: "internal" | "client";
      organization_type: "tplco" | "client" | "licensed_practice";
      record_status: "active" | "invited" | "suspended" | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: [
        "system_administrator",
        "principal_architect",
        "architect",
        "researcher",
        "project_administrator",
        "finance_administrator",
        "executive_sponsor",
        "client_project_lead",
        "client_finance",
        "client_contributor",
        "client_viewer",
      ],
      architecture_domain: ["knowledge", "capability", "strategic_model", "application"],
      engagement_capability: [
        "view_financials",
        "approve_change_orders",
        "pay_invoices",
        "approve_architecture",
        "manage_client_team",
        "view_confidential_deliverables",
      ],
      engagement_status: ["proposed", "active", "paused", "completed", "archived"],
      engagement_type: [
        "development_architecture_sprint",
        "development_architecture_intensive",
        "embedded_development_partner",
        "cohort",
        "custom",
      ],
      ip_classification: [
        "tplco_method_ip",
        "client_confidential",
        "client_owned_source_material",
        "project_work_product",
        "public_source",
        "licensed_third_party_source",
        "generated_analysis",
      ],
      member_side: ["internal", "client"],
      organization_type: ["tplco", "client", "licensed_practice"],
      record_status: ["active", "invited", "suspended", "archived"],
    },
  },
} as const;
