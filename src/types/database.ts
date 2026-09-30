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
      architecture_approvals: {
        Row: {
          approval_source: Database["public"]["Enums"]["approval_source"] | null;
          baseline_id: string | null;
          comment: string | null;
          element_version_id: string | null;
          engagement_id: string;
          external_approval_method:
            Database["public"]["Enums"]["architecture_approval_method"] | null;
          external_approved_on: string | null;
          external_approver_name: string | null;
          external_approver_title: string | null;
          external_evidence: string | null;
          id: string;
          recorded_at: string | null;
          recorded_by: string | null;
          request_note: string;
          requested_at: string;
          requested_by: string | null;
          responded_at: string | null;
          responded_by: string | null;
          response: Database["public"]["Enums"]["approval_response"] | null;
        };
        Insert: {
          approval_source?: Database["public"]["Enums"]["approval_source"] | null;
          baseline_id?: string | null;
          comment?: string | null;
          element_version_id?: string | null;
          engagement_id: string;
          external_approval_method?:
            Database["public"]["Enums"]["architecture_approval_method"] | null;
          external_approved_on?: string | null;
          external_approver_name?: string | null;
          external_approver_title?: string | null;
          external_evidence?: string | null;
          id?: string;
          recorded_at?: string | null;
          recorded_by?: string | null;
          request_note?: string;
          requested_at?: string;
          requested_by?: string | null;
          responded_at?: string | null;
          responded_by?: string | null;
          response?: Database["public"]["Enums"]["approval_response"] | null;
        };
        Update: {
          approval_source?: Database["public"]["Enums"]["approval_source"] | null;
          baseline_id?: string | null;
          comment?: string | null;
          element_version_id?: string | null;
          engagement_id?: string;
          external_approval_method?:
            Database["public"]["Enums"]["architecture_approval_method"] | null;
          external_approved_on?: string | null;
          external_approver_name?: string | null;
          external_approver_title?: string | null;
          external_evidence?: string | null;
          id?: string;
          recorded_at?: string | null;
          recorded_by?: string | null;
          request_note?: string;
          requested_at?: string;
          requested_by?: string | null;
          responded_at?: string | null;
          responded_by?: string | null;
          response?: Database["public"]["Enums"]["approval_response"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_approvals_baseline_fk";
            columns: ["baseline_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_baselines";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_approvals_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_approvals_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_approvals_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_approvals_responded_by_fkey";
            columns: ["responded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_approvals_version_fk";
            columns: ["element_version_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "element_versions";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      architecture_baseline_assessments: {
        Row: {
          baseline_id: string;
          domain_assessment_id: string;
          engagement_id: string;
        };
        Insert: {
          baseline_id: string;
          domain_assessment_id: string;
          engagement_id: string;
        };
        Update: {
          baseline_id?: string;
          domain_assessment_id?: string;
          engagement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_baseline_assessments_assessment_fk";
            columns: ["domain_assessment_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "domain_assessments";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_baseline_assessments_baseline_fk";
            columns: ["baseline_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_baselines";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      architecture_baseline_items: {
        Row: {
          baseline_id: string;
          element_id: string;
          element_version_id: string;
          engagement_id: string;
        };
        Insert: {
          baseline_id: string;
          element_id: string;
          element_version_id: string;
          engagement_id: string;
        };
        Update: {
          baseline_id?: string;
          element_id?: string;
          element_version_id?: string;
          engagement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_baseline_items_baseline_fk";
            columns: ["baseline_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_baselines";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_baseline_items_version_engagement_fk";
            columns: ["element_version_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "element_versions";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_baseline_items_version_fk";
            columns: ["element_version_id", "element_id"];
            isOneToOne: false;
            referencedRelation: "element_versions";
            referencedColumns: ["id", "element_id"];
          },
        ];
      };
      architecture_baseline_relationships: {
        Row: {
          baseline_id: string;
          engagement_id: string;
          relationship_id: string;
        };
        Insert: {
          baseline_id: string;
          engagement_id: string;
          relationship_id: string;
        };
        Update: {
          baseline_id?: string;
          engagement_id?: string;
          relationship_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_baseline_relationships_baseline_fk";
            columns: ["baseline_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_baselines";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_baseline_relationships_relationship_fk";
            columns: ["relationship_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_relationships";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      architecture_baselines: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string;
          engagement_id: string;
          frozen_at: string | null;
          frozen_by: string | null;
          id: string;
          label: string;
          status: Database["public"]["Enums"]["baseline_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          engagement_id: string;
          frozen_at?: string | null;
          frozen_by?: string | null;
          id?: string;
          label: string;
          status?: Database["public"]["Enums"]["baseline_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string;
          engagement_id?: string;
          frozen_at?: string | null;
          frozen_by?: string | null;
          id?: string;
          label?: string;
          status?: Database["public"]["Enums"]["baseline_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_baselines_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_baselines_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_baselines_frozen_by_fkey";
            columns: ["frozen_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      architecture_elements: {
        Row: {
          ai_review_state: Database["public"]["Enums"]["ai_review_state"];
          ai_reviewed_at: string | null;
          ai_reviewed_by: string | null;
          client_visibility: Database["public"]["Enums"]["client_visibility"];
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          engagement_wide: boolean;
          id: string;
          ip_classification: Database["public"]["Enums"]["ip_classification"];
          kind: Database["public"]["Enums"]["element_kind"];
          latest_version_id: string | null;
          lifecycle: Database["public"]["Enums"]["element_lifecycle"];
          methodology_version: string;
          owner_user_id: string | null;
          provenance: Database["public"]["Enums"]["provenance_type"];
          reference_code: string | null;
          retired_at: string | null;
          retirement_reason: string | null;
          source_reference: string;
          summary: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          ai_review_state?: Database["public"]["Enums"]["ai_review_state"];
          ai_reviewed_at?: string | null;
          ai_reviewed_by?: string | null;
          client_visibility?: Database["public"]["Enums"]["client_visibility"];
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          engagement_wide?: boolean;
          id?: string;
          ip_classification?: Database["public"]["Enums"]["ip_classification"];
          kind: Database["public"]["Enums"]["element_kind"];
          latest_version_id?: string | null;
          lifecycle?: Database["public"]["Enums"]["element_lifecycle"];
          methodology_version?: string;
          owner_user_id?: string | null;
          provenance: Database["public"]["Enums"]["provenance_type"];
          reference_code?: string | null;
          retired_at?: string | null;
          retirement_reason?: string | null;
          source_reference?: string;
          summary?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          ai_review_state?: Database["public"]["Enums"]["ai_review_state"];
          ai_reviewed_at?: string | null;
          ai_reviewed_by?: string | null;
          client_visibility?: Database["public"]["Enums"]["client_visibility"];
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          engagement_wide?: boolean;
          id?: string;
          ip_classification?: Database["public"]["Enums"]["ip_classification"];
          kind?: Database["public"]["Enums"]["element_kind"];
          latest_version_id?: string | null;
          lifecycle?: Database["public"]["Enums"]["element_lifecycle"];
          methodology_version?: string;
          owner_user_id?: string | null;
          provenance?: Database["public"]["Enums"]["provenance_type"];
          reference_code?: string | null;
          retired_at?: string | null;
          retirement_reason?: string | null;
          source_reference?: string;
          summary?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_elements_ai_reviewed_by_fkey";
            columns: ["ai_reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_elements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_elements_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_elements_latest_version_fk";
            columns: ["latest_version_id", "id"];
            isOneToOne: false;
            referencedRelation: "element_versions";
            referencedColumns: ["id", "element_id"];
          },
          {
            foreignKeyName: "architecture_elements_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_elements_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      architecture_object_types: {
        Row: {
          attribute_schema_version: number;
          definition: string;
          domain: Database["public"]["Enums"]["architecture_domain"];
          key: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          attribute_schema_version?: number;
          definition: string;
          domain: Database["public"]["Enums"]["architecture_domain"];
          key: string;
          label: string;
          sort_order: number;
        };
        Update: {
          attribute_schema_version?: number;
          definition?: string;
          domain?: Database["public"]["Enums"]["architecture_domain"];
          key?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      architecture_objects: {
        Row: {
          attributes: NonNullable<Json>;
          domain: Database["public"]["Enums"]["architecture_domain"];
          element_id: string;
          engagement_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          maturity: Database["public"]["Enums"]["maturity_state"];
          maturity_rationale: string;
          object_type: string;
        };
        Insert: {
          attributes?: NonNullable<Json>;
          domain: Database["public"]["Enums"]["architecture_domain"];
          element_id: string;
          engagement_id: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          maturity?: Database["public"]["Enums"]["maturity_state"];
          maturity_rationale?: string;
          object_type: string;
        };
        Update: {
          attributes?: NonNullable<Json>;
          domain?: Database["public"]["Enums"]["architecture_domain"];
          element_id?: string;
          engagement_id?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          maturity?: Database["public"]["Enums"]["maturity_state"];
          maturity_rationale?: string;
          object_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_objects_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
          },
          {
            foreignKeyName: "architecture_objects_type_fk";
            columns: ["domain", "object_type"];
            isOneToOne: false;
            referencedRelation: "architecture_object_types";
            referencedColumns: ["domain", "key"];
          },
        ];
      };
      architecture_reference_counters: {
        Row: {
          engagement_id: string;
          last_value: number;
          prefix: string;
        };
        Insert: {
          engagement_id: string;
          last_value: number;
          prefix: string;
        };
        Update: {
          engagement_id?: string;
          last_value?: number;
          prefix?: string;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_reference_counters_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      architecture_relationships: {
        Row: {
          client_visibility: Database["public"]["Enums"]["client_visibility"];
          created_at: string;
          created_by: string | null;
          description: string;
          engagement_id: string;
          id: string;
          provenance: Database["public"]["Enums"]["provenance_type"];
          published_at: string | null;
          published_by: string | null;
          relationship_type: string;
          required_proficiency: Database["public"]["Enums"]["skill_proficiency"] | null;
          retired_at: string | null;
          retired_by: string | null;
          retirement_reason: string | null;
          source_element_id: string;
          source_reference: string;
          target_element_id: string;
          updated_at: string;
        };
        Insert: {
          client_visibility?: Database["public"]["Enums"]["client_visibility"];
          created_at?: string;
          created_by?: string | null;
          description?: string;
          engagement_id: string;
          id?: string;
          provenance: Database["public"]["Enums"]["provenance_type"];
          published_at?: string | null;
          published_by?: string | null;
          relationship_type: string;
          required_proficiency?: Database["public"]["Enums"]["skill_proficiency"] | null;
          retired_at?: string | null;
          retired_by?: string | null;
          retirement_reason?: string | null;
          source_element_id: string;
          source_reference?: string;
          target_element_id: string;
          updated_at?: string;
        };
        Update: {
          client_visibility?: Database["public"]["Enums"]["client_visibility"];
          created_at?: string;
          created_by?: string | null;
          description?: string;
          engagement_id?: string;
          id?: string;
          provenance?: Database["public"]["Enums"]["provenance_type"];
          published_at?: string | null;
          published_by?: string | null;
          relationship_type?: string;
          required_proficiency?: Database["public"]["Enums"]["skill_proficiency"] | null;
          retired_at?: string | null;
          retired_by?: string | null;
          retirement_reason?: string | null;
          source_element_id?: string;
          source_reference?: string;
          target_element_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_relationships_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_relationships_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_relationships_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_relationships_relationship_type_fkey";
            columns: ["relationship_type"];
            isOneToOne: false;
            referencedRelation: "relationship_types";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "architecture_relationships_retired_by_fkey";
            columns: ["retired_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_relationships_source_fk";
            columns: ["source_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_relationships_target_fk";
            columns: ["target_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      architecture_statements: {
        Row: {
          ai_review_state: Database["public"]["Enums"]["ai_review_state"];
          ai_reviewed_at: string | null;
          ai_reviewed_by: string | null;
          body: string;
          client_visible: boolean;
          created_at: string;
          created_by: string | null;
          element_id: string;
          engagement_id: string;
          id: string;
          provenance: Database["public"]["Enums"]["provenance_type"];
          sort_order: number;
          source_reference: string;
          statement_kind: Database["public"]["Enums"]["statement_kind"];
          updated_at: string;
        };
        Insert: {
          ai_review_state?: Database["public"]["Enums"]["ai_review_state"];
          ai_reviewed_at?: string | null;
          ai_reviewed_by?: string | null;
          body: string;
          client_visible?: boolean;
          created_at?: string;
          created_by?: string | null;
          element_id: string;
          engagement_id: string;
          id?: string;
          provenance: Database["public"]["Enums"]["provenance_type"];
          sort_order?: number;
          source_reference?: string;
          statement_kind: Database["public"]["Enums"]["statement_kind"];
          updated_at?: string;
        };
        Update: {
          ai_review_state?: Database["public"]["Enums"]["ai_review_state"];
          ai_reviewed_at?: string | null;
          ai_reviewed_by?: string | null;
          body?: string;
          client_visible?: boolean;
          created_at?: string;
          created_by?: string | null;
          element_id?: string;
          engagement_id?: string;
          id?: string;
          provenance?: Database["public"]["Enums"]["provenance_type"];
          sort_order?: number;
          source_reference?: string;
          statement_kind?: Database["public"]["Enums"]["statement_kind"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_statements_ai_reviewed_by_fkey";
            columns: ["ai_reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_statements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_statements_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      assumptions: {
        Row: {
          category: string;
          confidence: Database["public"]["Enums"]["confidence_level"];
          element_id: string;
          engagement_id: string;
          impact_if_false: string;
          kind: Database["public"]["Enums"]["element_kind"];
          validation_note: string;
          validation_status: Database["public"]["Enums"]["validation_status"];
        };
        Insert: {
          category?: string;
          confidence?: Database["public"]["Enums"]["confidence_level"];
          element_id: string;
          engagement_id: string;
          impact_if_false?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          validation_note?: string;
          validation_status?: Database["public"]["Enums"]["validation_status"];
        };
        Update: {
          category?: string;
          confidence?: Database["public"]["Enums"]["confidence_level"];
          element_id?: string;
          engagement_id?: string;
          impact_if_false?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          validation_note?: string;
          validation_status?: Database["public"]["Enums"]["validation_status"];
        };
        Relationships: [
          {
            foreignKeyName: "assumptions_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
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
      constraints: {
        Row: {
          category: Database["public"]["Enums"]["constraint_category"];
          constraint_status: Database["public"]["Enums"]["constraint_status"];
          element_id: string;
          engagement_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          negotiable: boolean;
          source: string;
        };
        Insert: {
          category?: Database["public"]["Enums"]["constraint_category"];
          constraint_status?: Database["public"]["Enums"]["constraint_status"];
          element_id: string;
          engagement_id: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          negotiable?: boolean;
          source?: string;
        };
        Update: {
          category?: Database["public"]["Enums"]["constraint_category"];
          constraint_status?: Database["public"]["Enums"]["constraint_status"];
          element_id?: string;
          engagement_id?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          negotiable?: boolean;
          source?: string;
        };
        Relationships: [
          {
            foreignKeyName: "constraints_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
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
      decision_options: {
        Row: {
          created_at: string;
          created_by: string | null;
          decision_element_id: string;
          description: string;
          engagement_id: string;
          id: string;
          sort_order: number;
          title: string;
          tradeoffs: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          decision_element_id: string;
          description?: string;
          engagement_id: string;
          id?: string;
          sort_order?: number;
          title: string;
          tradeoffs?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          decision_element_id?: string;
          description?: string;
          engagement_id?: string;
          id?: string;
          sort_order?: number;
          title?: string;
          tradeoffs?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "decision_options_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decision_options_decision_fk";
            columns: ["decision_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "decisions";
            referencedColumns: ["element_id", "engagement_id"];
          },
        ];
      };
      decisions: {
        Row: {
          chosen_option_id: string | null;
          context: string;
          decided_at: string | null;
          decided_by: string | null;
          decision_note: string | null;
          decision_owner_user_id: string | null;
          decision_source: Database["public"]["Enums"]["approval_source"] | null;
          decision_status: Database["public"]["Enums"]["decision_status"];
          deferred_reason: string | null;
          downstream_impact: string;
          element_id: string;
          engagement_id: string;
          external_decided_on: string | null;
          external_decider_name: string | null;
          external_decision_method:
            Database["public"]["Enums"]["architecture_approval_method"] | null;
          external_evidence: string | null;
          kind: Database["public"]["Enums"]["element_kind"];
          needed_by: string | null;
          outcome_provenance: Database["public"]["Enums"]["provenance_type"] | null;
          recommendation_rationale: string | null;
          recommended_at: string | null;
          recommended_by: string | null;
          recommended_option_id: string | null;
          recorded_at: string | null;
          recorded_by: string | null;
        };
        Insert: {
          chosen_option_id?: string | null;
          context?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          decision_owner_user_id?: string | null;
          decision_source?: Database["public"]["Enums"]["approval_source"] | null;
          decision_status?: Database["public"]["Enums"]["decision_status"];
          deferred_reason?: string | null;
          downstream_impact?: string;
          element_id: string;
          engagement_id: string;
          external_decided_on?: string | null;
          external_decider_name?: string | null;
          external_decision_method?:
            Database["public"]["Enums"]["architecture_approval_method"] | null;
          external_evidence?: string | null;
          kind?: Database["public"]["Enums"]["element_kind"];
          needed_by?: string | null;
          outcome_provenance?: Database["public"]["Enums"]["provenance_type"] | null;
          recommendation_rationale?: string | null;
          recommended_at?: string | null;
          recommended_by?: string | null;
          recommended_option_id?: string | null;
          recorded_at?: string | null;
          recorded_by?: string | null;
        };
        Update: {
          chosen_option_id?: string | null;
          context?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decision_note?: string | null;
          decision_owner_user_id?: string | null;
          decision_source?: Database["public"]["Enums"]["approval_source"] | null;
          decision_status?: Database["public"]["Enums"]["decision_status"];
          deferred_reason?: string | null;
          downstream_impact?: string;
          element_id?: string;
          engagement_id?: string;
          external_decided_on?: string | null;
          external_decider_name?: string | null;
          external_decision_method?:
            Database["public"]["Enums"]["architecture_approval_method"] | null;
          external_evidence?: string | null;
          kind?: Database["public"]["Enums"]["element_kind"];
          needed_by?: string | null;
          outcome_provenance?: Database["public"]["Enums"]["provenance_type"] | null;
          recommendation_rationale?: string | null;
          recommended_at?: string | null;
          recommended_by?: string | null;
          recommended_option_id?: string | null;
          recorded_at?: string | null;
          recorded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "decisions_chosen_option_fk";
            columns: ["chosen_option_id", "element_id"];
            isOneToOne: false;
            referencedRelation: "decision_options";
            referencedColumns: ["id", "decision_element_id"];
          },
          {
            foreignKeyName: "decisions_decided_by_fkey";
            columns: ["decided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decisions_decision_owner_user_id_fkey";
            columns: ["decision_owner_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decisions_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
          },
          {
            foreignKeyName: "decisions_recommended_by_fkey";
            columns: ["recommended_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "decisions_recommended_option_fk";
            columns: ["recommended_option_id", "element_id"];
            isOneToOne: false;
            referencedRelation: "decision_options";
            referencedColumns: ["id", "decision_element_id"];
          },
          {
            foreignKeyName: "decisions_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      dependencies: {
        Row: {
          blocking: boolean;
          dependency_status: Database["public"]["Enums"]["dependency_status"];
          dependency_type: Database["public"]["Enums"]["dependency_type"];
          element_id: string;
          engagement_id: string;
          from_element_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          to_element_id: string;
        };
        Insert: {
          blocking?: boolean;
          dependency_status?: Database["public"]["Enums"]["dependency_status"];
          dependency_type?: Database["public"]["Enums"]["dependency_type"];
          element_id: string;
          engagement_id: string;
          from_element_id: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          to_element_id: string;
        };
        Update: {
          blocking?: boolean;
          dependency_status?: Database["public"]["Enums"]["dependency_status"];
          dependency_type?: Database["public"]["Enums"]["dependency_type"];
          element_id?: string;
          engagement_id?: string;
          from_element_id?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          to_element_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dependencies_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
          },
          {
            foreignKeyName: "dependencies_from_fk";
            columns: ["from_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "dependencies_to_fk";
            columns: ["to_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
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
      domain_assessments: {
        Row: {
          assessed_at: string;
          assessed_by: string | null;
          client_visible: boolean;
          domain: Database["public"]["Enums"]["architecture_domain"];
          engagement_id: string;
          id: string;
          maturity: Database["public"]["Enums"]["maturity_state"];
          provenance: Database["public"]["Enums"]["provenance_type"];
          rationale: string;
        };
        Insert: {
          assessed_at?: string;
          assessed_by?: string | null;
          client_visible?: boolean;
          domain: Database["public"]["Enums"]["architecture_domain"];
          engagement_id: string;
          id?: string;
          maturity: Database["public"]["Enums"]["maturity_state"];
          provenance?: Database["public"]["Enums"]["provenance_type"];
          rationale: string;
        };
        Update: {
          assessed_at?: string;
          assessed_by?: string | null;
          client_visible?: boolean;
          domain?: Database["public"]["Enums"]["architecture_domain"];
          engagement_id?: string;
          id?: string;
          maturity?: Database["public"]["Enums"]["maturity_state"];
          provenance?: Database["public"]["Enums"]["provenance_type"];
          rationale?: string;
        };
        Relationships: [
          {
            foreignKeyName: "domain_assessments_assessed_by_fkey";
            columns: ["assessed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "domain_assessments_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      element_evidence_links: {
        Row: {
          created_at: string;
          created_by: string | null;
          element_id: string;
          engagement_id: string;
          evidence_source_id: string;
          id: string;
          locator: string;
          note: string;
          stance: Database["public"]["Enums"]["evidence_stance"];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          element_id: string;
          engagement_id: string;
          evidence_source_id: string;
          id?: string;
          locator?: string;
          note?: string;
          stance?: Database["public"]["Enums"]["evidence_stance"];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          element_id?: string;
          engagement_id?: string;
          evidence_source_id?: string;
          id?: string;
          locator?: string;
          note?: string;
          stance?: Database["public"]["Enums"]["evidence_stance"];
        };
        Relationships: [
          {
            foreignKeyName: "element_evidence_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "element_evidence_links_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "element_evidence_links_source_fk";
            columns: ["evidence_source_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "evidence_sources";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      element_method_lineage: {
        Row: {
          created_at: string;
          created_by: string | null;
          element_id: string;
          engagement_id: string;
          id: string;
          method_asset_id: string;
          method_version: string;
          note: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          element_id: string;
          engagement_id: string;
          id?: string;
          method_asset_id: string;
          method_version?: string;
          note?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          element_id?: string;
          engagement_id?: string;
          id?: string;
          method_asset_id?: string;
          method_version?: string;
          note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "element_method_lineage_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "element_method_lineage_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "element_method_lineage_method_asset_id_fkey";
            columns: ["method_asset_id"];
            isOneToOne: false;
            referencedRelation: "method_assets";
            referencedColumns: ["id"];
          },
        ];
      };
      element_versions: {
        Row: {
          change_summary: string;
          client_snapshot: NonNullable<Json>;
          client_visible_at_publication: boolean;
          element_id: string;
          engagement_id: string;
          id: string;
          methodology_version: string;
          published_at: string;
          published_by: string | null;
          snapshot: NonNullable<Json>;
          version_no: number;
        };
        Insert: {
          change_summary?: string;
          client_snapshot: NonNullable<Json>;
          client_visible_at_publication: boolean;
          element_id: string;
          engagement_id: string;
          id?: string;
          methodology_version?: string;
          published_at?: string;
          published_by?: string | null;
          snapshot: NonNullable<Json>;
          version_no: number;
        };
        Update: {
          change_summary?: string;
          client_snapshot?: NonNullable<Json>;
          client_visible_at_publication?: boolean;
          element_id?: string;
          engagement_id?: string;
          id?: string;
          methodology_version?: string;
          published_at?: string;
          published_by?: string | null;
          snapshot?: NonNullable<Json>;
          version_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: "element_versions_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "element_versions_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      evidence_sources: {
        Row: {
          accessed_date: string | null;
          client_visibility: Database["public"]["Enums"]["client_visibility"];
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          external_reference: string;
          id: string;
          ip_classification: Database["public"]["Enums"]["ip_classification"];
          notes: string;
          provenance: Database["public"]["Enums"]["provenance_type"];
          publisher_author: string;
          reference: string;
          source_date: string | null;
          source_type: Database["public"]["Enums"]["evidence_source_type"];
          summary: string;
          title: string;
          updated_at: string;
          url: string | null;
        };
        Insert: {
          accessed_date?: string | null;
          client_visibility?: Database["public"]["Enums"]["client_visibility"];
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          external_reference?: string;
          id?: string;
          ip_classification?: Database["public"]["Enums"]["ip_classification"];
          notes?: string;
          provenance: Database["public"]["Enums"]["provenance_type"];
          publisher_author?: string;
          reference?: string;
          source_date?: string | null;
          source_type: Database["public"]["Enums"]["evidence_source_type"];
          summary?: string;
          title: string;
          updated_at?: string;
          url?: string | null;
        };
        Update: {
          accessed_date?: string | null;
          client_visibility?: Database["public"]["Enums"]["client_visibility"];
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          external_reference?: string;
          id?: string;
          ip_classification?: Database["public"]["Enums"]["ip_classification"];
          notes?: string;
          provenance?: Database["public"]["Enums"]["provenance_type"];
          publisher_author?: string;
          reference?: string;
          source_date?: string | null;
          source_type?: Database["public"]["Enums"]["evidence_source_type"];
          summary?: string;
          title?: string;
          updated_at?: string;
          url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_sources_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "evidence_sources_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
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
      intelligence_record_domains: {
        Row: {
          created_at: string;
          created_by: string | null;
          domain: Database["public"]["Enums"]["architecture_domain"];
          element_id: string;
          engagement_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          domain: Database["public"]["Enums"]["architecture_domain"];
          element_id: string;
          engagement_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          domain?: Database["public"]["Enums"]["architecture_domain"];
          element_id?: string;
          engagement_id?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_record_domains_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_record_domains_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
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
      recommendations: {
        Row: {
          element_id: string;
          engagement_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          priority: Database["public"]["Enums"]["recommendation_priority"];
          rationale: string;
        };
        Insert: {
          element_id: string;
          engagement_id: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          priority?: Database["public"]["Enums"]["recommendation_priority"];
          rationale?: string;
        };
        Update: {
          element_id?: string;
          engagement_id?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          priority?: Database["public"]["Enums"]["recommendation_priority"];
          rationale?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recommendations_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
          },
        ];
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
      relationship_rules: {
        Row: {
          id: number;
          relationship_type: string;
          source_kind: Database["public"]["Enums"]["element_kind"];
          source_object_type: string | null;
          target_kind: Database["public"]["Enums"]["element_kind"];
          target_object_type: string | null;
        };
        Insert: {
          id?: never;
          relationship_type: string;
          source_kind: Database["public"]["Enums"]["element_kind"];
          source_object_type?: string | null;
          target_kind: Database["public"]["Enums"]["element_kind"];
          target_object_type?: string | null;
        };
        Update: {
          id?: never;
          relationship_type?: string;
          source_kind?: Database["public"]["Enums"]["element_kind"];
          source_object_type?: string | null;
          target_kind?: Database["public"]["Enums"]["element_kind"];
          target_object_type?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "relationship_rules_relationship_type_fkey";
            columns: ["relationship_type"];
            isOneToOne: false;
            referencedRelation: "relationship_types";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "relationship_rules_source_object_type_fkey";
            columns: ["source_object_type"];
            isOneToOne: false;
            referencedRelation: "architecture_object_types";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "relationship_rules_target_object_type_fkey";
            columns: ["target_object_type"];
            isOneToOne: false;
            referencedRelation: "architecture_object_types";
            referencedColumns: ["key"];
          },
        ];
      };
      relationship_types: {
        Row: {
          category: string;
          definition: string;
          inverse_label: string;
          is_acyclic: boolean;
          is_symmetric: boolean;
          key: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          category: string;
          definition: string;
          inverse_label: string;
          is_acyclic?: boolean;
          is_symmetric?: boolean;
          key: string;
          label: string;
          sort_order: number;
        };
        Update: {
          category?: string;
          definition?: string;
          inverse_label?: string;
          is_acyclic?: boolean;
          is_symmetric?: boolean;
          key?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      risks: {
        Row: {
          category: string;
          element_id: string;
          engagement_id: string;
          impact: number;
          kind: Database["public"]["Enums"]["element_kind"];
          mitigation: string;
          probability: number;
          risk_status: Database["public"]["Enums"]["risk_status"];
          severity: number | null;
        };
        Insert: {
          category?: string;
          element_id: string;
          engagement_id: string;
          impact?: number;
          kind?: Database["public"]["Enums"]["element_kind"];
          mitigation?: string;
          probability?: number;
          risk_status?: Database["public"]["Enums"]["risk_status"];
          severity?: never;
        };
        Update: {
          category?: string;
          element_id?: string;
          engagement_id?: string;
          impact?: number;
          kind?: Database["public"]["Enums"]["element_kind"];
          mitigation?: string;
          probability?: number;
          risk_status?: Database["public"]["Enums"]["risk_status"];
          severity?: never;
        };
        Relationships: [
          {
            foreignKeyName: "risks_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
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
      statement_evidence_links: {
        Row: {
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          evidence_source_id: string;
          id: string;
          locator: string;
          note: string;
          stance: Database["public"]["Enums"]["evidence_stance"];
          statement_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          evidence_source_id: string;
          id?: string;
          locator?: string;
          note?: string;
          stance?: Database["public"]["Enums"]["evidence_stance"];
          statement_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          evidence_source_id?: string;
          id?: string;
          locator?: string;
          note?: string;
          stance?: Database["public"]["Enums"]["evidence_stance"];
          statement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "statement_evidence_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "statement_evidence_links_source_fk";
            columns: ["evidence_source_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "evidence_sources";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "statement_evidence_links_statement_fk";
            columns: ["statement_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_statements";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
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
      architecture_domain_states: {
        Args: { p_engagement_id: string };
        Returns: {
          assessed_at: string;
          assessed_by: string;
          assessment_id: string;
          client_visible: boolean;
          domain: Database["public"]["Enums"]["architecture_domain"];
          maturity: Database["public"]["Enums"]["maturity_state"];
          rationale: string;
        }[];
      };
      capability_side: {
        Args: { capability: Database["public"]["Enums"]["engagement_capability"] };
        Returns: Database["public"]["Enums"]["member_side"];
      };
      client_architecture: {
        Args: { p_engagement_id: string };
        Returns: {
          approval_id: string;
          approval_state: string;
          change_summary: string;
          client_snapshot: Json;
          domain: Database["public"]["Enums"]["architecture_domain"];
          element_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          latest_approved_version_no: number;
          object_type: string;
          published_at: string;
          reference_code: string;
          title: string;
          version_id: string;
          version_no: number;
        }[];
      };
      client_architecture_relationships: {
        Args: { p_engagement_id: string };
        Returns: {
          description: string;
          id: string;
          provenance: Database["public"]["Enums"]["provenance_type"];
          published_at: string;
          relationship_type: string;
          required_proficiency: Database["public"]["Enums"]["skill_proficiency"];
          source_element_id: string;
          target_element_id: string;
        }[];
      };
      client_decisions: {
        Args: { p_engagement_id: string };
        Returns: {
          chosen_option_id: string;
          context: string;
          decided_at: string;
          decided_by_name: string;
          decision_note: string;
          decision_source: Database["public"]["Enums"]["approval_source"];
          decision_status: Database["public"]["Enums"]["decision_status"];
          element_id: string;
          needed_by: string;
          options: Json;
          recommendation_rationale: string;
          recommended_option_id: string;
          reference_code: string;
          title: string;
          version_id: string;
        }[];
      };
      client_element_versions: {
        Args: { p_element_id: string };
        Returns: {
          approval_id: string;
          approval_source: Database["public"]["Enums"]["approval_source"];
          approval_state: string;
          change_summary: string;
          client_snapshot: Json;
          published_at: string;
          responded_at: string;
          response_comment: string;
          version_id: string;
          version_no: number;
        }[];
      };
      compare_baselines: {
        Args: { p_from_baseline_id: string; p_to_baseline_id?: string };
        Returns: {
          change: string;
          domain: Database["public"]["Enums"]["architecture_domain"];
          element_id: string;
          from_maturity: Database["public"]["Enums"]["maturity_state"];
          from_version_id: string;
          from_version_no: number;
          reference_code: string;
          relationship_id: string;
          relationship_type: string;
          subject: string;
          title: string;
          to_maturity: Database["public"]["Enums"]["maturity_state"];
          to_version_id: string;
          to_version_no: number;
        }[];
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
      create_architecture_element: {
        Args: {
          p_details?: Json;
          p_domains?: Database["public"]["Enums"]["architecture_domain"][];
          p_element: Json;
          p_engagement_id: string;
          p_kind: Database["public"]["Enums"]["element_kind"];
        };
        Returns: string;
      };
      decide_decision: {
        Args: { p_decision_id: string; p_note?: string; p_option_id: string };
        Returns: undefined;
      };
      defer_decision: { Args: { p_decision_id: string; p_reason: string }; Returns: undefined };
      element_reference_prefix: {
        Args: {
          p_domain: Database["public"]["Enums"]["architecture_domain"];
          p_kind: Database["public"]["Enums"]["element_kind"];
        };
        Returns: string;
      };
      element_version_snapshot: { Args: { p_version_id: string }; Returns: Json };
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
      freeze_baseline: { Args: { p_baseline_id: string }; Returns: undefined };
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
      object_maturity_distribution: {
        Args: { p_engagement_id: string };
        Returns: {
          domain: Database["public"]["Enums"]["architecture_domain"];
          maturity: Database["public"]["Enums"]["maturity_state"];
          object_count: number;
        }[];
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
      preview_client_snapshot: { Args: { p_element_id: string }; Returns: Json };
      publish_element_version: {
        Args: { p_change_summary?: string; p_element_id: string };
        Returns: string;
      };
      record_domain_assessment: {
        Args: {
          p_client_visible?: boolean;
          p_domain: Database["public"]["Enums"]["architecture_domain"];
          p_engagement_id: string;
          p_maturity: Database["public"]["Enums"]["maturity_state"];
          p_rationale: string;
        };
        Returns: string;
      };
      record_external_architecture_approval: {
        Args: {
          p_approved_on: string;
          p_approver_name: string;
          p_approver_title: string;
          p_baseline_id: string;
          p_comment?: string;
          p_element_version_id: string;
          p_evidence: string;
          p_method: Database["public"]["Enums"]["architecture_approval_method"];
          p_response: Database["public"]["Enums"]["approval_response"];
        };
        Returns: string;
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
      record_external_decision: {
        Args: {
          p_decided_on: string;
          p_decider_name: string;
          p_decision_id: string;
          p_evidence: string;
          p_method: Database["public"]["Enums"]["architecture_approval_method"];
          p_note?: string;
          p_option_id: string;
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
      request_architecture_approval: {
        Args: { p_baseline_id: string; p_element_version_id: string; p_note?: string };
        Returns: string;
      };
      respond_to_architecture_approval: {
        Args: {
          p_approval_id: string;
          p_comment?: string;
          p_response: Database["public"]["Enums"]["approval_response"];
        };
        Returns: undefined;
      };
      retire_element: { Args: { p_element_id: string; p_reason: string }; Returns: undefined };
      retire_relationship: {
        Args: { p_reason: string; p_relationship_id: string };
        Returns: undefined;
      };
      return_element_to_draft: {
        Args: { p_element_id: string; p_note: string };
        Returns: undefined;
      };
      reverse_allocation: {
        Args: { p_allocation_id: string; p_reason: string };
        Returns: undefined;
      };
      reverse_payment: { Args: { p_payment_id: string; p_reason: string }; Returns: undefined };
      review_ai_content: {
        Args: { p_accept: boolean; p_element_id: string; p_statement_id: string };
        Returns: undefined;
      };
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
      set_decision_recommendation: {
        Args: { p_decision_id: string; p_option_id: string; p_rationale: string };
        Returns: undefined;
      };
      set_milestone_status: {
        Args: { p_milestone_id: string; p_status: Database["public"]["Enums"]["milestone_status"] };
        Returns: undefined;
      };
      submit_change_order: { Args: { p_change_order_id: string }; Returns: number };
      submit_element_for_review: { Args: { p_element_id: string }; Returns: undefined };
      supersede_element: {
        Args: { p_new_element_id: string; p_old_element_id: string; p_reason: string };
        Returns: string;
      };
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
      ai_review_state: "not_applicable" | "pending" | "accepted" | "rejected";
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
      approval_response: "approved" | "changes_requested";
      approval_source: "client_portal" | "external_recorded_by_tplco";
      architecture_approval_method: "meeting" | "email" | "signed_document" | "other";
      architecture_domain: "knowledge" | "capability" | "strategic_model" | "application";
      baseline_status: "draft" | "frozen";
      change_order_status: "draft" | "submitted" | "approved" | "rejected" | "void";
      client_visibility: "internal" | "client";
      confidence_level: "low" | "medium" | "high";
      constraint_category:
        | "regulatory"
        | "financial"
        | "physical"
        | "contractual"
        | "political"
        | "temporal"
        | "other";
      constraint_status: "in_force" | "relaxed" | "lifted";
      contract_status:
        "draft" | "executed" | "active" | "completed" | "terminated" | "superseded" | "void";
      credit_note_status: "draft" | "issued" | "void";
      decision_status: "open" | "recommended" | "decided" | "deferred" | "superseded";
      dependency_status: "open" | "satisfied" | "at_risk" | "broken";
      dependency_type: "prerequisite" | "sequence" | "input" | "funding" | "external";
      element_kind:
        | "object"
        | "assumption"
        | "risk"
        | "constraint"
        | "dependency"
        | "decision"
        | "recommendation";
      element_lifecycle: "draft" | "in_review" | "published" | "superseded" | "retired";
      engagement_capability:
        | "view_financials"
        | "approve_change_orders"
        | "pay_invoices"
        | "approve_architecture"
        | "manage_client_team"
        | "view_confidential_deliverables"
        | "manage_financials"
        | "edit_architecture"
        | "publish_architecture"
        | "view_architecture";
      engagement_status: "proposed" | "active" | "paused" | "completed" | "archived";
      engagement_type:
        | "development_architecture_sprint"
        | "development_architecture_intensive"
        | "embedded_development_partner"
        | "cohort"
        | "custom";
      evidence_source_type:
        | "document"
        | "interview"
        | "meeting_notes"
        | "dataset"
        | "publication"
        | "regulation"
        | "web"
        | "internal_analysis"
        | "other";
      evidence_stance: "supports" | "contradicts" | "context";
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
      maturity_state: "undefined" | "emerging" | "defined" | "structured" | "operationalized";
      member_side: "internal" | "client";
      milestone_status: "planned" | "ready_to_invoice" | "invoiced" | "cancelled";
      milestone_trigger: "on_signing" | "on_date" | "on_event" | "manual";
      organization_type: "tplco" | "client" | "licensed_practice";
      payment_method: "ach" | "wire" | "check" | "card_via_processor" | "other";
      payment_status: "recorded" | "reversed";
      payment_structure: "milestone" | "installments" | "percentage" | "retainer" | "custom";
      provenance_type:
        | "client_source"
        | "public_source"
        | "architect_observation"
        | "architect_judgment"
        | "client_decision"
        | "ai_analysis"
        | "methodology_derived"
        | "system_derived";
      recommendation_priority: "critical" | "important" | "advisable";
      record_status: "active" | "invited" | "suspended" | "archived";
      refund_status: "completed" | "void";
      risk_status: "open" | "mitigating" | "accepted" | "closed";
      skill_proficiency: "foundational" | "proficient" | "expert";
      statement_kind:
        "finding" | "observation" | "rationale" | "implication" | "definition" | "note";
      validation_status: "unvalidated" | "validating" | "validated" | "invalidated";
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
      ai_review_state: ["not_applicable", "pending", "accepted", "rejected"],
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
      approval_response: ["approved", "changes_requested"],
      approval_source: ["client_portal", "external_recorded_by_tplco"],
      architecture_approval_method: ["meeting", "email", "signed_document", "other"],
      architecture_domain: ["knowledge", "capability", "strategic_model", "application"],
      baseline_status: ["draft", "frozen"],
      change_order_status: ["draft", "submitted", "approved", "rejected", "void"],
      client_visibility: ["internal", "client"],
      confidence_level: ["low", "medium", "high"],
      constraint_category: [
        "regulatory",
        "financial",
        "physical",
        "contractual",
        "political",
        "temporal",
        "other",
      ],
      constraint_status: ["in_force", "relaxed", "lifted"],
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
      decision_status: ["open", "recommended", "decided", "deferred", "superseded"],
      dependency_status: ["open", "satisfied", "at_risk", "broken"],
      dependency_type: ["prerequisite", "sequence", "input", "funding", "external"],
      element_kind: [
        "object",
        "assumption",
        "risk",
        "constraint",
        "dependency",
        "decision",
        "recommendation",
      ],
      element_lifecycle: ["draft", "in_review", "published", "superseded", "retired"],
      engagement_capability: [
        "view_financials",
        "approve_change_orders",
        "pay_invoices",
        "approve_architecture",
        "manage_client_team",
        "view_confidential_deliverables",
        "manage_financials",
        "edit_architecture",
        "publish_architecture",
        "view_architecture",
      ],
      engagement_status: ["proposed", "active", "paused", "completed", "archived"],
      engagement_type: [
        "development_architecture_sprint",
        "development_architecture_intensive",
        "embedded_development_partner",
        "cohort",
        "custom",
      ],
      evidence_source_type: [
        "document",
        "interview",
        "meeting_notes",
        "dataset",
        "publication",
        "regulation",
        "web",
        "internal_analysis",
        "other",
      ],
      evidence_stance: ["supports", "contradicts", "context"],
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
      maturity_state: ["undefined", "emerging", "defined", "structured", "operationalized"],
      member_side: ["internal", "client"],
      milestone_status: ["planned", "ready_to_invoice", "invoiced", "cancelled"],
      milestone_trigger: ["on_signing", "on_date", "on_event", "manual"],
      organization_type: ["tplco", "client", "licensed_practice"],
      payment_method: ["ach", "wire", "check", "card_via_processor", "other"],
      payment_status: ["recorded", "reversed"],
      payment_structure: ["milestone", "installments", "percentage", "retainer", "custom"],
      provenance_type: [
        "client_source",
        "public_source",
        "architect_observation",
        "architect_judgment",
        "client_decision",
        "ai_analysis",
        "methodology_derived",
        "system_derived",
      ],
      recommendation_priority: ["critical", "important", "advisable"],
      record_status: ["active", "invited", "suspended", "archived"],
      refund_status: ["completed", "void"],
      risk_status: ["open", "mitigating", "accepted", "closed"],
      skill_proficiency: ["foundational", "proficient", "expert"],
      statement_kind: ["finding", "observation", "rationale", "implication", "definition", "note"],
      validation_status: ["unvalidated", "validating", "validated", "invalidated"],
    },
  },
} as const;
