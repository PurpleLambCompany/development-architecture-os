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
      change_order_events: {
        Row: {
          actor_id: string | null;
          actor_side: Database["public"]["Enums"]["member_side"] | null;
          approval_source: Database["public"]["Enums"]["approval_source"] | null;
          change_order_id: string;
          contract_value_after_minor: number | null;
          contract_value_before_minor: number | null;
          engagement_id: string;
          from_status: Database["public"]["Enums"]["change_order_status"] | null;
          id: string;
          note: string | null;
          occurred_at: string;
          to_status: Database["public"]["Enums"]["change_order_status"];
        };
        Insert: {
          actor_id?: string | null;
          actor_side?: Database["public"]["Enums"]["member_side"] | null;
          approval_source?: Database["public"]["Enums"]["approval_source"] | null;
          change_order_id: string;
          contract_value_after_minor?: number | null;
          contract_value_before_minor?: number | null;
          engagement_id: string;
          from_status?: Database["public"]["Enums"]["change_order_status"] | null;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          to_status: Database["public"]["Enums"]["change_order_status"];
        };
        Update: {
          actor_id?: string | null;
          actor_side?: Database["public"]["Enums"]["member_side"] | null;
          approval_source?: Database["public"]["Enums"]["approval_source"] | null;
          change_order_id?: string;
          contract_value_after_minor?: number | null;
          contract_value_before_minor?: number | null;
          engagement_id?: string;
          from_status?: Database["public"]["Enums"]["change_order_status"] | null;
          id?: string;
          note?: string | null;
          occurred_at?: string;
          to_status?: Database["public"]["Enums"]["change_order_status"];
        };
        Relationships: [
          {
            foreignKeyName: "change_order_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "change_order_events_change_order_id_fkey";
            columns: ["change_order_id"];
            isOneToOne: false;
            referencedRelation: "change_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "change_order_events_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      change_orders: {
        Row: {
          amount_minor: number;
          approval_source: Database["public"]["Enums"]["approval_source"] | null;
          approved_by_user_id: string | null;
          contract_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          decided_at: string | null;
          decision_note: string | null;
          description: string;
          engagement_id: string;
          evidence_path: string | null;
          evidence_reference: string | null;
          external_approval_method: Database["public"]["Enums"]["external_approval_method"] | null;
          external_approved_on: string | null;
          external_approver_name: string | null;
          external_approver_title: string | null;
          id: string;
          number: number | null;
          recorded_at: string | null;
          recorded_by: string | null;
          schedule_impact: string;
          scope_impact: string;
          status: Database["public"]["Enums"]["change_order_status"];
          submitted_at: string | null;
          submitted_by: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          approval_source?: Database["public"]["Enums"]["approval_source"] | null;
          approved_by_user_id?: string | null;
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          decided_at?: string | null;
          decision_note?: string | null;
          description?: string;
          engagement_id: string;
          evidence_path?: string | null;
          evidence_reference?: string | null;
          external_approval_method?: Database["public"]["Enums"]["external_approval_method"] | null;
          external_approved_on?: string | null;
          external_approver_name?: string | null;
          external_approver_title?: string | null;
          id?: string;
          number?: number | null;
          recorded_at?: string | null;
          recorded_by?: string | null;
          schedule_impact?: string;
          scope_impact?: string;
          status?: Database["public"]["Enums"]["change_order_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          approval_source?: Database["public"]["Enums"]["approval_source"] | null;
          approved_by_user_id?: string | null;
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          decided_at?: string | null;
          decision_note?: string | null;
          description?: string;
          engagement_id?: string;
          evidence_path?: string | null;
          evidence_reference?: string | null;
          external_approval_method?: Database["public"]["Enums"]["external_approval_method"] | null;
          external_approved_on?: string | null;
          external_approver_name?: string | null;
          external_approver_title?: string | null;
          id?: string;
          number?: number | null;
          recorded_at?: string | null;
          recorded_by?: string | null;
          schedule_impact?: string;
          scope_impact?: string;
          status?: Database["public"]["Enums"]["change_order_status"];
          submitted_at?: string | null;
          submitted_by?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "change_orders_approved_by_user_id_fkey";
            columns: ["approved_by_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "change_orders_contract_fk";
            columns: ["contract_id", "engagement_id", "currency"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id", "engagement_id", "currency"];
          },
          {
            foreignKeyName: "change_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "change_orders_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "change_orders_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      contracts: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          client_signatory_name: string | null;
          client_signatory_title: string | null;
          created_at: string;
          created_by: string | null;
          currency: string;
          deposit_minor: number | null;
          document_path: string | null;
          effective_date: string | null;
          end_date: string | null;
          engagement_id: string;
          executed_on: string | null;
          id: string;
          notes: string;
          original_value_minor: number;
          payment_structure: Database["public"]["Enums"]["payment_structure"];
          payment_terms_days: number;
          start_date: string | null;
          status: Database["public"]["Enums"]["contract_status"];
          supersedes_contract_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          client_signatory_name?: string | null;
          client_signatory_title?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          deposit_minor?: number | null;
          document_path?: string | null;
          effective_date?: string | null;
          end_date?: string | null;
          engagement_id: string;
          executed_on?: string | null;
          id?: string;
          notes?: string;
          original_value_minor: number;
          payment_structure?: Database["public"]["Enums"]["payment_structure"];
          payment_terms_days?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["contract_status"];
          supersedes_contract_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          client_signatory_name?: string | null;
          client_signatory_title?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deposit_minor?: number | null;
          document_path?: string | null;
          effective_date?: string | null;
          end_date?: string | null;
          engagement_id?: string;
          executed_on?: string | null;
          id?: string;
          notes?: string;
          original_value_minor?: number;
          payment_structure?: Database["public"]["Enums"]["payment_structure"];
          payment_terms_days?: number;
          start_date?: string | null;
          status?: Database["public"]["Enums"]["contract_status"];
          supersedes_contract_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contracts_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_currency_fkey";
            columns: ["currency"];
            isOneToOne: false;
            referencedRelation: "currencies";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "contracts_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contracts_supersedes_contract_id_fkey";
            columns: ["supersedes_contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_notes: {
        Row: {
          amount_minor: number;
          contract_id: string;
          created_at: string;
          created_by: string | null;
          credit_note_number: string | null;
          currency: string;
          document_path: string | null;
          engagement_id: string;
          id: string;
          invoice_id: string;
          issue_date: string | null;
          issued_at: string | null;
          issued_by: string | null;
          reason: string;
          status: Database["public"]["Enums"]["credit_note_status"];
          updated_at: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          amount_minor: number;
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          credit_note_number?: string | null;
          currency: string;
          document_path?: string | null;
          engagement_id: string;
          id?: string;
          invoice_id: string;
          issue_date?: string | null;
          issued_at?: string | null;
          issued_by?: string | null;
          reason: string;
          status?: Database["public"]["Enums"]["credit_note_status"];
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_minor?: number;
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          credit_note_number?: string | null;
          currency?: string;
          document_path?: string | null;
          engagement_id?: string;
          id?: string;
          invoice_id?: string;
          issue_date?: string | null;
          issued_at?: string | null;
          issued_by?: string | null;
          reason?: string;
          status?: Database["public"]["Enums"]["credit_note_status"];
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "credit_notes_contract_fk";
            columns: ["contract_id", "engagement_id", "currency"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id", "engagement_id", "currency"];
          },
          {
            foreignKeyName: "credit_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_invoice_fk";
            columns: ["invoice_id", "contract_id", "currency"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id", "contract_id", "currency"];
          },
          {
            foreignKeyName: "credit_notes_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_voided_by_fkey";
            columns: ["voided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      currencies: {
        Row: {
          code: string;
          enabled: boolean;
          minor_unit_exponent: number;
          name: string;
        };
        Insert: {
          code: string;
          enabled?: boolean;
          minor_unit_exponent: number;
          name: string;
        };
        Update: {
          code?: string;
          enabled?: boolean;
          minor_unit_exponent?: number;
          name?: string;
        };
        Relationships: [];
      };
      document_number_counters: {
        Row: {
          last_value: number;
          series: string;
          year: number;
        };
        Insert: {
          last_value?: number;
          series: string;
          year: number;
        };
        Update: {
          last_value?: number;
          series?: string;
          year?: number;
        };
        Relationships: [];
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
      finance_notes: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          entity_id: string;
          entity_type: string;
          id: string;
        };
        Insert: {
          body: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          entity_id: string;
          entity_type: string;
          id?: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          entity_id?: string;
          entity_type?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "finance_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "finance_notes_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      financial_events: {
        Row: {
          actor_id: string | null;
          amount_minor: number | null;
          client_visible: boolean;
          contract_id: string | null;
          engagement_id: string;
          entity_id: string;
          entity_type: string;
          event_type: string;
          id: string;
          metadata: NonNullable<Json>;
          occurred_at: string;
          summary: string;
        };
        Insert: {
          actor_id?: string | null;
          amount_minor?: number | null;
          client_visible?: boolean;
          contract_id?: string | null;
          engagement_id: string;
          entity_id: string;
          entity_type: string;
          event_type: string;
          id?: string;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          summary?: string;
        };
        Update: {
          actor_id?: string | null;
          amount_minor?: number | null;
          client_visible?: boolean;
          contract_id?: string | null;
          engagement_id?: string;
          entity_id?: string;
          entity_type?: string;
          event_type?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          occurred_at?: string;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "financial_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_events_contract_id_fkey";
            columns: ["contract_id"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "financial_events_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      invoice_lines: {
        Row: {
          amount_minor: number;
          change_order_id: string | null;
          contract_id: string;
          created_at: string;
          description: string;
          engagement_id: string;
          id: string;
          invoice_id: string;
          payment_milestone_id: string | null;
          position: number;
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          change_order_id?: string | null;
          contract_id: string;
          created_at?: string;
          description: string;
          engagement_id: string;
          id?: string;
          invoice_id: string;
          payment_milestone_id?: string | null;
          position?: number;
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          change_order_id?: string | null;
          contract_id?: string;
          created_at?: string;
          description?: string;
          engagement_id?: string;
          id?: string;
          invoice_id?: string;
          payment_milestone_id?: string | null;
          position?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_lines_change_order_fk";
            columns: ["change_order_id", "contract_id"];
            isOneToOne: false;
            referencedRelation: "change_orders";
            referencedColumns: ["id", "contract_id"];
          },
          {
            foreignKeyName: "invoice_lines_invoice_fk";
            columns: ["invoice_id", "contract_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id", "contract_id"];
          },
          {
            foreignKeyName: "invoice_lines_milestone_fk";
            columns: ["payment_milestone_id", "contract_id"];
            isOneToOne: false;
            referencedRelation: "payment_milestones";
            referencedColumns: ["id", "contract_id"];
          },
        ];
      };
      invoice_payment_links: {
        Row: {
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          invoice_id: string;
          provider: string | null;
          provider_reference: string | null;
          updated_at: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          invoice_id: string;
          provider?: string | null;
          provider_reference?: string | null;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          invoice_id?: string;
          provider?: string | null;
          provider_reference?: string | null;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invoice_payment_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_payment_links_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoice_payment_links_invoice_id_fkey";
            columns: ["invoice_id"];
            isOneToOne: true;
            referencedRelation: "invoices";
            referencedColumns: ["id"];
          },
        ];
      };
      invoices: {
        Row: {
          contract_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          document_path: string | null;
          due_date: string | null;
          engagement_id: string;
          id: string;
          invoice_number: string | null;
          issue_date: string | null;
          issued_at: string | null;
          issued_by: string | null;
          memo: string;
          scheduled_issue_date: string | null;
          status: Database["public"]["Enums"]["invoice_status"];
          total_minor: number | null;
          updated_at: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          document_path?: string | null;
          due_date?: string | null;
          engagement_id: string;
          id?: string;
          invoice_number?: string | null;
          issue_date?: string | null;
          issued_at?: string | null;
          issued_by?: string | null;
          memo?: string;
          scheduled_issue_date?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          total_minor?: number | null;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          document_path?: string | null;
          due_date?: string | null;
          engagement_id?: string;
          id?: string;
          invoice_number?: string | null;
          issue_date?: string | null;
          issued_at?: string | null;
          issued_by?: string | null;
          memo?: string;
          scheduled_issue_date?: string | null;
          status?: Database["public"]["Enums"]["invoice_status"];
          total_minor?: number | null;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invoices_contract_fk";
            columns: ["contract_id", "engagement_id", "currency"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id", "engagement_id", "currency"];
          },
          {
            foreignKeyName: "invoices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invoices_voided_by_fkey";
            columns: ["voided_by"];
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
      payment_allocations: {
        Row: {
          amount_minor: number;
          contract_id: string;
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          id: string;
          invoice_id: string;
          payment_id: string;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
        };
        Insert: {
          amount_minor: number;
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          id?: string;
          invoice_id: string;
          payment_id: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
        };
        Update: {
          amount_minor?: number;
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          id?: string;
          invoice_id?: string;
          payment_id?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payment_allocations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_invoice_fk";
            columns: ["invoice_id", "contract_id"];
            isOneToOne: false;
            referencedRelation: "invoices";
            referencedColumns: ["id", "contract_id"];
          },
          {
            foreignKeyName: "payment_allocations_payment_fk";
            columns: ["payment_id", "contract_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id", "contract_id"];
          },
          {
            foreignKeyName: "payment_allocations_reversed_by_fkey";
            columns: ["reversed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_milestones: {
        Row: {
          amount_minor: number;
          contract_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          description: string;
          due_date: string | null;
          engagement_id: string;
          id: string;
          sequence: number;
          stage_label: string | null;
          status: Database["public"]["Enums"]["milestone_status"];
          title: string;
          trigger_type: Database["public"]["Enums"]["milestone_trigger"];
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          contract_id: string;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          description?: string;
          due_date?: string | null;
          engagement_id: string;
          id?: string;
          sequence: number;
          stage_label?: string | null;
          status?: Database["public"]["Enums"]["milestone_status"];
          title: string;
          trigger_type?: Database["public"]["Enums"]["milestone_trigger"];
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          contract_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          description?: string;
          due_date?: string | null;
          engagement_id?: string;
          id?: string;
          sequence?: number;
          stage_label?: string | null;
          status?: Database["public"]["Enums"]["milestone_status"];
          title?: string;
          trigger_type?: Database["public"]["Enums"]["milestone_trigger"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_milestones_contract_fk";
            columns: ["contract_id", "engagement_id", "currency"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id", "engagement_id", "currency"];
          },
          {
            foreignKeyName: "payment_milestones_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount_minor: number;
          contract_id: string;
          created_at: string;
          currency: string;
          engagement_id: string;
          external_payment_id: string | null;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          payer_name: string;
          processor: string | null;
          receipt_path: string | null;
          received_on: string;
          recorded_by: string | null;
          reference: string;
          reversal_reason: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
        };
        Insert: {
          amount_minor: number;
          contract_id: string;
          created_at?: string;
          currency: string;
          engagement_id: string;
          external_payment_id?: string | null;
          id?: string;
          method: Database["public"]["Enums"]["payment_method"];
          payer_name?: string;
          processor?: string | null;
          receipt_path?: string | null;
          received_on: string;
          recorded_by?: string | null;
          reference?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Update: {
          amount_minor?: number;
          contract_id?: string;
          created_at?: string;
          currency?: string;
          engagement_id?: string;
          external_payment_id?: string | null;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          payer_name?: string;
          processor?: string | null;
          receipt_path?: string | null;
          received_on?: string;
          recorded_by?: string | null;
          reference?: string;
          reversal_reason?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_contract_fk";
            columns: ["contract_id", "engagement_id", "currency"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id", "engagement_id", "currency"];
          },
          {
            foreignKeyName: "payments_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_reversed_by_fkey";
            columns: ["reversed_by"];
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
      refunds: {
        Row: {
          amount_minor: number;
          contract_id: string;
          created_at: string;
          currency: string;
          engagement_id: string;
          external_refund_id: string | null;
          id: string;
          method: Database["public"]["Enums"]["payment_method"];
          payment_id: string | null;
          processed_at: string;
          processed_by: string | null;
          processor: string | null;
          reason: string;
          reference: string;
          refunded_on: string;
          status: Database["public"]["Enums"]["refund_status"];
          updated_at: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        Insert: {
          amount_minor: number;
          contract_id: string;
          created_at?: string;
          currency: string;
          engagement_id: string;
          external_refund_id?: string | null;
          id?: string;
          method: Database["public"]["Enums"]["payment_method"];
          payment_id?: string | null;
          processed_at?: string;
          processed_by?: string | null;
          processor?: string | null;
          reason: string;
          reference?: string;
          refunded_on: string;
          status?: Database["public"]["Enums"]["refund_status"];
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          amount_minor?: number;
          contract_id?: string;
          created_at?: string;
          currency?: string;
          engagement_id?: string;
          external_refund_id?: string | null;
          id?: string;
          method?: Database["public"]["Enums"]["payment_method"];
          payment_id?: string | null;
          processed_at?: string;
          processed_by?: string | null;
          processor?: string | null;
          reason?: string;
          reference?: string;
          refunded_on?: string;
          status?: Database["public"]["Enums"]["refund_status"];
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "refunds_contract_fk";
            columns: ["contract_id", "engagement_id", "currency"];
            isOneToOne: false;
            referencedRelation: "contracts";
            referencedColumns: ["id", "engagement_id", "currency"];
          },
          {
            foreignKeyName: "refunds_payment_fk";
            columns: ["payment_id", "contract_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id", "contract_id"];
          },
          {
            foreignKeyName: "refunds_processed_by_fkey";
            columns: ["processed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "refunds_voided_by_fkey";
            columns: ["voided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      allocate_payment: {
        Args: { p_amount_minor: number; p_invoice_id: string; p_payment_id: string };
        Returns: string;
      };
      approve_change_order: { Args: { p_change_order_id: string }; Returns: undefined };
      capability_side: {
        Args: { capability: Database["public"]["Enums"]["engagement_capability"] };
        Returns: Database["public"]["Enums"]["member_side"];
      };
      contract_financial_summary: {
        Args: { p_as_of: string; p_contract_id: string };
        Returns: {
          approved_changes_minor: number;
          contract_id: string;
          contract_status: Database["public"]["Enums"]["contract_status"];
          credits_issued_minor: number;
          currency: string;
          currently_due_minor: number;
          engagement_id: string;
          gross_invoiced_minor: number;
          net_cash_received_minor: number;
          net_invoiced_minor: number;
          net_remaining_to_collect_minor: number;
          next_payment_amount_minor: number;
          next_payment_date: string;
          next_payment_id: string;
          next_payment_kind: string;
          next_payment_label: string;
          not_yet_due_minor: number;
          original_value_minor: number;
          outstanding_balance_minor: number;
          past_due_minor: number;
          payments_applied_minor: number;
          payments_received_minor: number;
          pending_changes_minor: number;
          refunds_minor: number;
          remaining_contract_balance_minor: number;
          remaining_to_invoice_minor: number;
          revised_value_minor: number;
          scheduled_minor: number;
          unapplied_credit_minor: number;
          unscheduled_minor: number;
        }[];
      };
      engagement_primary_contract_id: { Args: { p_engagement_id: string }; Returns: string };
      execute_contract: {
        Args: {
          p_client_signatory_name: string;
          p_client_signatory_title?: string;
          p_contract_id: string;
          p_executed_on: string;
        };
        Returns: undefined;
      };
      finance_engagement_directory: {
        Args: Record<PropertyKey, never>;
        Returns: {
          client_name: string;
          engagement_id: string;
          slug: string;
          start_date: string;
          status: Database["public"]["Enums"]["engagement_status"];
          target_end_date: string;
          title: string;
        }[];
      };
      invoice_balances: {
        Args: { p_as_of: string; p_engagement_id: string };
        Returns: {
          applied_minor: number;
          balance_minor: number;
          contract_id: string;
          credited_minor: number;
          days_overdue: number;
          due_date: string;
          invoice_id: string;
          invoice_number: string;
          issue_date: string;
          payment_state: string;
          status: Database["public"]["Enums"]["invoice_status"];
          total_minor: number;
        }[];
      };
      is_financial_capability: {
        Args: { capability: Database["public"]["Enums"]["engagement_capability"] };
        Returns: boolean;
      };
      issue_credit_note: {
        Args: { p_credit_note_id: string; p_issue_date: string };
        Returns: string;
      };
      issue_invoice: {
        Args: { p_due_date?: string; p_invoice_id: string; p_issue_date: string };
        Returns: string;
      };
      milestone_billing: {
        Args: { p_as_of: string; p_contract_id: string };
        Returns: {
          amount_minor: number;
          billed_minor: number;
          description: string;
          due_date: string;
          milestone_id: string;
          open_balance_minor: number;
          payment_state: string;
          sequence: number;
          stage_label: string;
          status: Database["public"]["Enums"]["milestone_status"];
          title: string;
          trigger_type: Database["public"]["Enums"]["milestone_trigger"];
        }[];
      };
      my_engagement_capabilities: {
        Args: { target_engagement_id: string };
        Returns: Database["public"]["Enums"]["engagement_capability"][];
      };
      pending_change_order_count: { Args: { p_engagement_id: string }; Returns: number };
      portfolio_financial_summary: {
        Args: { p_as_of: string };
        Returns: {
          client_name: string;
          engagement_id: string;
          engagement_slug: string;
          engagement_title: string;
          summary: Json;
        }[];
      };
      record_external_change_order_approval: {
        Args: {
          p_approved_on: string;
          p_approver_name: string;
          p_approver_title: string;
          p_change_order_id: string;
          p_evidence_path: string;
          p_evidence_reference: string;
          p_method: Database["public"]["Enums"]["external_approval_method"];
        };
        Returns: undefined;
      };
      record_payment: {
        Args: {
          p_allocations?: Json;
          p_amount_minor: number;
          p_contract_id: string;
          p_external_payment_id?: string;
          p_method: Database["public"]["Enums"]["payment_method"];
          p_payer_name?: string;
          p_processor?: string;
          p_receipt_path?: string;
          p_received_on: string;
          p_reference?: string;
        };
        Returns: string;
      };
      record_refund: {
        Args: {
          p_amount_minor: number;
          p_contract_id: string;
          p_external_refund_id?: string;
          p_method: Database["public"]["Enums"]["payment_method"];
          p_payment_id?: string;
          p_processor?: string;
          p_reason: string;
          p_reference?: string;
          p_refunded_on: string;
        };
        Returns: string;
      };
      reject_change_order: {
        Args: { p_change_order_id: string; p_note: string };
        Returns: undefined;
      };
      reverse_allocation: {
        Args: { p_allocation_id: string; p_reason: string };
        Returns: undefined;
      };
      reverse_payment: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined };
      role_side: {
        Args: { role: Database["public"]["Enums"]["app_role"] };
        Returns: Database["public"]["Enums"]["member_side"];
      };
      schedule_invoice: {
        Args: { p_invoice_id: string; p_scheduled_issue_date: string };
        Returns: undefined;
      };
      set_contract_status: {
        Args: { p_contract_id: string; p_status: Database["public"]["Enums"]["contract_status"] };
        Returns: undefined;
      };
      set_milestone_status: {
        Args: { p_milestone_id: string; p_status: Database["public"]["Enums"]["milestone_status"] };
        Returns: undefined;
      };
      submit_change_order: { Args: { p_change_order_id: string }; Returns: number };
      void_change_order: {
        Args: { p_change_order_id: string; p_note: string };
        Returns: undefined;
      };
      void_credit_note: {
        Args: { p_credit_note_id: string; p_reason: string };
        Returns: undefined;
      };
      void_invoice: { Args: { p_invoice_id: string; p_reason: string }; Returns: undefined };
      void_refund: { Args: { p_reason: string; p_refund_id: string }; Returns: undefined };
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
      approval_source: "client_portal" | "external_recorded_by_tplco";
      architecture_domain: "knowledge" | "capability" | "strategic_model" | "application";
      change_order_status: "draft" | "submitted" | "approved" | "rejected" | "void";
      contract_status:
        "draft" | "executed" | "active" | "completed" | "terminated" | "superseded" | "void";
      credit_note_status: "draft" | "issued" | "void";
      engagement_capability:
        | "view_financials"
        | "approve_change_orders"
        | "pay_invoices"
        | "approve_architecture"
        | "manage_client_team"
        | "view_confidential_deliverables"
        | "manage_financials";
      engagement_status: "proposed" | "active" | "paused" | "completed" | "archived";
      engagement_type:
        | "development_architecture_sprint"
        | "development_architecture_intensive"
        | "embedded_development_partner"
        | "cohort"
        | "custom";
      external_approval_method: "signed_document" | "email" | "letter" | "other";
      invoice_status: "draft" | "scheduled" | "issued" | "void";
      ip_classification:
        | "tplco_method_ip"
        | "client_confidential"
        | "client_owned_source_material"
        | "project_work_product"
        | "public_source"
        | "licensed_third_party_source"
        | "generated_analysis";
      member_side: "internal" | "client";
      milestone_status: "planned" | "ready_to_invoice" | "invoiced" | "cancelled";
      milestone_trigger: "on_signing" | "on_date" | "on_event" | "manual";
      organization_type: "tplco" | "client" | "licensed_practice";
      payment_method: "ach" | "wire" | "check" | "card_via_processor" | "other";
      payment_status: "recorded" | "reversed";
      payment_structure: "milestone" | "installments" | "percentage" | "retainer" | "custom";
      record_status: "active" | "invited" | "suspended" | "archived";
      refund_status: "completed" | "void";
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
      approval_source: ["client_portal", "external_recorded_by_tplco"],
      architecture_domain: ["knowledge", "capability", "strategic_model", "application"],
      change_order_status: ["draft", "submitted", "approved", "rejected", "void"],
      contract_status: [
        "draft",
        "executed",
        "active",
        "completed",
        "terminated",
        "superseded",
        "void",
      ],
      credit_note_status: ["draft", "issued", "void"],
      engagement_capability: [
        "view_financials",
        "approve_change_orders",
        "pay_invoices",
        "approve_architecture",
        "manage_client_team",
        "view_confidential_deliverables",
        "manage_financials",
      ],
      engagement_status: ["proposed", "active", "paused", "completed", "archived"],
      engagement_type: [
        "development_architecture_sprint",
        "development_architecture_intensive",
        "embedded_development_partner",
        "cohort",
        "custom",
      ],
      external_approval_method: ["signed_document", "email", "letter", "other"],
      invoice_status: ["draft", "scheduled", "issued", "void"],
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
      milestone_status: ["planned", "ready_to_invoice", "invoiced", "cancelled"],
      milestone_trigger: ["on_signing", "on_date", "on_event", "manual"],
      organization_type: ["tplco", "client", "licensed_practice"],
      payment_method: ["ach", "wire", "check", "card_via_processor", "other"],
      payment_status: ["recorded", "reversed"],
      payment_structure: ["milestone", "installments", "percentage", "retainer", "custom"],
      record_status: ["active", "invited", "suspended", "archived"],
      refund_status: ["completed", "void"],
    },
  },
} as const;
