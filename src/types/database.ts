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
      acceptance_criteria: {
        Row: {
          agreed_on: string | null;
          agreed_recorded_at: string | null;
          agreed_recorded_by: string | null;
          agreed_with: string | null;
          agreement_evidence_source_id: string | null;
          body: string;
          client_visible: boolean;
          closed_at: string | null;
          closure_reason: string | null;
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          governed_element_id: string;
          governed_kind: Database["public"]["Enums"]["element_kind"];
          id: string;
          informing_criterion_key: string | null;
          informing_standard_version_id: string | null;
          reference_code: string;
          state: Database["public"]["Enums"]["acceptance_criterion_state"];
          supersedes_criterion_id: string | null;
          updated_at: string;
        };
        Insert: {
          agreed_on?: string | null;
          agreed_recorded_at?: string | null;
          agreed_recorded_by?: string | null;
          agreed_with?: string | null;
          agreement_evidence_source_id?: string | null;
          body: string;
          client_visible?: boolean;
          closed_at?: string | null;
          closure_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          governed_element_id: string;
          governed_kind: Database["public"]["Enums"]["element_kind"];
          id?: string;
          informing_criterion_key?: string | null;
          informing_standard_version_id?: string | null;
          reference_code: string;
          state?: Database["public"]["Enums"]["acceptance_criterion_state"];
          supersedes_criterion_id?: string | null;
          updated_at?: string;
        };
        Update: {
          agreed_on?: string | null;
          agreed_recorded_at?: string | null;
          agreed_recorded_by?: string | null;
          agreed_with?: string | null;
          agreement_evidence_source_id?: string | null;
          body?: string;
          client_visible?: boolean;
          closed_at?: string | null;
          closure_reason?: string | null;
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          governed_element_id?: string;
          governed_kind?: Database["public"]["Enums"]["element_kind"];
          id?: string;
          informing_criterion_key?: string | null;
          informing_standard_version_id?: string | null;
          reference_code?: string;
          state?: Database["public"]["Enums"]["acceptance_criterion_state"];
          supersedes_criterion_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "acceptance_criteria_agreed_recorded_by_fkey";
            columns: ["agreed_recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acceptance_criteria_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acceptance_criteria_element_fk";
            columns: ["governed_element_id", "engagement_id", "governed_kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
          },
          {
            foreignKeyName: "acceptance_criteria_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acceptance_criteria_evidence_fk";
            columns: ["agreement_evidence_source_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "evidence_sources";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "acceptance_criteria_informing_standard_version_id_fkey";
            columns: ["informing_standard_version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "acceptance_criteria_supersedes_fk";
            columns: ["supersedes_criterion_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "acceptance_criteria";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
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
      architecture_inference_basis: {
        Row: {
          anchor_id: string | null;
          cited: boolean;
          data_class: string;
          digest: string;
          digest_version: number;
          element_id: string | null;
          element_version_id: string | null;
          engagement_id: string;
          handle: string;
          id: string;
          inference_id: string;
          origin: string;
          record_id: string;
          record_type: string;
          variant: string | null;
          version_id: string | null;
        };
        Insert: {
          anchor_id?: string | null;
          cited: boolean;
          data_class: string;
          digest: string;
          digest_version?: number;
          element_id?: string | null;
          element_version_id?: string | null;
          engagement_id: string;
          handle: string;
          id?: string;
          inference_id: string;
          origin: string;
          record_id: string;
          record_type: string;
          variant?: string | null;
          version_id?: string | null;
        };
        Update: {
          anchor_id?: string | null;
          cited?: boolean;
          data_class?: string;
          digest?: string;
          digest_version?: number;
          element_id?: string | null;
          element_version_id?: string | null;
          engagement_id?: string;
          handle?: string;
          id?: string;
          inference_id?: string;
          origin?: string;
          record_id?: string;
          record_type?: string;
          variant?: string | null;
          version_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_inference_basis_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_inference_basis_inference_fk";
            columns: ["inference_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_inferences";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_inference_basis_version_fk";
            columns: ["element_version_id"];
            isOneToOne: false;
            referencedRelation: "element_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      architecture_inference_judgments: {
        Row: {
          engagement_id: string;
          expires_on: string | null;
          id: string;
          inference_id: string;
          judged_at: string;
          judged_by: string;
          judgment_kind: string;
          promotion_target_criterion_id: string | null;
          promotion_target_element_id: string | null;
          promotion_target_element_kind: Database["public"]["Enums"]["element_kind"] | null;
          promotion_target_kind: string | null;
          reason: string | null;
        };
        Insert: {
          engagement_id: string;
          expires_on?: string | null;
          id?: string;
          inference_id: string;
          judged_at?: string;
          judged_by: string;
          judgment_kind: string;
          promotion_target_criterion_id?: string | null;
          promotion_target_element_id?: string | null;
          promotion_target_element_kind?: never;
          promotion_target_kind?: string | null;
          reason?: string | null;
        };
        Update: {
          engagement_id?: string;
          expires_on?: string | null;
          id?: string;
          inference_id?: string;
          judged_at?: string;
          judged_by?: string;
          judgment_kind?: string;
          promotion_target_criterion_id?: string | null;
          promotion_target_element_id?: string | null;
          promotion_target_element_kind?: never;
          promotion_target_kind?: string | null;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_inference_judgments_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_inference_judgments_inference_fk";
            columns: ["inference_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_inferences";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_inference_judgments_judged_by_fkey";
            columns: ["judged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_inference_judgments_promotion_criterion_fk";
            columns: ["promotion_target_criterion_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "acceptance_criteria";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_inference_judgments_promotion_element_fk";
            columns: [
              "promotion_target_element_id",
              "engagement_id",
              "promotion_target_element_kind",
            ];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
          },
        ];
      };
      architecture_inferences: {
        Row: {
          assertion: string;
          authorization_id: string;
          claims: NonNullable<Json>;
          created_at: string;
          engagement_id: string;
          epistemic_status: string;
          examination: NonNullable<Json>;
          generation_policy_version: string;
          id: string;
          inference_kind: string;
          input_tokens: number;
          kept_at: string | null;
          output_schema_version: string;
          output_tokens: number;
          payload: NonNullable<Json>;
          producer: string;
          prompt_content_hash: string;
          prompt_id: string;
          prompt_version: string;
          provider_key: string;
          provider_request_id: string | null;
          reasoning_effort: string | null;
          reasoning_tokens: number;
          request_id: string;
          requested_at: string;
          requested_by: string;
          requested_model: string;
          resolved_model: string;
          subject_element_id: string;
          subject_fingerprint: string | null;
          subject_link_id: string | null;
          subject_link_type: string | null;
          subject_rule_key: string | null;
          subject_second_element_id: string | null;
          subject_type: string;
          subject_version_id: string | null;
          tool_contract_version: string;
          uncertainty: string;
        };
        Insert: {
          assertion: string;
          authorization_id: string;
          claims: NonNullable<Json>;
          created_at?: string;
          engagement_id: string;
          epistemic_status?: string;
          examination?: NonNullable<Json>;
          generation_policy_version: string;
          id?: string;
          inference_kind: string;
          input_tokens?: number;
          kept_at?: string | null;
          output_schema_version: string;
          output_tokens?: number;
          payload?: NonNullable<Json>;
          producer?: string;
          prompt_content_hash: string;
          prompt_id: string;
          prompt_version: string;
          provider_key: string;
          provider_request_id?: string | null;
          reasoning_effort?: string | null;
          reasoning_tokens?: number;
          request_id: string;
          requested_at: string;
          requested_by: string;
          requested_model: string;
          resolved_model: string;
          subject_element_id: string;
          subject_fingerprint?: string | null;
          subject_link_id?: string | null;
          subject_link_type?: string | null;
          subject_rule_key?: string | null;
          subject_second_element_id?: string | null;
          subject_type: string;
          subject_version_id?: string | null;
          tool_contract_version: string;
          uncertainty?: string;
        };
        Update: {
          assertion?: string;
          authorization_id?: string;
          claims?: NonNullable<Json>;
          created_at?: string;
          engagement_id?: string;
          epistemic_status?: string;
          examination?: NonNullable<Json>;
          generation_policy_version?: string;
          id?: string;
          inference_kind?: string;
          input_tokens?: number;
          kept_at?: string | null;
          output_schema_version?: string;
          output_tokens?: number;
          payload?: NonNullable<Json>;
          producer?: string;
          prompt_content_hash?: string;
          prompt_id?: string;
          prompt_version?: string;
          provider_key?: string;
          provider_request_id?: string | null;
          reasoning_effort?: string | null;
          reasoning_tokens?: number;
          request_id?: string;
          requested_at?: string;
          requested_by?: string;
          requested_model?: string;
          resolved_model?: string;
          subject_element_id?: string;
          subject_fingerprint?: string | null;
          subject_link_id?: string | null;
          subject_link_type?: string | null;
          subject_rule_key?: string | null;
          subject_second_element_id?: string | null;
          subject_type?: string;
          subject_version_id?: string | null;
          tool_contract_version?: string;
          uncertainty?: string;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_inferences_authorization_fk";
            columns: ["authorization_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagement_ai_authorizations";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_inferences_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_inferences_request_fk";
            columns: ["request_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_intelligence_requests";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_inferences_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_inferences_second_fk";
            columns: ["subject_second_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_inferences_subject_fk";
            columns: ["subject_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      architecture_intelligence_requests: {
        Row: {
          authorization_id: string | null;
          completed_at: string;
          engagement_id: string;
          error_class: string | null;
          estimated_cost_usd: number;
          generation_policy_version: string | null;
          id: string;
          inference_kind: string;
          input_tokens: number;
          interpret_again: boolean;
          manifest: NonNullable<Json>;
          mode: string;
          outcome: string;
          output_tokens: number;
          prompt_id: string | null;
          prompt_version: string | null;
          provider_key: string | null;
          provider_request_id: string | null;
          reasoning_tokens: number;
          requested_at: string;
          requested_by: string;
          requested_model: string | null;
          resolved_model: string | null;
          subject_element_id: string | null;
          subject_type: string | null;
          tool_calls: NonNullable<Json>;
          tool_contract_version: string | null;
        };
        Insert: {
          authorization_id?: string | null;
          completed_at?: string;
          engagement_id: string;
          error_class?: string | null;
          estimated_cost_usd?: number;
          generation_policy_version?: string | null;
          id?: string;
          inference_kind: string;
          input_tokens?: number;
          interpret_again?: boolean;
          manifest?: NonNullable<Json>;
          mode: string;
          outcome: string;
          output_tokens?: number;
          prompt_id?: string | null;
          prompt_version?: string | null;
          provider_key?: string | null;
          provider_request_id?: string | null;
          reasoning_tokens?: number;
          requested_at: string;
          requested_by: string;
          requested_model?: string | null;
          resolved_model?: string | null;
          subject_element_id?: string | null;
          subject_type?: string | null;
          tool_calls?: NonNullable<Json>;
          tool_contract_version?: string | null;
        };
        Update: {
          authorization_id?: string | null;
          completed_at?: string;
          engagement_id?: string;
          error_class?: string | null;
          estimated_cost_usd?: number;
          generation_policy_version?: string | null;
          id?: string;
          inference_kind?: string;
          input_tokens?: number;
          interpret_again?: boolean;
          manifest?: NonNullable<Json>;
          mode?: string;
          outcome?: string;
          output_tokens?: number;
          prompt_id?: string | null;
          prompt_version?: string | null;
          provider_key?: string | null;
          provider_request_id?: string | null;
          reasoning_tokens?: number;
          requested_at?: string;
          requested_by?: string;
          requested_model?: string | null;
          resolved_model?: string | null;
          subject_element_id?: string | null;
          subject_type?: string | null;
          tool_calls?: NonNullable<Json>;
          tool_contract_version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "architecture_intelligence_requests_authorization_fk";
            columns: ["authorization_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagement_ai_authorizations";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_intelligence_requests_element_fk";
            columns: ["subject_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "architecture_intelligence_requests_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "architecture_intelligence_requests_requested_by_fkey";
            columns: ["requested_by"];
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
            foreignKeyName: "assumptions_category_fk";
            columns: ["kind", "category"];
            isOneToOne: false;
            referencedRelation: "intelligence_categories";
            referencedColumns: ["record_kind", "key"];
          },
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
      client_action_events: {
        Row: {
          action_id: string;
          actor_user_id: string | null;
          created_at: string;
          engagement_id: string;
          event: string;
          from_user_id: string | null;
          id: number;
          note: string | null;
          to_user_id: string | null;
        };
        Insert: {
          action_id: string;
          actor_user_id?: string | null;
          created_at?: string;
          engagement_id: string;
          event: string;
          from_user_id?: string | null;
          id?: never;
          note?: string | null;
          to_user_id?: string | null;
        };
        Update: {
          action_id?: string;
          actor_user_id?: string | null;
          created_at?: string;
          engagement_id?: string;
          event?: string;
          from_user_id?: string | null;
          id?: never;
          note?: string | null;
          to_user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "client_action_events_action_fk";
            columns: ["action_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "client_actions";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "client_action_events_actor_user_id_fkey";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_action_events_from_user_id_fkey";
            columns: ["from_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_action_events_to_user_id_fkey";
            columns: ["to_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_action_responses: {
        Row: {
          action_id: string;
          body: string;
          engagement_id: string;
          evidence_source_id: string | null;
          id: string;
          link_url: string | null;
          recorded_as_evidence_at: string | null;
          recorded_as_evidence_by: string | null;
          responded_at: string;
          responded_by: string;
        };
        Insert: {
          action_id: string;
          body: string;
          engagement_id: string;
          evidence_source_id?: string | null;
          id?: string;
          link_url?: string | null;
          recorded_as_evidence_at?: string | null;
          recorded_as_evidence_by?: string | null;
          responded_at?: string;
          responded_by: string;
        };
        Update: {
          action_id?: string;
          body?: string;
          engagement_id?: string;
          evidence_source_id?: string | null;
          id?: string;
          link_url?: string | null;
          recorded_as_evidence_at?: string | null;
          recorded_as_evidence_by?: string | null;
          responded_at?: string;
          responded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_action_responses_action_fk";
            columns: ["action_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "client_actions";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "client_action_responses_evidence_fk";
            columns: ["evidence_source_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "evidence_sources";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "client_action_responses_recorded_as_evidence_by_fkey";
            columns: ["recorded_as_evidence_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_action_responses_responded_by_fkey";
            columns: ["responded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_action_subjects: {
        Row: {
          action_id: string;
          element_id: string;
          engagement_id: string;
        };
        Insert: {
          action_id: string;
          element_id: string;
          engagement_id: string;
        };
        Update: {
          action_id?: string;
          element_id?: string;
          engagement_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_action_subjects_action_fk";
            columns: ["action_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "client_actions";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "client_action_subjects_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      client_actions: {
        Row: {
          addressed_to_member_id: string | null;
          addressed_to_user_id: string;
          close_note: string | null;
          closed_at: string | null;
          closed_by: string | null;
          due_on: string | null;
          engagement_id: string;
          id: string;
          kind: Database["public"]["Enums"]["client_action_kind"];
          reference_code: string;
          request: string;
          sent_at: string;
          sent_by: string | null;
          status: Database["public"]["Enums"]["client_action_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          addressed_to_member_id?: string | null;
          addressed_to_user_id: string;
          close_note?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          due_on?: string | null;
          engagement_id: string;
          id?: string;
          kind: Database["public"]["Enums"]["client_action_kind"];
          reference_code: string;
          request: string;
          sent_at?: string;
          sent_by?: string | null;
          status?: Database["public"]["Enums"]["client_action_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          addressed_to_member_id?: string | null;
          addressed_to_user_id?: string;
          close_note?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          due_on?: string | null;
          engagement_id?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["client_action_kind"];
          reference_code?: string;
          request?: string;
          sent_at?: string;
          sent_by?: string | null;
          status?: Database["public"]["Enums"]["client_action_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_actions_addressed_to_user_id_fkey";
            columns: ["addressed_to_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_actions_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_actions_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_actions_member_fk";
            columns: ["addressed_to_member_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagement_members";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "client_actions_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      client_contributions: {
        Row: {
          body: string;
          element_id: string;
          element_version_id: string;
          engagement_id: string;
          evidence_source_id: string | null;
          handled_at: string | null;
          handled_by: string | null;
          handling_note: string | null;
          id: string;
          link_url: string | null;
          status: Database["public"]["Enums"]["contribution_status"];
          submitted_at: string;
          submitted_by: string;
        };
        Insert: {
          body: string;
          element_id: string;
          element_version_id: string;
          engagement_id: string;
          evidence_source_id?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          handling_note?: string | null;
          id?: string;
          link_url?: string | null;
          status?: Database["public"]["Enums"]["contribution_status"];
          submitted_at?: string;
          submitted_by: string;
        };
        Update: {
          body?: string;
          element_id?: string;
          element_version_id?: string;
          engagement_id?: string;
          evidence_source_id?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          handling_note?: string | null;
          id?: string;
          link_url?: string | null;
          status?: Database["public"]["Enums"]["contribution_status"];
          submitted_at?: string;
          submitted_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "client_contributions_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "client_contributions_evidence_fk";
            columns: ["evidence_source_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "evidence_sources";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "client_contributions_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_contributions_submitted_by_fkey";
            columns: ["submitted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "client_contributions_version_fk";
            columns: ["element_version_id", "element_id"];
            isOneToOne: false;
            referencedRelation: "element_versions";
            referencedColumns: ["id", "element_id"];
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
      dam_release_members: {
        Row: {
          added_at: string;
          added_by: string | null;
          asset_id: string;
          asset_version_id: string;
          release_id: string;
        };
        Insert: {
          added_at?: string;
          added_by?: string | null;
          asset_id: string;
          asset_version_id: string;
          release_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string | null;
          asset_id?: string;
          asset_version_id?: string;
          release_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "dam_release_members_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dam_release_members_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "method_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dam_release_members_release_id_fkey";
            columns: ["release_id"];
            isOneToOne: false;
            referencedRelation: "dam_releases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dam_release_members_version_fk";
            columns: ["asset_version_id", "asset_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id", "asset_id"];
          },
        ];
      };
      dam_releases: {
        Row: {
          change_summary: string;
          created_at: string;
          created_by: string | null;
          effective_on: string | null;
          id: string;
          published_at: string | null;
          published_by: string | null;
          retired_at: string | null;
          retired_reason: string | null;
          status: Database["public"]["Enums"]["dam_release_status"];
          summary: string;
          supersedes_release_id: string | null;
          title: string;
          updated_at: string;
          version_label: string;
          vocabulary_record: Json | null;
        };
        Insert: {
          change_summary?: string;
          created_at?: string;
          created_by?: string | null;
          effective_on?: string | null;
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          retired_at?: string | null;
          retired_reason?: string | null;
          status?: Database["public"]["Enums"]["dam_release_status"];
          summary?: string;
          supersedes_release_id?: string | null;
          title: string;
          updated_at?: string;
          version_label: string;
          vocabulary_record?: Json | null;
        };
        Update: {
          change_summary?: string;
          created_at?: string;
          created_by?: string | null;
          effective_on?: string | null;
          id?: string;
          published_at?: string | null;
          published_by?: string | null;
          retired_at?: string | null;
          retired_reason?: string | null;
          status?: Database["public"]["Enums"]["dam_release_status"];
          summary?: string;
          supersedes_release_id?: string | null;
          title?: string;
          updated_at?: string;
          version_label?: string;
          vocabulary_record?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "dam_releases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dam_releases_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "dam_releases_supersedes_release_id_fkey";
            columns: ["supersedes_release_id"];
            isOneToOne: false;
            referencedRelation: "dam_releases";
            referencedColumns: ["id"];
          },
        ];
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
          category: string;
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
          category?: string;
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
          category?: string;
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
            foreignKeyName: "decisions_category_fk";
            columns: ["kind", "category"];
            isOneToOne: false;
            referencedRelation: "intelligence_categories";
            referencedColumns: ["record_kind", "key"];
          },
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
      deliverables: {
        Row: {
          baseline_id: string | null;
          confidential: boolean;
          deliverable_type: Database["public"]["Enums"]["deliverable_type"];
          element_id: string;
          engagement_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
        };
        Insert: {
          baseline_id?: string | null;
          confidential?: boolean;
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"];
          element_id: string;
          engagement_id: string;
          kind?: Database["public"]["Enums"]["element_kind"];
        };
        Update: {
          baseline_id?: string | null;
          confidential?: boolean;
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"];
          element_id?: string;
          engagement_id?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
        };
        Relationships: [
          {
            foreignKeyName: "deliverables_baseline_fk";
            columns: ["baseline_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_baselines";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "deliverables_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
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
      development_context_revisions: {
        Row: {
          context_id: string;
          id: string;
          prior_definition: string;
          prior_label: string;
          reason: string;
          revised_at: string;
          revised_by: string | null;
        };
        Insert: {
          context_id: string;
          id?: string;
          prior_definition: string;
          prior_label: string;
          reason: string;
          revised_at?: string;
          revised_by?: string | null;
        };
        Update: {
          context_id?: string;
          id?: string;
          prior_definition?: string;
          prior_label?: string;
          reason?: string;
          revised_at?: string;
          revised_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "development_context_revisions_context_id_fkey";
            columns: ["context_id"];
            isOneToOne: false;
            referencedRelation: "development_contexts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "development_context_revisions_revised_by_fkey";
            columns: ["revised_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      development_contexts: {
        Row: {
          created_at: string;
          created_by: string | null;
          definition: string;
          id: string;
          key: string;
          label: string;
          retired_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          definition: string;
          id?: string;
          key: string;
          label: string;
          retired_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          definition?: string;
          id?: string;
          key?: string;
          label?: string;
          retired_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "development_contexts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
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
      edge_briefing_marks: {
        Row: {
          briefed_through: string;
          engagement_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          briefed_through: string;
          engagement_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          briefed_through?: string;
          engagement_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "edge_briefing_marks_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edge_briefing_marks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      edge_judgments: {
        Row: {
          acceptance_criterion_id: string | null;
          client_action_id: string | null;
          element_id: string | null;
          engagement_id: string;
          expires_on: string | null;
          fingerprint: string;
          id: string;
          judged_at: string;
          judged_by: string;
          judgment_kind: string;
          method_application_id: string | null;
          promotion_target_criterion_id: string | null;
          promotion_target_element_id: string | null;
          promotion_target_element_kind: Database["public"]["Enums"]["element_kind"] | null;
          promotion_target_kind: string | null;
          reason: string | null;
          rule_key: string;
          subject_type: string;
          trigger_key: string | null;
        };
        Insert: {
          acceptance_criterion_id?: string | null;
          client_action_id?: string | null;
          element_id?: string | null;
          engagement_id: string;
          expires_on?: string | null;
          fingerprint: string;
          id?: string;
          judged_at?: string;
          judged_by: string;
          judgment_kind: string;
          method_application_id?: string | null;
          promotion_target_criterion_id?: string | null;
          promotion_target_element_id?: string | null;
          promotion_target_element_kind?: never;
          promotion_target_kind?: string | null;
          reason?: string | null;
          rule_key: string;
          subject_type: string;
          trigger_key?: string | null;
        };
        Update: {
          acceptance_criterion_id?: string | null;
          client_action_id?: string | null;
          element_id?: string | null;
          engagement_id?: string;
          expires_on?: string | null;
          fingerprint?: string;
          id?: string;
          judged_at?: string;
          judged_by?: string;
          judgment_kind?: string;
          method_application_id?: string | null;
          promotion_target_criterion_id?: string | null;
          promotion_target_element_id?: string | null;
          promotion_target_element_kind?: never;
          promotion_target_kind?: string | null;
          reason?: string | null;
          rule_key?: string;
          subject_type?: string;
          trigger_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "edge_judgments_application_fk";
            columns: ["method_application_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "edge_judgments_client_action_fk";
            columns: ["client_action_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "client_actions";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "edge_judgments_criterion_fk";
            columns: ["acceptance_criterion_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "acceptance_criteria";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "edge_judgments_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "edge_judgments_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edge_judgments_judged_by_fkey";
            columns: ["judged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "edge_judgments_promotion_criterion_fk";
            columns: ["promotion_target_criterion_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "acceptance_criteria";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "edge_judgments_promotion_element_fk";
            columns: [
              "promotion_target_element_id",
              "engagement_id",
              "promotion_target_element_kind",
            ];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
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
          lineage_role: Database["public"]["Enums"]["method_lineage_role"];
          method_asset_id: string;
          method_asset_version_id: string;
          method_version: string;
          note: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          element_id: string;
          engagement_id: string;
          id?: string;
          lineage_role: Database["public"]["Enums"]["method_lineage_role"];
          method_asset_id: string;
          method_asset_version_id: string;
          method_version?: string;
          note?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          element_id?: string;
          engagement_id?: string;
          id?: string;
          lineage_role?: Database["public"]["Enums"]["method_lineage_role"];
          method_asset_id?: string;
          method_asset_version_id?: string;
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
          {
            foreignKeyName: "element_method_lineage_method_asset_version_id_fkey";
            columns: ["method_asset_version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
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
      engagement_ai_authorizations: {
        Row: {
          authorized_at: string;
          authorized_by: string;
          basis_kind: string | null;
          basis_note: string | null;
          basis_reference: string | null;
          data_classes: string[];
          effective_from: string;
          engagement_id: string;
          id: string;
          monthly_budget_usd: number | null;
          processing_region: string | null;
          provider_key: string | null;
          sequence_no: number;
          state: string;
        };
        Insert: {
          authorized_at?: string;
          authorized_by: string;
          basis_kind?: string | null;
          basis_note?: string | null;
          basis_reference?: string | null;
          data_classes?: string[];
          effective_from: string;
          engagement_id: string;
          id?: string;
          monthly_budget_usd?: number | null;
          processing_region?: string | null;
          provider_key?: string | null;
          sequence_no: number;
          state: string;
        };
        Update: {
          authorized_at?: string;
          authorized_by?: string;
          basis_kind?: string | null;
          basis_note?: string | null;
          basis_reference?: string | null;
          data_classes?: string[];
          effective_from?: string;
          engagement_id?: string;
          id?: string;
          monthly_budget_usd?: number | null;
          processing_region?: string | null;
          provider_key?: string | null;
          sequence_no?: number;
          state?: string;
        };
        Relationships: [
          {
            foreignKeyName: "engagement_ai_authorizations_authorized_by_fkey";
            columns: ["authorized_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_ai_authorizations_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      engagement_development_contexts: {
        Row: {
          context_id: string;
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          is_primary: boolean;
        };
        Insert: {
          context_id: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          is_primary?: boolean;
        };
        Update: {
          context_id?: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          is_primary?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "engagement_development_contexts_context_id_fkey";
            columns: ["context_id"];
            isOneToOne: false;
            referencedRelation: "development_contexts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_development_contexts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_development_contexts_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      engagement_files: {
        Row: {
          client_action_response_id: string | null;
          client_contribution_id: string | null;
          content_type: string;
          created_at: string;
          element_version_id: string | null;
          engagement_id: string;
          evidence_source_id: string | null;
          filename: string;
          id: string;
          object_path: string;
          purpose: Database["public"]["Enums"]["engagement_file_purpose"];
          size_bytes: number;
          uploaded_by: string;
        };
        Insert: {
          client_action_response_id?: string | null;
          client_contribution_id?: string | null;
          content_type: string;
          created_at?: string;
          element_version_id?: string | null;
          engagement_id: string;
          evidence_source_id?: string | null;
          filename: string;
          id?: string;
          object_path: string;
          purpose: Database["public"]["Enums"]["engagement_file_purpose"];
          size_bytes: number;
          uploaded_by: string;
        };
        Update: {
          client_action_response_id?: string | null;
          client_contribution_id?: string | null;
          content_type?: string;
          created_at?: string;
          element_version_id?: string | null;
          engagement_id?: string;
          evidence_source_id?: string | null;
          filename?: string;
          id?: string;
          object_path?: string;
          purpose?: Database["public"]["Enums"]["engagement_file_purpose"];
          size_bytes?: number;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "engagement_files_contribution_fk";
            columns: ["client_contribution_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "client_contributions";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "engagement_files_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_files_evidence_fk";
            columns: ["evidence_source_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "evidence_sources";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "engagement_files_response_fk";
            columns: ["client_action_response_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "client_action_responses";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "engagement_files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_files_version_fk";
            columns: ["element_version_id"];
            isOneToOne: false;
            referencedRelation: "element_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      engagement_member_areas: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          domain: Database["public"]["Enums"]["architecture_domain"] | null;
          element_id: string | null;
          engagement_id: string;
          engagement_member_id: string;
          id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          domain?: Database["public"]["Enums"]["architecture_domain"] | null;
          element_id?: string | null;
          engagement_id: string;
          engagement_member_id: string;
          id?: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          domain?: Database["public"]["Enums"]["architecture_domain"] | null;
          element_id?: string | null;
          engagement_id?: string;
          engagement_member_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "engagement_member_areas_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "engagement_member_areas_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "engagement_member_areas_member_fk";
            columns: ["engagement_member_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagement_members";
            referencedColumns: ["id", "engagement_id"];
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
          dam_release_id: string | null;
          data_origin: string;
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
          dam_release_id?: string | null;
          data_origin?: string;
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
          dam_release_id?: string | null;
          data_origin?: string;
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
          {
            foreignKeyName: "engagements_dam_release_id_fkey";
            columns: ["dam_release_id"];
            isOneToOne: false;
            referencedRelation: "dam_releases";
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
      implementation_categories: {
        Row: {
          definition: string;
          key: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          definition: string;
          key: string;
          label: string;
          sort_order: number;
        };
        Update: {
          definition?: string;
          key?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      implementation_checkpoints: {
        Row: {
          achieved_evidence_source_id: string | null;
          achieved_on: string | null;
          checkpoint_type: Database["public"]["Enums"]["implementation_checkpoint_type"];
          client_visible: boolean;
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          id: string;
          implementation_element_id: string;
          related_approval_id: string | null;
          related_review_id: string | null;
          target_on: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          achieved_evidence_source_id?: string | null;
          achieved_on?: string | null;
          checkpoint_type: Database["public"]["Enums"]["implementation_checkpoint_type"];
          client_visible?: boolean;
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          id?: string;
          implementation_element_id: string;
          related_approval_id?: string | null;
          related_review_id?: string | null;
          target_on?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          achieved_evidence_source_id?: string | null;
          achieved_on?: string | null;
          checkpoint_type?: Database["public"]["Enums"]["implementation_checkpoint_type"];
          client_visible?: boolean;
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          id?: string;
          implementation_element_id?: string;
          related_approval_id?: string | null;
          related_review_id?: string | null;
          target_on?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "implementation_checkpoints_approval_fk";
            columns: ["related_approval_id"];
            isOneToOne: false;
            referencedRelation: "architecture_approvals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "implementation_checkpoints_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "implementation_checkpoints_evidence_fk";
            columns: ["achieved_evidence_source_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "evidence_sources";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "implementation_checkpoints_initiative_fk";
            columns: ["implementation_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "implementation_initiatives";
            referencedColumns: ["element_id", "engagement_id"];
          },
          {
            foreignKeyName: "implementation_checkpoints_review_fk";
            columns: ["related_review_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["element_id", "engagement_id"];
          },
        ];
      };
      implementation_escalations: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          client_action_id: string | null;
          element_id: string;
          engagement_id: string;
          id: string;
          level: Database["public"]["Enums"]["escalation_level"];
          raised_at: string;
          raised_by: string | null;
          reason: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          client_action_id?: string | null;
          element_id: string;
          engagement_id: string;
          id?: string;
          level: Database["public"]["Enums"]["escalation_level"];
          raised_at?: string;
          raised_by?: string | null;
          reason: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          client_action_id?: string | null;
          element_id?: string;
          engagement_id?: string;
          id?: string;
          level?: Database["public"]["Enums"]["escalation_level"];
          raised_at?: string;
          raised_by?: string | null;
          reason?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "implementation_escalations_acknowledged_by_fkey";
            columns: ["acknowledged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "implementation_escalations_action_fk";
            columns: ["client_action_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "client_actions";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "implementation_escalations_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "implementation_initiatives";
            referencedColumns: ["element_id", "engagement_id"];
          },
          {
            foreignKeyName: "implementation_escalations_raised_by_fkey";
            columns: ["raised_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "implementation_escalations_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      implementation_initiatives: {
        Row: {
          actual_operational_on: string | null;
          category: string;
          element_id: string;
          engagement_id: string;
          implementation_status: Database["public"]["Enums"]["implementation_status"];
          kind: Database["public"]["Enums"]["element_kind"];
          owner_member_id: string | null;
          target_operational_on: string | null;
        };
        Insert: {
          actual_operational_on?: string | null;
          category?: string;
          element_id: string;
          engagement_id: string;
          implementation_status?: Database["public"]["Enums"]["implementation_status"];
          kind?: Database["public"]["Enums"]["element_kind"];
          owner_member_id?: string | null;
          target_operational_on?: string | null;
        };
        Update: {
          actual_operational_on?: string | null;
          category?: string;
          element_id?: string;
          engagement_id?: string;
          implementation_status?: Database["public"]["Enums"]["implementation_status"];
          kind?: Database["public"]["Enums"]["element_kind"];
          owner_member_id?: string | null;
          target_operational_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "implementation_initiatives_category_fkey";
            columns: ["category"];
            isOneToOne: false;
            referencedRelation: "implementation_categories";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "implementation_initiatives_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
          },
          {
            foreignKeyName: "implementation_initiatives_owner_fk";
            columns: ["owner_member_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagement_members";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      implementation_signal_dismissals: {
        Row: {
          dismissed_at: string;
          dismissed_by: string | null;
          element_id: string;
          engagement_id: string;
          expires_on: string | null;
          fingerprint: string;
          id: string;
          reason: string;
          rule_key: string;
        };
        Insert: {
          dismissed_at?: string;
          dismissed_by?: string | null;
          element_id: string;
          engagement_id: string;
          expires_on?: string | null;
          fingerprint: string;
          id?: string;
          reason: string;
          rule_key?: string;
        };
        Update: {
          dismissed_at?: string;
          dismissed_by?: string | null;
          element_id?: string;
          engagement_id?: string;
          expires_on?: string | null;
          fingerprint?: string;
          id?: string;
          reason?: string;
          rule_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "implementation_signal_dismissals_dismissed_by_fkey";
            columns: ["dismissed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "implementation_signal_dismissals_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "implementation_initiatives";
            referencedColumns: ["element_id", "engagement_id"];
          },
          {
            foreignKeyName: "implementation_signal_dismissals_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      implementation_status_changes: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          element_id: string;
          engagement_id: string;
          field: string;
          from_value: string | null;
          id: number;
          operation: string;
          rationale: string | null;
          to_value: string | null;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          element_id: string;
          engagement_id: string;
          field: string;
          from_value?: string | null;
          id?: never;
          operation?: string;
          rationale?: string | null;
          to_value?: string | null;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          element_id?: string;
          engagement_id?: string;
          field?: string;
          from_value?: string | null;
          id?: never;
          operation?: string;
          rationale?: string | null;
          to_value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "implementation_status_changes_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "implementation_status_changes_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "implementation_initiatives";
            referencedColumns: ["element_id", "engagement_id"];
          },
        ];
      };
      implementation_stewardship: {
        Row: {
          attention: Database["public"]["Enums"]["intelligence_attention"];
          element_id: string;
          engagement_id: string;
          next_review_on: string | null;
          triage_note: string;
          triage_state: Database["public"]["Enums"]["triage_state"];
          triaged_at: string | null;
          triaged_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          attention?: Database["public"]["Enums"]["intelligence_attention"];
          element_id: string;
          engagement_id: string;
          next_review_on?: string | null;
          triage_note?: string;
          triage_state?: Database["public"]["Enums"]["triage_state"];
          triaged_at?: string | null;
          triaged_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          attention?: Database["public"]["Enums"]["intelligence_attention"];
          element_id?: string;
          engagement_id?: string;
          next_review_on?: string | null;
          triage_note?: string;
          triage_state?: Database["public"]["Enums"]["triage_state"];
          triaged_at?: string | null;
          triaged_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "implementation_stewardship_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "implementation_initiatives";
            referencedColumns: ["element_id", "engagement_id"];
          },
          {
            foreignKeyName: "implementation_stewardship_triaged_by_fkey";
            columns: ["triaged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "implementation_stewardship_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      instrument_version_evidence_types: {
        Row: {
          evidence_source_type: Database["public"]["Enums"]["evidence_source_type"];
          version_id: string;
        };
        Insert: {
          evidence_source_type: Database["public"]["Enums"]["evidence_source_type"];
          version_id: string;
        };
        Update: {
          evidence_source_type?: Database["public"]["Enums"]["evidence_source_type"];
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "instrument_version_evidence_types_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_categories: {
        Row: {
          definition: string;
          key: string;
          label: string;
          record_kind: Database["public"]["Enums"]["element_kind"];
          sort_order: number;
        };
        Insert: {
          definition: string;
          key: string;
          label: string;
          record_kind: Database["public"]["Enums"]["element_kind"];
          sort_order: number;
        };
        Update: {
          definition?: string;
          key?: string;
          label?: string;
          record_kind?: Database["public"]["Enums"]["element_kind"];
          sort_order?: number;
        };
        Relationships: [];
      };
      intelligence_escalations: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          client_action_id: string | null;
          element_id: string;
          engagement_id: string;
          id: string;
          level: Database["public"]["Enums"]["escalation_level"];
          raised_at: string;
          raised_by: string | null;
          reason: string;
          resolution_note: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          client_action_id?: string | null;
          element_id: string;
          engagement_id: string;
          id?: string;
          level: Database["public"]["Enums"]["escalation_level"];
          raised_at?: string;
          raised_by?: string | null;
          reason: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          client_action_id?: string | null;
          element_id?: string;
          engagement_id?: string;
          id?: string;
          level?: Database["public"]["Enums"]["escalation_level"];
          raised_at?: string;
          raised_by?: string | null;
          reason?: string;
          resolution_note?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_escalations_acknowledged_by_fkey";
            columns: ["acknowledged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_escalations_action_fk";
            columns: ["client_action_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "client_actions";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "intelligence_escalations_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "intelligence_escalations_raised_by_fkey";
            columns: ["raised_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_escalations_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      intelligence_signal_dismissals: {
        Row: {
          client_action_id: string | null;
          dismissed_at: string;
          dismissed_by: string | null;
          element_id: string | null;
          engagement_id: string;
          expires_on: string | null;
          fingerprint: string;
          id: string;
          reason: string;
          rule_key: string;
        };
        Insert: {
          client_action_id?: string | null;
          dismissed_at?: string;
          dismissed_by?: string | null;
          element_id?: string | null;
          engagement_id: string;
          expires_on?: string | null;
          fingerprint: string;
          id?: string;
          reason: string;
          rule_key: string;
        };
        Update: {
          client_action_id?: string | null;
          dismissed_at?: string;
          dismissed_by?: string | null;
          element_id?: string | null;
          engagement_id?: string;
          expires_on?: string | null;
          fingerprint?: string;
          id?: string;
          reason?: string;
          rule_key?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_signal_dismissals_action_fk";
            columns: ["client_action_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "client_actions";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "intelligence_signal_dismissals_dismissed_by_fkey";
            columns: ["dismissed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_signal_dismissals_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "intelligence_signal_dismissals_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
        ];
      };
      intelligence_status_changes: {
        Row: {
          changed_at: string;
          changed_by: string | null;
          element_id: string;
          engagement_id: string;
          field: string;
          from_value: string | null;
          id: number;
          kind: Database["public"]["Enums"]["element_kind"];
          operation: string;
          rationale: string | null;
          to_value: string | null;
        };
        Insert: {
          changed_at?: string;
          changed_by?: string | null;
          element_id: string;
          engagement_id: string;
          field: string;
          from_value?: string | null;
          id?: never;
          kind: Database["public"]["Enums"]["element_kind"];
          operation?: string;
          rationale?: string | null;
          to_value?: string | null;
        };
        Update: {
          changed_at?: string;
          changed_by?: string | null;
          element_id?: string;
          engagement_id?: string;
          field?: string;
          from_value?: string | null;
          id?: never;
          kind?: Database["public"]["Enums"]["element_kind"];
          operation?: string;
          rationale?: string | null;
          to_value?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_status_changes_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_status_changes_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      intelligence_stewardship: {
        Row: {
          attention: Database["public"]["Enums"]["intelligence_attention"];
          element_id: string;
          engagement_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          next_review_on: string | null;
          triage_note: string;
          triage_state: Database["public"]["Enums"]["triage_state"];
          triaged_at: string | null;
          triaged_by: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          attention?: Database["public"]["Enums"]["intelligence_attention"];
          element_id: string;
          engagement_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          next_review_on?: string | null;
          triage_note?: string;
          triage_state?: Database["public"]["Enums"]["triage_state"];
          triaged_at?: string | null;
          triaged_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          attention?: Database["public"]["Enums"]["intelligence_attention"];
          element_id?: string;
          engagement_id?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          next_review_on?: string | null;
          triage_note?: string;
          triage_state?: Database["public"]["Enums"]["triage_state"];
          triaged_at?: string | null;
          triaged_by?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "intelligence_stewardship_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
          },
          {
            foreignKeyName: "intelligence_stewardship_triaged_by_fkey";
            columns: ["triaged_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "intelligence_stewardship_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
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
      method_application_addenda: {
        Row: {
          application_id: string;
          body: string;
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          id: string;
        };
        Insert: {
          application_id: string;
          body: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          id?: string;
        };
        Update: {
          application_id?: string;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_application_addenda_application_id_engagement_id_fkey";
            columns: ["application_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "method_application_addenda_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      method_application_assets: {
        Row: {
          application_id: string;
          asset_version_id: string;
          deviation_note: string;
        };
        Insert: {
          application_id: string;
          asset_version_id: string;
          deviation_note?: string;
        };
        Update: {
          application_id?: string;
          asset_version_id?: string;
          deviation_note?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_application_assets_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_application_assets_asset_version_id_fkey";
            columns: ["asset_version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_application_contexts: {
        Row: {
          application_id: string;
          context_id: string;
        };
        Insert: {
          application_id: string;
          context_id: string;
        };
        Update: {
          application_id?: string;
          context_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_application_contexts_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_application_contexts_context_id_fkey";
            columns: ["context_id"];
            isOneToOne: false;
            referencedRelation: "development_contexts";
            referencedColumns: ["id"];
          },
        ];
      };
      method_application_domains: {
        Row: {
          application_id: string;
          domain: Database["public"]["Enums"]["architecture_domain"];
        };
        Insert: {
          application_id: string;
          domain: Database["public"]["Enums"]["architecture_domain"];
        };
        Update: {
          application_id?: string;
          domain?: Database["public"]["Enums"]["architecture_domain"];
        };
        Relationships: [
          {
            foreignKeyName: "method_application_domains_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id"];
          },
        ];
      };
      method_application_elements: {
        Row: {
          application_id: string;
          captured_at: string;
          captured_kind: Database["public"]["Enums"]["element_kind"];
          captured_object_type_key: string | null;
          captured_reference_code: string | null;
          captured_title: string;
          created_at: string;
          created_by: string | null;
          element_id: string | null;
          element_removed_at: string | null;
          engagement_id: string;
          id: string;
          note: string;
          observed_version_id: string | null;
          role: Database["public"]["Enums"]["method_application_element_role"];
        };
        Insert: {
          application_id: string;
          captured_at?: string;
          captured_kind: Database["public"]["Enums"]["element_kind"];
          captured_object_type_key?: string | null;
          captured_reference_code?: string | null;
          captured_title: string;
          created_at?: string;
          created_by?: string | null;
          element_id?: string | null;
          element_removed_at?: string | null;
          engagement_id: string;
          id?: string;
          note?: string;
          observed_version_id?: string | null;
          role: Database["public"]["Enums"]["method_application_element_role"];
        };
        Update: {
          application_id?: string;
          captured_at?: string;
          captured_kind?: Database["public"]["Enums"]["element_kind"];
          captured_object_type_key?: string | null;
          captured_reference_code?: string | null;
          captured_title?: string;
          created_at?: string;
          created_by?: string | null;
          element_id?: string | null;
          element_removed_at?: string | null;
          engagement_id?: string;
          id?: string;
          note?: string;
          observed_version_id?: string | null;
          role?: Database["public"]["Enums"]["method_application_element_role"];
        };
        Relationships: [
          {
            foreignKeyName: "method_application_elements_application_id_engagement_id_fkey";
            columns: ["application_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "method_application_elements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_application_elements_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "method_application_elements_observed_version_id_fkey";
            columns: ["observed_version_id"];
            isOneToOne: false;
            referencedRelation: "element_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_application_evidence: {
        Row: {
          application_id: string;
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          evidence_source_id: string;
          id: string;
          instrument_version_id: string | null;
          note: string;
          role: Database["public"]["Enums"]["method_application_evidence_role"];
        };
        Insert: {
          application_id: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id: string;
          evidence_source_id: string;
          id?: string;
          instrument_version_id?: string | null;
          note?: string;
          role: Database["public"]["Enums"]["method_application_evidence_role"];
        };
        Update: {
          application_id?: string;
          created_at?: string;
          created_by?: string | null;
          engagement_id?: string;
          evidence_source_id?: string;
          id?: string;
          instrument_version_id?: string | null;
          note?: string;
          role?: Database["public"]["Enums"]["method_application_evidence_role"];
        };
        Relationships: [
          {
            foreignKeyName: "method_application_evidence_application_id_engagement_id_fkey";
            columns: ["application_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "method_application_evidence_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_application_evidence_evidence_source_id_engagement__fkey";
            columns: ["evidence_source_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "evidence_sources";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "method_application_evidence_instrument_version_id_fkey";
            columns: ["instrument_version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_application_practitioners: {
        Row: {
          application_id: string;
          engagement_id: string;
          engagement_member_id: string;
          role: string;
        };
        Insert: {
          application_id: string;
          engagement_id: string;
          engagement_member_id: string;
          role: string;
        };
        Update: {
          application_id?: string;
          engagement_id?: string;
          engagement_member_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_application_practition_application_id_engagement_id_fkey";
            columns: ["application_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "method_application_practition_engagement_member_id_engagem_fkey";
            columns: ["engagement_member_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagement_members";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      method_application_stage_notes: {
        Row: {
          application_id: string;
          id: string;
          note: string;
          reason: string | null;
          stage_id: string;
          treatment: Database["public"]["Enums"]["method_stage_treatment"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          application_id: string;
          id?: string;
          note?: string;
          reason?: string | null;
          stage_id: string;
          treatment: Database["public"]["Enums"]["method_stage_treatment"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          application_id?: string;
          id?: string;
          note?: string;
          reason?: string | null;
          stage_id?: string;
          treatment?: Database["public"]["Enums"]["method_stage_treatment"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "method_application_stage_notes_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_application_stage_notes_stage_id_fkey";
            columns: ["stage_id"];
            isOneToOne: false;
            referencedRelation: "method_version_stages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_application_stage_notes_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      method_applications: {
        Row: {
          architectural_question: string;
          closed_on: string | null;
          completion_statement: string | null;
          continues_application_id: string | null;
          created_at: string;
          created_by: string | null;
          dam_release_id: string | null;
          discontinued_reason: string | null;
          engagement_id: string;
          engagement_wide: boolean;
          id: string;
          method_asset_version_id: string;
          outside_release_reason: string | null;
          reference_code: string;
          retrospective: string | null;
          selection_reason: string;
          started_on: string | null;
          state: Database["public"]["Enums"]["method_application_state"];
          title: string;
          updated_at: string;
          version_in_release: boolean;
        };
        Insert: {
          architectural_question?: string;
          closed_on?: string | null;
          completion_statement?: string | null;
          continues_application_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          dam_release_id?: string | null;
          discontinued_reason?: string | null;
          engagement_id: string;
          engagement_wide?: boolean;
          id?: string;
          method_asset_version_id: string;
          outside_release_reason?: string | null;
          reference_code: string;
          retrospective?: string | null;
          selection_reason: string;
          started_on?: string | null;
          state?: Database["public"]["Enums"]["method_application_state"];
          title: string;
          updated_at?: string;
          version_in_release: boolean;
        };
        Update: {
          architectural_question?: string;
          closed_on?: string | null;
          completion_statement?: string | null;
          continues_application_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          dam_release_id?: string | null;
          discontinued_reason?: string | null;
          engagement_id?: string;
          engagement_wide?: boolean;
          id?: string;
          method_asset_version_id?: string;
          outside_release_reason?: string | null;
          reference_code?: string;
          retrospective?: string | null;
          selection_reason?: string;
          started_on?: string | null;
          state?: Database["public"]["Enums"]["method_application_state"];
          title?: string;
          updated_at?: string;
          version_in_release?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "method_applications_continues_fk";
            columns: ["continues_application_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "method_applications_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_applications_dam_release_id_fkey";
            columns: ["dam_release_id"];
            isOneToOne: false;
            referencedRelation: "dam_releases";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_applications_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_applications_method_asset_version_id_fkey";
            columns: ["method_asset_version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_asset_categories: {
        Row: {
          active: boolean;
          description: string;
          key: string;
          label: string;
          sort_order: number;
        };
        Insert: {
          active?: boolean;
          description: string;
          key: string;
          label: string;
          sort_order: number;
        };
        Update: {
          active?: boolean;
          description?: string;
          key?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      method_asset_rights_holders: {
        Row: {
          agreement_reference: string;
          asset_id: string;
          effective_on: string | null;
          external_holder_name: string | null;
          holder_role: Database["public"]["Enums"]["method_rights_role"];
          id: string;
          note: string;
          organization_id: string | null;
          recorded_at: string;
          recorded_by: string | null;
          superseded_at: string | null;
          superseded_by_id: string | null;
          superseded_reason: string | null;
        };
        Insert: {
          agreement_reference?: string;
          asset_id: string;
          effective_on?: string | null;
          external_holder_name?: string | null;
          holder_role: Database["public"]["Enums"]["method_rights_role"];
          id?: string;
          note?: string;
          organization_id?: string | null;
          recorded_at?: string;
          recorded_by?: string | null;
          superseded_at?: string | null;
          superseded_by_id?: string | null;
          superseded_reason?: string | null;
        };
        Update: {
          agreement_reference?: string;
          asset_id?: string;
          effective_on?: string | null;
          external_holder_name?: string | null;
          holder_role?: Database["public"]["Enums"]["method_rights_role"];
          id?: string;
          note?: string;
          organization_id?: string | null;
          recorded_at?: string;
          recorded_by?: string | null;
          superseded_at?: string | null;
          superseded_by_id?: string | null;
          superseded_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "method_asset_rights_holders_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "method_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_asset_rights_holders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_asset_rights_holders_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_asset_rights_holders_superseded_by_id_fkey";
            columns: ["superseded_by_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_rights_holders";
            referencedColumns: ["id"];
          },
        ];
      };
      method_asset_versions: {
        Row: {
          applicability: string;
          architectural_question: string;
          asset_id: string;
          authored_by: string | null;
          change_summary: string;
          completion_criteria: string;
          completion_standard_version_id: string | null;
          created_at: string;
          created_by: string | null;
          derived_from_version_id: string | null;
          disclosable_name: string | null;
          effective_on: string | null;
          evidence_expectations: string;
          exclusions: string;
          expected_inputs: string;
          external_basis: string;
          id: string;
          identity_disclosure: Database["public"]["Enums"]["method_identity_disclosure"];
          implementation_implications: string;
          internal_notes: string;
          legacy: boolean;
          lifecycle: Database["public"]["Enums"]["method_asset_version_lifecycle"];
          modes: string[];
          practitioner_instructions: string;
          practitioner_roles: string;
          prerequisites: string;
          published_at: string | null;
          published_by: string | null;
          retired_at: string | null;
          retired_by: string | null;
          retired_reason: string | null;
          review_implications: string;
          summary: string;
          updated_at: string;
          version_label: string | null;
          version_no: number;
        };
        Insert: {
          applicability?: string;
          architectural_question?: string;
          asset_id: string;
          authored_by?: string | null;
          change_summary?: string;
          completion_criteria?: string;
          completion_standard_version_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          derived_from_version_id?: string | null;
          disclosable_name?: string | null;
          effective_on?: string | null;
          evidence_expectations?: string;
          exclusions?: string;
          expected_inputs?: string;
          external_basis?: string;
          id?: string;
          identity_disclosure?: Database["public"]["Enums"]["method_identity_disclosure"];
          implementation_implications?: string;
          internal_notes?: string;
          legacy?: boolean;
          lifecycle?: Database["public"]["Enums"]["method_asset_version_lifecycle"];
          modes?: string[];
          practitioner_instructions?: string;
          practitioner_roles?: string;
          prerequisites?: string;
          published_at?: string | null;
          published_by?: string | null;
          retired_at?: string | null;
          retired_by?: string | null;
          retired_reason?: string | null;
          review_implications?: string;
          summary?: string;
          updated_at?: string;
          version_label?: string | null;
          version_no: number;
        };
        Update: {
          applicability?: string;
          architectural_question?: string;
          asset_id?: string;
          authored_by?: string | null;
          change_summary?: string;
          completion_criteria?: string;
          completion_standard_version_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          derived_from_version_id?: string | null;
          disclosable_name?: string | null;
          effective_on?: string | null;
          evidence_expectations?: string;
          exclusions?: string;
          expected_inputs?: string;
          external_basis?: string;
          id?: string;
          identity_disclosure?: Database["public"]["Enums"]["method_identity_disclosure"];
          implementation_implications?: string;
          internal_notes?: string;
          legacy?: boolean;
          lifecycle?: Database["public"]["Enums"]["method_asset_version_lifecycle"];
          modes?: string[];
          practitioner_instructions?: string;
          practitioner_roles?: string;
          prerequisites?: string;
          published_at?: string | null;
          published_by?: string | null;
          retired_at?: string | null;
          retired_by?: string | null;
          retired_reason?: string | null;
          review_implications?: string;
          summary?: string;
          updated_at?: string;
          version_label?: string | null;
          version_no?: number;
        };
        Relationships: [
          {
            foreignKeyName: "method_asset_versions_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "method_assets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_asset_versions_authored_by_fkey";
            columns: ["authored_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_asset_versions_completion_standard_version_id_fkey";
            columns: ["completion_standard_version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_asset_versions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_asset_versions_derived_from_version_id_fkey";
            columns: ["derived_from_version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_asset_versions_published_by_fkey";
            columns: ["published_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_asset_versions_retired_by_fkey";
            columns: ["retired_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      method_assets: {
        Row: {
          category_key: string;
          created_at: string;
          created_by: string | null;
          current_version_id: string | null;
          form: Database["public"]["Enums"]["method_asset_form"] | null;
          id: string;
          ip_classification: Database["public"]["Enums"]["ip_classification"];
          key: string;
          origin: Database["public"]["Enums"]["method_asset_origin"];
          retired_at: string | null;
          retired_reason: string | null;
          status: string;
          steward_user_id: string | null;
          title: string;
          updated_at: string;
          usage_restriction: string | null;
        };
        Insert: {
          category_key: string;
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          form?: Database["public"]["Enums"]["method_asset_form"] | null;
          id?: string;
          ip_classification?: Database["public"]["Enums"]["ip_classification"];
          key: string;
          origin?: Database["public"]["Enums"]["method_asset_origin"];
          retired_at?: string | null;
          retired_reason?: string | null;
          status?: string;
          steward_user_id?: string | null;
          title: string;
          updated_at?: string;
          usage_restriction?: string | null;
        };
        Update: {
          category_key?: string;
          created_at?: string;
          created_by?: string | null;
          current_version_id?: string | null;
          form?: Database["public"]["Enums"]["method_asset_form"] | null;
          id?: string;
          ip_classification?: Database["public"]["Enums"]["ip_classification"];
          key?: string;
          origin?: Database["public"]["Enums"]["method_asset_origin"];
          retired_at?: string | null;
          retired_reason?: string | null;
          status?: string;
          steward_user_id?: string | null;
          title?: string;
          updated_at?: string;
          usage_restriction?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "method_assets_category_key_fkey";
            columns: ["category_key"];
            isOneToOne: false;
            referencedRelation: "method_asset_categories";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "method_assets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_assets_current_version_fk";
            columns: ["current_version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_assets_owner_user_id_fkey";
            columns: ["steward_user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      method_version_components: {
        Row: {
          component_version_id: string;
          note: string;
          version_id: string;
        };
        Insert: {
          component_version_id: string;
          note?: string;
          version_id: string;
        };
        Update: {
          component_version_id?: string;
          note?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_version_components_component_version_id_fkey";
            columns: ["component_version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_version_components_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_version_contexts: {
        Row: {
          context_id: string;
          version_id: string;
        };
        Insert: {
          context_id: string;
          version_id: string;
        };
        Update: {
          context_id?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_version_contexts_context_id_fkey";
            columns: ["context_id"];
            isOneToOne: false;
            referencedRelation: "development_contexts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_version_contexts_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_version_domains: {
        Row: {
          domain: Database["public"]["Enums"]["architecture_domain"];
          version_id: string;
        };
        Insert: {
          domain: Database["public"]["Enums"]["architecture_domain"];
          version_id: string;
        };
        Update: {
          domain?: Database["public"]["Enums"]["architecture_domain"];
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_version_domains_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_version_files: {
        Row: {
          content_type: string;
          created_at: string;
          file_name: string;
          id: string;
          object_path: string;
          size_bytes: number;
          uploaded_by: string;
          version_id: string;
        };
        Insert: {
          content_type: string;
          created_at?: string;
          file_name: string;
          id?: string;
          object_path: string;
          size_bytes: number;
          uploaded_by?: string;
          version_id: string;
        };
        Update: {
          content_type?: string;
          created_at?: string;
          file_name?: string;
          id?: string;
          object_path?: string;
          size_bytes?: number;
          uploaded_by?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_version_files_uploaded_by_fkey";
            columns: ["uploaded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_version_files_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_version_learning_sources: {
        Row: {
          application_id: string;
          note: string;
          version_id: string;
        };
        Insert: {
          application_id: string;
          note: string;
          version_id: string;
        };
        Update: {
          application_id?: string;
          note?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_version_learning_sources_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "method_applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "method_version_learning_sources_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_version_outputs: {
        Row: {
          deliverable_type: Database["public"]["Enums"]["deliverable_type"] | null;
          id: string;
          note: string;
          object_type_key: string | null;
          ordinal: number;
          output_kind: Database["public"]["Enums"]["element_kind"];
          version_id: string;
        };
        Insert: {
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"] | null;
          id?: string;
          note?: string;
          object_type_key?: string | null;
          ordinal: number;
          output_kind: Database["public"]["Enums"]["element_kind"];
          version_id: string;
        };
        Update: {
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"] | null;
          id?: string;
          note?: string;
          object_type_key?: string | null;
          ordinal?: number;
          output_kind?: Database["public"]["Enums"]["element_kind"];
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_version_outputs_object_type_key_fkey";
            columns: ["object_type_key"];
            isOneToOne: false;
            referencedRelation: "architecture_object_types";
            referencedColumns: ["key"];
          },
          {
            foreignKeyName: "method_version_outputs_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      method_version_stages: {
        Row: {
          guidance: string;
          id: string;
          key: string;
          ordinal: number;
          purpose: string;
          title: string;
          version_id: string;
        };
        Insert: {
          guidance?: string;
          id?: string;
          key: string;
          ordinal: number;
          purpose?: string;
          title: string;
          version_id: string;
        };
        Update: {
          guidance?: string;
          id?: string;
          key?: string;
          ordinal?: number;
          purpose?: string;
          title?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "method_version_stages_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      opportunities: {
        Row: {
          attractiveness: number | null;
          category: string;
          element_id: string;
          engagement_id: string;
          feasibility: number;
          kind: Database["public"]["Enums"]["element_kind"];
          opportunity_status: Database["public"]["Enums"]["opportunity_status"];
          pursuit_approach: string;
          value: number;
          window_closes_on: string | null;
          window_opens_on: string | null;
        };
        Insert: {
          attractiveness?: never;
          category?: string;
          element_id: string;
          engagement_id: string;
          feasibility?: number;
          kind?: Database["public"]["Enums"]["element_kind"];
          opportunity_status?: Database["public"]["Enums"]["opportunity_status"];
          pursuit_approach?: string;
          value?: number;
          window_closes_on?: string | null;
          window_opens_on?: string | null;
        };
        Update: {
          attractiveness?: never;
          category?: string;
          element_id?: string;
          engagement_id?: string;
          feasibility?: number;
          kind?: Database["public"]["Enums"]["element_kind"];
          opportunity_status?: Database["public"]["Enums"]["opportunity_status"];
          pursuit_approach?: string;
          value?: number;
          window_closes_on?: string | null;
          window_opens_on?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "opportunities_category_fk";
            columns: ["kind", "category"];
            isOneToOne: false;
            referencedRelation: "intelligence_categories";
            referencedColumns: ["record_kind", "key"];
          },
          {
            foreignKeyName: "opportunities_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
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
      pending_architecture_inferences: {
        Row: {
          created_at: string;
          engagement_id: string;
          expires_at: string;
          inference: NonNullable<Json>;
          request_id: string;
          requested_by: string;
        };
        Insert: {
          created_at?: string;
          engagement_id: string;
          expires_at: string;
          inference: NonNullable<Json>;
          request_id: string;
          requested_by: string;
        };
        Update: {
          created_at?: string;
          engagement_id?: string;
          expires_at?: string;
          inference?: NonNullable<Json>;
          request_id?: string;
          requested_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pending_architecture_inferences_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pending_architecture_inferences_request_fk";
            columns: ["request_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_intelligence_requests";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "pending_architecture_inferences_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      practice_member_capability_overrides: {
        Row: {
          capability: Database["public"]["Enums"]["practice_capability"];
          created_at: string;
          created_by: string | null;
          granted: boolean;
          id: string;
          organization_member_id: string;
          reason: string;
          updated_at: string;
        };
        Insert: {
          capability: Database["public"]["Enums"]["practice_capability"];
          created_at?: string;
          created_by?: string | null;
          granted: boolean;
          id?: string;
          organization_member_id: string;
          reason: string;
          updated_at?: string;
        };
        Update: {
          capability?: Database["public"]["Enums"]["practice_capability"];
          created_at?: string;
          created_by?: string | null;
          granted?: boolean;
          id?: string;
          organization_member_id?: string;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "practice_member_capability_override_organization_member_id_fkey";
            columns: ["organization_member_id"];
            isOneToOne: false;
            referencedRelation: "organization_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "practice_member_capability_overrides_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      practice_role_capability_defaults: {
        Row: {
          capability: Database["public"]["Enums"]["practice_capability"];
          role: Database["public"]["Enums"]["app_role"];
        };
        Insert: {
          capability: Database["public"]["Enums"]["practice_capability"];
          role: Database["public"]["Enums"]["app_role"];
        };
        Update: {
          capability?: Database["public"]["Enums"]["practice_capability"];
          role?: Database["public"]["Enums"]["app_role"];
        };
        Relationships: [];
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
          category: string;
          element_id: string;
          engagement_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          priority: Database["public"]["Enums"]["recommendation_priority"];
          rationale: string;
        };
        Insert: {
          category?: string;
          element_id: string;
          engagement_id: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          priority?: Database["public"]["Enums"]["recommendation_priority"];
          rationale?: string;
        };
        Update: {
          category?: string;
          element_id?: string;
          engagement_id?: string;
          kind?: Database["public"]["Enums"]["element_kind"];
          priority?: Database["public"]["Enums"]["recommendation_priority"];
          rationale?: string;
        };
        Relationships: [
          {
            foreignKeyName: "recommendations_category_fk";
            columns: ["kind", "category"];
            isOneToOne: false;
            referencedRelation: "intelligence_categories";
            referencedColumns: ["record_kind", "key"];
          },
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
      relationship_impact_rules: {
        Row: {
          assessment: string;
          condition: string | null;
          direction: string;
          edge_eligible: boolean | null;
          hub_target: boolean;
          link_key: string;
          max_depth: number;
          propagation: string;
          reason: string;
        };
        Insert: {
          assessment: string;
          condition?: string | null;
          direction: string;
          edge_eligible?: never;
          hub_target?: boolean;
          link_key: string;
          max_depth: number;
          propagation: string;
          reason: string;
        };
        Update: {
          assessment?: string;
          condition?: string | null;
          direction?: string;
          edge_eligible?: never;
          hub_target?: boolean;
          link_key?: string;
          max_depth?: number;
          propagation?: string;
          reason?: string;
        };
        Relationships: [];
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
      review_examined_versions: {
        Row: {
          captured_at: string;
          element_id: string;
          element_version_id: string | null;
          engagement_id: string;
          review_element_id: string;
        };
        Insert: {
          captured_at?: string;
          element_id: string;
          element_version_id?: string | null;
          engagement_id: string;
          review_element_id: string;
        };
        Update: {
          captured_at?: string;
          element_id?: string;
          element_version_id?: string | null;
          engagement_id?: string;
          review_element_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "review_examined_versions_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "review_examined_versions_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_examined_versions_review_fk";
            columns: ["review_element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "review_examined_versions_version_fk";
            columns: ["element_version_id", "element_id"];
            isOneToOne: false;
            referencedRelation: "element_versions";
            referencedColumns: ["id", "element_id"];
          },
        ];
      };
      review_participants: {
        Row: {
          added_at: string;
          added_by: string | null;
          attended: boolean;
          element_id: string;
          engagement_id: string;
          engagement_member_id: string;
          id: string;
          role: Database["public"]["Enums"]["review_participant_role"];
        };
        Insert: {
          added_at?: string;
          added_by?: string | null;
          attended?: boolean;
          element_id: string;
          engagement_id: string;
          engagement_member_id: string;
          id?: string;
          role?: Database["public"]["Enums"]["review_participant_role"];
        };
        Update: {
          added_at?: string;
          added_by?: string | null;
          attended?: boolean;
          element_id?: string;
          engagement_id?: string;
          engagement_member_id?: string;
          id?: string;
          role?: Database["public"]["Enums"]["review_participant_role"];
        };
        Relationships: [
          {
            foreignKeyName: "review_participants_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "review_participants_element_fk";
            columns: ["element_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "reviews";
            referencedColumns: ["element_id", "engagement_id"];
          },
          {
            foreignKeyName: "review_participants_member_fk";
            columns: ["engagement_member_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagement_members";
            referencedColumns: ["id", "engagement_id"];
          },
        ];
      };
      reviews: {
        Row: {
          baseline_id: string | null;
          element_id: string;
          engagement_id: string;
          held_at: string | null;
          kind: Database["public"]["Enums"]["element_kind"];
          review_status: Database["public"]["Enums"]["review_status"];
          review_type: Database["public"]["Enums"]["review_type"];
          scheduled_for: string | null;
          summary: string;
        };
        Insert: {
          baseline_id?: string | null;
          element_id: string;
          engagement_id: string;
          held_at?: string | null;
          kind?: Database["public"]["Enums"]["element_kind"];
          review_status?: Database["public"]["Enums"]["review_status"];
          review_type: Database["public"]["Enums"]["review_type"];
          scheduled_for?: string | null;
          summary?: string;
        };
        Update: {
          baseline_id?: string | null;
          element_id?: string;
          engagement_id?: string;
          held_at?: string | null;
          kind?: Database["public"]["Enums"]["element_kind"];
          review_status?: Database["public"]["Enums"]["review_status"];
          review_type?: Database["public"]["Enums"]["review_type"];
          scheduled_for?: string | null;
          summary?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_baseline_fk";
            columns: ["baseline_id", "engagement_id"];
            isOneToOne: false;
            referencedRelation: "architecture_baselines";
            referencedColumns: ["id", "engagement_id"];
          },
          {
            foreignKeyName: "reviews_element_fk";
            columns: ["element_id", "engagement_id", "kind"];
            isOneToOne: false;
            referencedRelation: "architecture_elements";
            referencedColumns: ["id", "engagement_id", "kind"];
          },
        ];
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
            foreignKeyName: "risks_category_fk";
            columns: ["kind", "category"];
            isOneToOne: false;
            referencedRelation: "intelligence_categories";
            referencedColumns: ["record_kind", "key"];
          },
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
      standard_version_criteria: {
        Row: {
          guidance: string;
          id: string;
          key: string;
          ordinal: number;
          scale: string;
          statement: string;
          version_id: string;
        };
        Insert: {
          guidance?: string;
          id?: string;
          key: string;
          ordinal: number;
          scale?: string;
          statement: string;
          version_id: string;
        };
        Update: {
          guidance?: string;
          id?: string;
          key?: string;
          ordinal?: number;
          scale?: string;
          statement?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "standard_version_criteria_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      standard_version_judged_in: {
        Row: {
          setting: string;
          version_id: string;
        };
        Insert: {
          setting: string;
          version_id: string;
        };
        Update: {
          setting?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "standard_version_judged_in_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
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
      template_version_sections: {
        Row: {
          guidance: string;
          id: string;
          ordinal: number;
          title: string;
          version_id: string;
        };
        Insert: {
          guidance?: string;
          id?: string;
          ordinal: number;
          title: string;
          version_id: string;
        };
        Update: {
          guidance?: string;
          id?: string;
          ordinal?: number;
          title?: string;
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_version_sections_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: false;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      template_version_specs: {
        Row: {
          deliverable_type: Database["public"]["Enums"]["deliverable_type"];
          version_id: string;
        };
        Insert: {
          deliverable_type: Database["public"]["Enums"]["deliverable_type"];
          version_id: string;
        };
        Update: {
          deliverable_type?: Database["public"]["Enums"]["deliverable_type"];
          version_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "template_version_specs_version_id_fkey";
            columns: ["version_id"];
            isOneToOne: true;
            referencedRelation: "method_asset_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      validation_criteria: {
        Row: {
          captured_at: string;
          criterion_id: string;
          engagement_id: string;
          note: string;
          note_updated_at: string | null;
          note_updated_by: string | null;
          validation_relationship_id: string;
        };
        Insert: {
          captured_at?: string;
          criterion_id: string;
          engagement_id: string;
          note?: string;
          note_updated_at?: string | null;
          note_updated_by?: string | null;
          validation_relationship_id: string;
        };
        Update: {
          captured_at?: string;
          criterion_id?: string;
          engagement_id?: string;
          note?: string;
          note_updated_at?: string | null;
          note_updated_by?: string | null;
          validation_relationship_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "validation_criteria_criterion_id_fkey";
            columns: ["criterion_id"];
            isOneToOne: false;
            referencedRelation: "acceptance_criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_criteria_engagement_id_fkey";
            columns: ["engagement_id"];
            isOneToOne: false;
            referencedRelation: "engagements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_criteria_note_updated_by_fkey";
            columns: ["note_updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "validation_criteria_validation_relationship_id_fkey";
            columns: ["validation_relationship_id"];
            isOneToOne: false;
            referencedRelation: "architecture_relationships";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation: { Args: Record<PropertyKey, never>; Returns: undefined };
      acknowledge_escalation: { Args: { p_escalation_id: string }; Returns: undefined };
      acknowledge_implementation_escalation: {
        Args: { p_escalation_id: string };
        Returns: undefined;
      };
      add_implementation_checkpoint: {
        Args: {
          p_checkpoint_type: Database["public"]["Enums"]["implementation_checkpoint_type"];
          p_client_visible?: boolean;
          p_element_id: string;
          p_related_approval_id?: string;
          p_related_review_id?: string;
          p_target_on?: string;
          p_title: string;
        };
        Returns: string;
      };
      add_method_application_addendum: {
        Args: { p_application_id: string; p_body: string };
        Returns: string;
      };
      add_method_version_learning_source: {
        Args: { p_application_id: string; p_note: string; p_version_id: string };
        Returns: undefined;
      };
      add_review_participant: {
        Args: {
          p_engagement_member_id: string;
          p_review_element_id: string;
          p_role?: Database["public"]["Enums"]["review_participant_role"];
        };
        Returns: string;
      };
      adopt_legacy_method_asset: {
        Args: {
          p_asset_id: string;
          p_category_key?: string;
          p_form: Database["public"]["Enums"]["method_asset_form"];
        };
        Returns: string;
      };
      agree_acceptance_criterion: {
        Args: {
          p_agreed_on: string;
          p_agreed_with: string;
          p_agreement_evidence_source_id?: string;
          p_criterion_id: string;
        };
        Returns: undefined;
      };
      ai_context_criteria: {
        Args: { p_element_id: string; p_engagement_id: string };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ai_context_edge_item: {
        Args: {
          p_element_id: string;
          p_engagement_id: string;
          p_fingerprint: string;
          p_rule_key: string;
        };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ai_context_element: {
        Args: { p_element_id: string; p_engagement_id: string; p_state?: string };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ai_context_evidence: {
        Args: { p_element_id: string; p_engagement_id: string; p_include_summary?: boolean };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ai_context_impact: {
        Args: { p_element_id: string; p_engagement_id: string };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ai_context_implementation: {
        Args: { p_engagement_id: string; p_initiative_element_id: string };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ai_context_intelligence: {
        Args: { p_element_id: string; p_engagement_id: string };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ai_context_relationships: {
        Args: { p_element_id: string; p_engagement_id: string };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ai_context_review: {
        Args: { p_engagement_id: string; p_review_element_id: string };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      ai_context_revision: {
        Args: { p_element_id: string; p_engagement_id: string; p_version_id?: string };
        Returns: Database["public"]["CompositeTypes"]["ai_context_row"][];
        SetofOptions: {
          from: "*";
          to: "ai_context_row";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      allocate_payment: {
        Args: { p_amount_minor: number; p_invoice_id: string; p_payment_id: string };
        Returns: string;
      };
      approve_change_order: { Args: { p_change_order_id: string }; Returns: undefined };
      architecture_activity: {
        Args: { p_element_id?: string; p_engagement_id: string; p_limit?: number };
        Returns: {
          actor_name: string;
          actor_user_id: string;
          created_at: string;
          details: Json;
          element_id: string;
          entity_id: string;
          entity_type: string;
          event: string;
          id: number;
          related_element_id: string;
        }[];
      };
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
      architecture_inference_detail: {
        Args: { p_engagement_id: string; p_inference_id: string };
        Returns: Json;
      };
      architecture_inference_state: {
        Args: { p_engagement_id: string; p_inference_id?: string };
        Returns: {
          inference_id: string;
          inference_kind: string;
          stale_reasons: string[];
          state: string;
        }[];
      };
      architecture_intelligence_availability: {
        Args: { p_engagement_id: string; p_kind: string; p_subject: Json };
        Returns: {
          latest_inference_id: string;
          latest_judged_at: string;
          latest_judgment_kind: string;
          latest_state: string;
          reason: string;
          rule_holds: boolean;
          suppressed: boolean;
        }[];
      };
      architecture_intelligence_budget: {
        Args: { p_engagement_id: string };
        Returns: {
          month_requests: number;
          month_started_at: string;
          month_to_date_usd: number;
          monthly_budget_usd: number;
        }[];
      };
      architecture_intelligence_standing: {
        Args: { p_engagement_id: string };
        Returns: {
          authorization_id: string;
          authorization_state: string;
          can_authorize: boolean;
          can_use: boolean;
          data_classes: string[];
          data_origin: string;
          engagement_status: string;
          monthly_budget_usd: number;
          processing_region: string;
          provider_key: string;
        }[];
      };
      assign_member_area: {
        Args: {
          p_domain?: Database["public"]["Enums"]["architecture_domain"];
          p_element_id?: string;
          p_member_id: string;
        };
        Returns: string;
      };
      attach_deliverable_file: {
        Args: { p_element_id: string; p_file_ids: string[] };
        Returns: undefined;
      };
      attach_method_version_file: {
        Args: {
          p_content_type: string;
          p_file_name: string;
          p_size_bytes: number;
          p_version_id: string;
        };
        Returns: string;
      };
      begin_method_application: { Args: { p_application_id: string }; Returns: undefined };
      cancel_review: { Args: { p_element_id: string; p_reason: string }; Returns: undefined };
      capability_side: {
        Args: { capability: Database["public"]["Enums"]["engagement_capability"] };
        Returns: Database["public"]["Enums"]["member_side"];
      };
      clear_method_application_stage_note: {
        Args: { p_application_id: string; p_stage_id: string };
        Returns: undefined;
      };
      clear_practice_capability_override: {
        Args: {
          p_capability: Database["public"]["Enums"]["practice_capability"];
          p_membership_id: string;
        };
        Returns: undefined;
      };
      client_acceptance_criteria: {
        Args: { p_engagement_id: string };
        Returns: {
          agreed_on: string;
          body: string;
          criterion_id: string;
          governed_element_id: string;
          governed_reference_code: string;
          governed_title: string;
          reference_code: string;
          state: Database["public"]["Enums"]["acceptance_criterion_state"];
          validation_relationship_ids: string[];
        }[];
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
      client_deliverables: {
        Args: { p_engagement_id: string };
        Returns: {
          confidential: boolean;
          deliverable_type: Database["public"]["Enums"]["deliverable_type"];
          element_id: string;
          published_at: string;
          reference_code: string;
          summary: string;
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
      client_engagement_methodology: {
        Args: { p_engagement_id: string };
        Returns: {
          release_label: string;
          release_title: string;
        }[];
      };
      client_implementation: {
        Args: { p_engagement_id: string };
        Returns: {
          actual_operational_on: string;
          category: string;
          checkpoints: Json;
          element_id: string;
          implementation_status: Database["public"]["Enums"]["implementation_status"];
          published_at: string;
          reference_code: string;
          summary: string;
          target_operational_on: string;
          title: string;
          version_id: string;
        }[];
      };
      client_reviews: {
        Args: { p_engagement_id: string };
        Returns: {
          element_id: string;
          held_at: string;
          published_at: string;
          reference_code: string;
          review_status: Database["public"]["Enums"]["review_status"];
          review_type: Database["public"]["Enums"]["review_type"];
          scheduled_for: string;
          summary: string;
          title: string;
          version_id: string;
        }[];
      };
      close_client_action: { Args: { p_action_id: string; p_note?: string }; Returns: undefined };
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
      complete_method_application: {
        Args: {
          p_application_id: string;
          p_completion_statement: string;
          p_retrospective?: string;
        };
        Returns: undefined;
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
      create_dam_release: {
        Args: { p_summary?: string; p_title: string; p_version_label: string };
        Returns: string;
      };
      create_deliverable: {
        Args: {
          p_baseline_id?: string;
          p_confidential?: boolean;
          p_deliverable_type: Database["public"]["Enums"]["deliverable_type"];
          p_engagement_id: string;
          p_summary?: string;
          p_title: string;
        };
        Returns: string;
      };
      create_development_context: {
        Args: { p_definition: string; p_key: string; p_label: string };
        Returns: string;
      };
      create_implementation_initiative: {
        Args: {
          p_category?: string;
          p_engagement_id: string;
          p_implements_element_ids: string[];
          p_owner_member_id?: string;
          p_summary?: string;
          p_target_operational_on?: string;
          p_title: string;
        };
        Returns: string;
      };
      create_method_asset: {
        Args: {
          p_category_key: string;
          p_form: Database["public"]["Enums"]["method_asset_form"];
          p_key: string;
          p_origin?: Database["public"]["Enums"]["method_asset_origin"];
          p_steward_user_id?: string;
          p_title: string;
        };
        Returns: string;
      };
      create_method_asset_version: { Args: { p_asset_id: string }; Returns: string };
      create_review: {
        Args: {
          p_baseline_id?: string;
          p_engagement_id: string;
          p_review_type: Database["public"]["Enums"]["review_type"];
          p_scheduled_for?: string;
          p_summary?: string;
          p_title: string;
        };
        Returns: string;
      };
      criteria_in_force: {
        Args: { p_initiative_element_id: string };
        Returns: {
          agreed_on: string | null;
          agreed_recorded_at: string | null;
          agreed_recorded_by: string | null;
          agreed_with: string | null;
          agreement_evidence_source_id: string | null;
          body: string;
          client_visible: boolean;
          closed_at: string | null;
          closure_reason: string | null;
          created_at: string;
          created_by: string | null;
          engagement_id: string;
          governed_element_id: string;
          governed_kind: Database["public"]["Enums"]["element_kind"];
          id: string;
          informing_criterion_key: string | null;
          informing_standard_version_id: string | null;
          reference_code: string;
          state: Database["public"]["Enums"]["acceptance_criterion_state"];
          supersedes_criterion_id: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "acceptance_criteria";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      current_architecture_inference: {
        Args: {
          p_engagement_id: string;
          p_kind: string;
          p_prompt_version: string;
          p_provider_key: string;
          p_requested_model: string;
          p_subject: Json;
          p_tool_contract_version: string;
        };
        Returns: {
          inference_id: string;
          resolved_model: string;
        }[];
      };
      decide_decision: {
        Args: { p_decision_id: string; p_note?: string; p_option_id: string };
        Returns: undefined;
      };
      defer_decision: { Args: { p_decision_id: string; p_reason: string }; Returns: undefined };
      delete_acceptance_criterion: { Args: { p_criterion_id: string }; Returns: undefined };
      delete_dam_release: { Args: { p_release_id: string }; Returns: undefined };
      delete_method_asset_version: { Args: { p_version_id: string }; Returns: undefined };
      deliverable_register: {
        Args: { p_engagement_id?: string };
        Returns: {
          approval_state: string;
          baseline_id: string;
          client_visibility: Database["public"]["Enums"]["client_visibility"];
          confidential: boolean;
          created_at: string;
          deliverable_type: Database["public"]["Enums"]["deliverable_type"];
          element_id: string;
          engagement_id: string;
          latest_version_id: string;
          lifecycle: Database["public"]["Enums"]["element_lifecycle"];
          reference_code: string;
          summary: string;
          title: string;
          updated_at: string;
        }[];
      };
      development_changes: {
        Args: {
          p_element_id?: string;
          p_engagement_id: string;
          p_limit?: number;
          p_since?: string;
          p_until?: string;
        };
        Returns: {
          actor_name: string;
          change_type: string;
          occurred_at: string;
          reference_code: string;
          related_id: string;
          related_reference_code: string;
          related_type: string;
          subject_id: string;
          subject_kind: string;
          subject_type: string;
          summary: string;
          title: string;
          version_id: string;
          version_no: number;
        }[];
      };
      discontinue_method_application: {
        Args: { p_application_id: string; p_reason: string };
        Returns: undefined;
      };
      dismiss_implementation_signal: {
        Args: {
          p_element_id: string;
          p_engagement_id: string;
          p_expires_on?: string;
          p_fingerprint: string;
          p_reason: string;
        };
        Returns: string;
      };
      dismiss_intelligence_signal: {
        Args: {
          p_client_action_id: string;
          p_element_id: string;
          p_engagement_id: string;
          p_expires_on?: string;
          p_fingerprint: string;
          p_reason: string;
          p_rule_key: string;
        };
        Returns: string;
      };
      edge_items: {
        Args: {
          p_as_of?: string;
          p_engagement_id: string;
          p_include_judged?: boolean;
          p_subject_id?: string;
          p_subject_type?: string;
        };
        Returns: {
          basis: Json;
          consequence_path: Json;
          details: Json;
          epistemic_status: string;
          fingerprint: string;
          home: string;
          item_key: string;
          judged: boolean;
          judged_at: string;
          judged_by: string;
          judged_by_name: string;
          judgment_expires_on: string;
          judgment_kind: string;
          judgment_reason: string;
          judgment_source: string;
          lens: string;
          order_facts: Json;
          producer: string;
          promotion_target_code: string;
          promotion_target_id: string;
          promotion_target_kind: string;
          resolving_act: string;
          rule_key: string;
          subject_id: string;
          subject_kind: string;
          subject_reference_code: string;
          subject_title: string;
          subject_type: string;
          tier: string;
          tier_reason: string;
          trigger_at: string;
          trigger_key: string;
          trigger_reference_code: string;
          trigger_subject_id: string;
          trigger_title: string;
          trigger_type: string;
          trigger_version_id: string;
          trigger_version_no: number;
          variant: string;
        }[];
      };
      edge_rule_catalog: {
        Args: Record<PropertyKey, never>;
        Returns: {
          candidate: string;
          epistemic_status: string;
          home: string;
          lens: string;
          list_tier: string;
          origin: string;
          resolving_act: string;
          rule_key: string;
          scope: string;
          subject_type: string;
          substantive_only: boolean;
          thresholds: string;
          time_basis: string;
          trigger_type: string;
        }[];
      };
      element_practice_context: {
        Args: { p_element_id: string };
        Returns: {
          application_code: string;
          application_id: string;
          application_state: Database["public"]["Enums"]["method_application_state"];
          application_title: string;
          asset_id: string;
          asset_title: string;
          form: Database["public"]["Enums"]["method_asset_form"];
          legacy: boolean;
          note: string;
          record_id: string;
          role: string;
          source: string;
          version_id: string;
          version_label: string;
        }[];
      };
      element_reference_prefix: {
        Args: {
          p_domain: Database["public"]["Enums"]["architecture_domain"];
          p_kind: Database["public"]["Enums"]["element_kind"];
        };
        Returns: string;
      };
      element_revisions: {
        Args: { p_element_id?: string; p_engagement_id: string };
        Returns: {
          change_summary: string;
          change_type: string;
          changed_paths: string[];
          element_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          previous_version_id: string;
          published_at: string;
          reference_code: string;
          version_id: string;
          version_no: number;
        }[];
      };
      element_supports_and_exposures: {
        Args: { p_element_id: string; p_engagement_id: string };
        Returns: Json;
      };
      element_version_snapshot: { Args: { p_version_id: string }; Returns: Json };
      engagement_primary_contract_id: { Args: { p_engagement_id: string }; Returns: string };
      escalate_implementation: {
        Args: {
          p_addressee_member_id?: string;
          p_due_on?: string;
          p_element_id: string;
          p_level: Database["public"]["Enums"]["escalation_level"];
          p_reason: string;
        };
        Returns: string;
      };
      escalate_intelligence_record: {
        Args: {
          p_addressee_member_id?: string;
          p_due_on?: string;
          p_element_id: string;
          p_level: Database["public"]["Enums"]["escalation_level"];
          p_reason: string;
        };
        Returns: string;
      };
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
      handle_client_contribution: {
        Args: {
          p_contribution_id: string;
          p_note: string;
          p_record_as_evidence?: boolean;
          p_statement_id?: string;
          p_status: Database["public"]["Enums"]["contribution_status"];
        };
        Returns: string;
      };
      hold_review: {
        Args: { p_element_id: string; p_held_at?: string; p_summary?: string };
        Returns: undefined;
      };
      impact_trace: {
        Args: { p_element_id: string; p_mode?: string };
        Returns: {
          assessment: string;
          category: string;
          depth: number;
          direction: string;
          hub_element_id: string;
          kind: string;
          link_key: string;
          object_type: string;
          path: Json;
          propagation: string;
          reached_id: string;
          reached_type: string;
          reason: string;
          reference_code: string;
          title: string;
          via_element_id: string;
        }[];
      };
      implementation_impact: {
        Args: { p_depth?: number; p_element_id: string };
        Returns: {
          depth: number;
          direction: string;
          element_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          reference_code: string;
          relationship_type: string;
          title: string;
          via_element_id: string;
        }[];
      };
      implementation_register: {
        Args: { p_engagement_id?: string };
        Returns: {
          achieved_checkpoint_count: number;
          actual_operational_on: string;
          attention: Database["public"]["Enums"]["intelligence_attention"];
          category: string;
          checkpoint_count: number;
          client_visibility: Database["public"]["Enums"]["client_visibility"];
          created_at: string;
          element_id: string;
          engagement_id: string;
          implementation_status: Database["public"]["Enums"]["implementation_status"];
          lifecycle: Database["public"]["Enums"]["element_lifecycle"];
          next_review_on: string;
          open_escalations: Database["public"]["Enums"]["escalation_level"][];
          owner_member_id: string;
          reference_code: string;
          summary: string;
          target_operational_on: string;
          title: string;
          triage_state: Database["public"]["Enums"]["triage_state"];
          triaged_at: string;
          updated_at: string;
        }[];
      };
      implementation_signals: {
        Args: { p_as_of?: string; p_engagement_id: string; p_include_dismissed?: boolean };
        Returns: {
          details: Json;
          dismissal_reason: string;
          dismissed: boolean;
          dismissed_at: string;
          element_id: string;
          fingerprint: string;
          reference_code: string;
          rule_key: string;
          title: string;
        }[];
      };
      intelligence_active_statuses: {
        Args: { p_kind: Database["public"]["Enums"]["element_kind"] };
        Returns: string[];
      };
      intelligence_history: {
        Args: { p_element_id: string };
        Returns: {
          actor_name: string;
          changed_at: string;
          field: string;
          from_value: string;
          id: number;
          operation: string;
          rationale: string;
          to_value: string;
        }[];
      };
      intelligence_impact: {
        Args: { p_depth?: number; p_element_id: string };
        Returns: {
          depth: number;
          direction: string;
          element_id: string;
          kind: Database["public"]["Enums"]["element_kind"];
          reference_code: string;
          relationship_type: string;
          title: string;
          via_element_id: string;
        }[];
      };
      intelligence_register: {
        Args: { p_engagement_id?: string };
        Returns: {
          approval_state: string;
          attention: Database["public"]["Enums"]["intelligence_attention"];
          attractiveness: number;
          blocking: boolean;
          category: string;
          client_visibility: Database["public"]["Enums"]["client_visibility"];
          confidence: Database["public"]["Enums"]["confidence_level"];
          created_at: string;
          domains: Database["public"]["Enums"]["architecture_domain"][];
          element_id: string;
          engagement_id: string;
          engagement_wide: boolean;
          feasibility: number;
          impact: number;
          kind: Database["public"]["Enums"]["element_kind"];
          latest_version_id: string;
          lifecycle: Database["public"]["Enums"]["element_lifecycle"];
          needed_by: string;
          negotiable: boolean;
          next_review_on: string;
          open_client_actions: number;
          open_escalations: Database["public"]["Enums"]["escalation_level"][];
          owner_user_id: string;
          priority: Database["public"]["Enums"]["recommendation_priority"];
          probability: number;
          provenance: Database["public"]["Enums"]["provenance_type"];
          reference_code: string;
          severity: number;
          status: string;
          summary: string;
          title: string;
          triage_state: Database["public"]["Enums"]["triage_state"];
          triaged_at: string;
          updated_at: string;
          value: number;
          window_closes_on: string;
          window_opens_on: string;
        }[];
      };
      intelligence_signals: {
        Args: { p_as_of?: string; p_engagement_id: string; p_include_dismissed?: boolean };
        Returns: {
          client_action_id: string;
          details: Json;
          dismissal_reason: string;
          dismissed: boolean;
          dismissed_at: string;
          element_id: string;
          fingerprint: string;
          kind: Database["public"]["Enums"]["element_kind"];
          reference_code: string;
          rule_key: string;
          title: string;
        }[];
      };
      intelligence_terminal_statuses: {
        Args: { p_kind: Database["public"]["Enums"]["element_kind"] };
        Returns: string[];
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
      is_architecture_authority_capability: {
        Args: { capability: Database["public"]["Enums"]["engagement_capability"] };
        Returns: boolean;
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
      keep_architecture_inference: {
        Args: { p_engagement_id: string; p_judgment?: Json; p_request_id: string };
        Returns: string;
      };
      kept_architecture_inferences: {
        Args: { p_engagement_id: string; p_kind?: string; p_state?: string };
        Returns: {
          assertion: string;
          inference_id: string;
          inference_kind: string;
          judged_at: string;
          judgment_kind: string;
          kept_at: string;
          link_id: string;
          link_type: string;
          requested_at: string;
          second_element_id: string;
          second_reference_code: string;
          stale_reasons: string[];
          state: string;
          subject_element_id: string;
          subject_fingerprint: string;
          subject_kind: string;
          subject_reference_code: string;
          subject_rule_key: string;
          subject_title: string;
          subject_type: string;
          subject_version_id: string;
        }[];
      };
      link_method_application_element: {
        Args: {
          p_application_id: string;
          p_element_id: string;
          p_note?: string;
          p_role: Database["public"]["Enums"]["method_application_element_role"];
        };
        Returns: string;
      };
      link_method_application_evidence: {
        Args: {
          p_application_id: string;
          p_evidence_source_id: string;
          p_instrument_version_id?: string;
          p_note?: string;
          p_role: Database["public"]["Enums"]["method_application_evidence_role"];
        };
        Returns: string;
      };
      mark_briefed_through: {
        Args: { p_engagement_id: string; p_through: string };
        Returns: string;
      };
      method_application_register: {
        Args: { p_engagement_id: string };
        Returns: {
          application_id: string;
          asset_id: string;
          asset_title: string;
          closed_on: string;
          element_link_count: number;
          evidence_link_count: number;
          lead_member_id: string;
          reference_code: string;
          started_on: string;
          state: Database["public"]["Enums"]["method_application_state"];
          title: string;
          version_id: string;
          version_in_release: boolean;
          version_label: string;
        }[];
      };
      method_library: {
        Args: Record<PropertyKey, never>;
        Returns: {
          application_count: number;
          architectural_question: string;
          asset_id: string;
          category_key: string;
          context_keys: string[];
          current_version_id: string;
          domains: Database["public"]["Enums"]["architecture_domain"][];
          form: Database["public"]["Enums"]["method_asset_form"];
          has_draft: boolean;
          key: string;
          lineage_count: number;
          origin: Database["public"]["Enums"]["method_asset_origin"];
          release_labels: string[];
          status: string;
          title: string;
          version_label: string;
          version_lifecycle: Database["public"]["Enums"]["method_asset_version_lifecycle"];
        }[];
      };
      method_practice_counts: {
        Args: { p_asset_id: string };
        Returns: {
          count: number;
          measure: string;
          min_n: number;
          n: number;
          other_asset_title: string;
          other_version_id: string;
          other_version_label: string;
          proportion: number;
          stage_key: string;
          stage_ordinal: number;
          stage_title: string;
          treatment: string;
          version_id: string;
          version_label: string;
        }[];
      };
      method_usage: {
        Args: { p_asset_id: string };
        Returns: {
          application_count: number;
          applications: Json;
          legacy: boolean;
          lifecycle: Database["public"]["Enums"]["method_asset_version_lifecycle"];
          lineage: Json;
          lineage_count: number;
          release_labels: string[];
          version_id: string;
          version_label: string;
          version_no: number;
        }[];
      };
      method_version_publish_gaps: { Args: { p_version_id: string }; Returns: string[] };
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
      my_practice_capabilities: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["practice_capability"][];
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
      practice_capability_matrix: {
        Args: Record<PropertyKey, never>;
        Returns: {
          capability: Database["public"]["Enums"]["practice_capability"];
          effective: boolean;
          organization_member_id: string;
          override_granted: boolean;
          override_reason: string;
          role: Database["public"]["Enums"]["app_role"];
          role_default: boolean;
          status: Database["public"]["Enums"]["record_status"];
          user_id: string;
        }[];
      };
      preview_client_snapshot: { Args: { p_element_id: string }; Returns: Json };
      propose_acceptance_criterion: {
        Args: {
          p_body: string;
          p_client_visible?: boolean;
          p_element_id: string;
          p_informing_criterion_key?: string;
          p_informing_standard_version_id?: string;
        };
        Returns: string;
      };
      publish_dam_release: {
        Args: { p_change_summary?: string; p_effective_on?: string; p_release_id: string };
        Returns: undefined;
      };
      publish_element_version: {
        Args: { p_change_summary?: string; p_element_id: string };
        Returns: string;
      };
      publish_method_asset_version: {
        Args: {
          p_change_summary?: string;
          p_effective_on?: string;
          p_version_id: string;
          p_version_label: string;
        };
        Returns: undefined;
      };
      reassign_client_action: {
        Args: { p_action_id: string; p_member_id: string; p_note?: string };
        Returns: undefined;
      };
      record_architecture_inference_judgment: {
        Args: {
          p_engagement_id: string;
          p_expires_on?: string;
          p_inference_id: string;
          p_kind: string;
          p_promotion_target_id?: string;
          p_promotion_target_kind?: string;
          p_reason?: string;
        };
        Returns: string;
      };
      record_architecture_intelligence_request: {
        Args: { p_engagement_id: string; p_inference?: Json; p_request: Json };
        Returns: string;
      };
      record_architecture_intelligence_request_for: {
        Args: {
          p_engagement_id: string;
          p_inference?: Json;
          p_request: Json;
          p_requested_by: string;
        };
        Returns: string;
      };
      record_checkpoint_achieved: {
        Args: {
          p_achieved_evidence_source_id?: string;
          p_achieved_on?: string;
          p_checkpoint_id: string;
        };
        Returns: undefined;
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
      record_edge_event_judgment: {
        Args: {
          p_engagement_id: string;
          p_expires_on?: string;
          p_kind: string;
          p_reason?: string;
          p_trigger_key: string;
        };
        Returns: number;
      };
      record_edge_judgment: {
        Args: {
          p_engagement_id: string;
          p_expires_on?: string;
          p_fingerprint: string;
          p_kind: string;
          p_promotion_target_id?: string;
          p_promotion_target_kind?: string;
          p_reason?: string;
          p_rule_key: string;
          p_subject_id: string;
          p_subject_type: string;
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
      record_method_lineage: {
        Args: {
          p_element_id: string;
          p_method_version_id: string;
          p_note?: string;
          p_role: Database["public"]["Enums"]["method_lineage_role"];
        };
        Returns: string;
      };
      record_method_rights_holder: {
        Args: {
          p_agreement_reference?: string;
          p_asset_id: string;
          p_effective_on?: string;
          p_external_holder_name: string;
          p_holder_role: Database["public"]["Enums"]["method_rights_role"];
          p_note?: string;
          p_organization_id: string;
        };
        Returns: string;
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
      record_response_as_evidence: {
        Args: {
          p_response_id: string;
          p_stance?: Database["public"]["Enums"]["evidence_stance"];
          p_statement_id?: string;
          p_title?: string;
        };
        Returns: string;
      };
      record_review_validation: {
        Args: { p_initiative_element_id: string; p_review_element_id: string };
        Returns: string;
      };
      register_engagement_file: {
        Args: {
          p_content_type: string;
          p_engagement_id: string;
          p_evidence_source_id?: string;
          p_filename: string;
          p_purpose: Database["public"]["Enums"]["engagement_file_purpose"];
          p_size_bytes: number;
        };
        Returns: {
          file_id: string;
          object_path: string;
        }[];
      };
      reject_change_order: {
        Args: { p_change_order_id: string; p_note: string };
        Returns: undefined;
      };
      remove_dam_release_member: {
        Args: { p_asset_id: string; p_release_id: string };
        Returns: undefined;
      };
      remove_member_area: { Args: { p_area_id: string }; Returns: undefined };
      remove_method_application_asset: {
        Args: { p_application_id: string; p_asset_version_id: string };
        Returns: undefined;
      };
      remove_method_lineage: { Args: { p_lineage_id: string }; Returns: undefined };
      remove_method_version_file: { Args: { p_file_id: string }; Returns: string };
      remove_method_version_learning_source: {
        Args: { p_application_id: string; p_version_id: string };
        Returns: undefined;
      };
      reopen_implementation_initiative: {
        Args: { p_element_id: string; p_rationale: string };
        Returns: undefined;
      };
      reopen_intelligence_record: {
        Args: { p_element_id: string; p_rationale: string; p_status: string };
        Returns: undefined;
      };
      request_architecture_approval: {
        Args: { p_baseline_id: string; p_element_version_id: string; p_note?: string };
        Returns: string;
      };
      resolve_escalation: { Args: { p_escalation_id: string; p_note: string }; Returns: undefined };
      resolve_implementation_escalation: {
        Args: { p_escalation_id: string; p_note: string };
        Returns: undefined;
      };
      resolve_implementation_initiative: {
        Args: {
          p_change_summary?: string;
          p_element_id: string;
          p_publish?: boolean;
          p_rationale: string;
          p_status: Database["public"]["Enums"]["implementation_status"];
        };
        Returns: string;
      };
      resolve_intelligence_record: {
        Args: {
          p_change_summary?: string;
          p_element_id: string;
          p_publish?: boolean;
          p_rationale: string;
          p_status: string;
        };
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
      respond_to_client_action: {
        Args: { p_action_id: string; p_body: string; p_file_ids?: string[]; p_link_url?: string };
        Returns: string;
      };
      retire_dam_release: { Args: { p_reason: string; p_release_id: string }; Returns: undefined };
      retire_development_context: {
        Args: { p_context_id: string; p_reason: string };
        Returns: undefined;
      };
      retire_element: { Args: { p_element_id: string; p_reason: string }; Returns: undefined };
      retire_method_asset: { Args: { p_asset_id: string; p_reason: string }; Returns: undefined };
      retire_method_asset_version: {
        Args: { p_reason: string; p_version_id: string };
        Returns: undefined;
      };
      retire_relationship: {
        Args: { p_reason: string; p_relationship_id: string };
        Returns: undefined;
      };
      return_client_action: { Args: { p_action_id: string; p_note: string }; Returns: undefined };
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
      review_dossier: { Args: { p_engagement_id: string; p_review_id: string }; Returns: Json };
      review_register: {
        Args: { p_engagement_id?: string };
        Returns: {
          agenda_count: number;
          baseline_id: string;
          client_visibility: Database["public"]["Enums"]["client_visibility"];
          created_at: string;
          element_id: string;
          engagement_id: string;
          held_at: string;
          lifecycle: Database["public"]["Enums"]["element_lifecycle"];
          participant_count: number;
          reference_code: string;
          review_status: Database["public"]["Enums"]["review_status"];
          review_type: Database["public"]["Enums"]["review_type"];
          scheduled_for: string;
          summary: string;
          title: string;
          updated_at: string;
        }[];
      };
      revise_development_context: {
        Args: { p_context_id: string; p_definition: string; p_label: string; p_reason: string };
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
      send_client_action: {
        Args: {
          p_addressee_member_id: string;
          p_due_on?: string;
          p_engagement_id: string;
          p_kind: Database["public"]["Enums"]["client_action_kind"];
          p_request: string;
          p_subject_ids?: string[];
          p_title: string;
        };
        Returns: string;
      };
      set_contract_status: {
        Args: { p_contract_id: string; p_status: Database["public"]["Enums"]["contract_status"] };
        Returns: undefined;
      };
      set_dam_release_member: {
        Args: { p_asset_version_id: string; p_release_id: string };
        Returns: undefined;
      };
      set_decision_recommendation: {
        Args: { p_decision_id: string; p_option_id: string; p_rationale: string };
        Returns: undefined;
      };
      set_engagement_ai_authorization: {
        Args: {
          p_basis_kind?: string;
          p_basis_note?: string;
          p_basis_reference?: string;
          p_data_classes?: string[];
          p_effective_from?: string;
          p_engagement_id: string;
          p_monthly_budget_usd?: number;
          p_processing_region?: string;
          p_provider_key?: string;
          p_state: string;
        };
        Returns: {
          authorized_at: string;
          authorized_by: string;
          basis_kind: string | null;
          basis_note: string | null;
          basis_reference: string | null;
          data_classes: string[];
          effective_from: string;
          engagement_id: string;
          id: string;
          monthly_budget_usd: number | null;
          processing_region: string | null;
          provider_key: string | null;
          sequence_no: number;
          state: string;
        };
        SetofOptions: {
          from: "*";
          to: "engagement_ai_authorizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_engagement_dam_release: {
        Args: { p_engagement_id: string; p_reason: string; p_release_id: string };
        Returns: undefined;
      };
      set_engagement_development_contexts: {
        Args: { p_context_ids: string[]; p_engagement_id: string; p_primary_context_id: string };
        Returns: undefined;
      };
      set_instrument_version_evidence_types: {
        Args: {
          p_types: Database["public"]["Enums"]["evidence_source_type"][];
          p_version_id: string;
        };
        Returns: undefined;
      };
      set_method_application_asset: {
        Args: { p_application_id: string; p_asset_version_id: string; p_deviation_note?: string };
        Returns: undefined;
      };
      set_method_application_contexts: {
        Args: { p_application_id: string; p_context_ids: string[] };
        Returns: undefined;
      };
      set_method_application_domains: {
        Args: {
          p_application_id: string;
          p_domains: Database["public"]["Enums"]["architecture_domain"][];
        };
        Returns: undefined;
      };
      set_method_application_practitioners: {
        Args: { p_application_id: string; p_practitioners: Json };
        Returns: undefined;
      };
      set_method_application_stage_note: {
        Args: {
          p_application_id: string;
          p_note: string;
          p_reason: string;
          p_stage_id: string;
          p_treatment: Database["public"]["Enums"]["method_stage_treatment"];
        };
        Returns: undefined;
      };
      set_method_asset_origin: {
        Args: {
          p_asset_id: string;
          p_origin: Database["public"]["Enums"]["method_asset_origin"];
          p_reason: string;
        };
        Returns: undefined;
      };
      set_method_version_components: {
        Args: { p_components: Json; p_version_id: string };
        Returns: undefined;
      };
      set_method_version_contexts: {
        Args: { p_context_ids: string[]; p_version_id: string };
        Returns: undefined;
      };
      set_method_version_domains: {
        Args: {
          p_domains: Database["public"]["Enums"]["architecture_domain"][];
          p_version_id: string;
        };
        Returns: undefined;
      };
      set_method_version_outputs: {
        Args: { p_outputs: Json; p_version_id: string };
        Returns: undefined;
      };
      set_method_version_stages: {
        Args: { p_stages: Json; p_version_id: string };
        Returns: undefined;
      };
      set_milestone_status: {
        Args: { p_milestone_id: string; p_status: Database["public"]["Enums"]["milestone_status"] };
        Returns: undefined;
      };
      set_practice_capability_override: {
        Args: {
          p_capability: Database["public"]["Enums"]["practice_capability"];
          p_granted: boolean;
          p_membership_id: string;
          p_reason: string;
        };
        Returns: string;
      };
      set_standard_version_criteria: {
        Args: { p_criteria: Json; p_version_id: string };
        Returns: undefined;
      };
      set_standard_version_judged_in: {
        Args: { p_settings: string[]; p_version_id: string };
        Returns: undefined;
      };
      set_template_version_spec: {
        Args: {
          p_deliverable_type: Database["public"]["Enums"]["deliverable_type"];
          p_sections: Json;
          p_version_id: string;
        };
        Returns: undefined;
      };
      set_validation_criterion_note: {
        Args: { p_criterion_id: string; p_note: string; p_validation_relationship_id: string };
        Returns: undefined;
      };
      start_method_application: {
        Args: {
          p_architectural_question?: string;
          p_continues_application_id?: string;
          p_engagement_id: string;
          p_lead_member_id?: string;
          p_method_version_id: string;
          p_outside_release_reason?: string;
          p_selection_reason: string;
          p_title: string;
        };
        Returns: string;
      };
      submit_change_order: { Args: { p_change_order_id: string }; Returns: number };
      submit_client_contribution: {
        Args: { p_body: string; p_element_id: string; p_file_ids?: string[]; p_link_url?: string };
        Returns: string;
      };
      submit_element_for_review: { Args: { p_element_id: string }; Returns: undefined };
      suggested_interpretations: {
        Args: { p_engagement_id: string };
        Returns: {
          assertion: string;
          governance_date: string;
          inference_id: string;
          inference_kind: string;
          judged_at: string;
          judgment_kind: string;
          kept_at: string;
          link_id: string;
          link_type: string;
          requested_at: string;
          second_element_id: string;
          second_reference_code: string;
          second_title: string;
          subject_element_id: string;
          subject_kind: string;
          subject_reference_code: string;
          subject_title: string;
          subject_type: string;
        }[];
      };
      supersede_acceptance_criterion: {
        Args: {
          p_agreed_on?: string;
          p_agreed_with?: string;
          p_agreement_evidence_source_id?: string;
          p_criterion_id: string;
          p_new_body: string;
          p_reason: string;
        };
        Returns: string;
      };
      supersede_element: {
        Args: { p_new_element_id: string; p_old_element_id: string; p_reason: string };
        Returns: string;
      };
      supersede_method_rights_holder: {
        Args: {
          p_reason: string;
          p_replacement_agreement_reference?: string;
          p_replacement_effective_on?: string;
          p_replacement_external_holder_name?: string;
          p_replacement_holder_role?: Database["public"]["Enums"]["method_rights_role"];
          p_replacement_note?: string;
          p_replacement_organization_id?: string;
          p_rights_holder_id: string;
        };
        Returns: string;
      };
      triage_implementation: {
        Args: {
          p_attention: Database["public"]["Enums"]["intelligence_attention"];
          p_element_id: string;
          p_next_review_on?: string;
          p_note?: string;
        };
        Returns: undefined;
      };
      triage_intelligence_record: {
        Args: {
          p_attention: Database["public"]["Enums"]["intelligence_attention"];
          p_element_id: string;
          p_next_review_on?: string;
          p_note?: string;
        };
        Returns: undefined;
      };
      unlink_method_application_element: { Args: { p_link_id: string }; Returns: undefined };
      unlink_method_application_evidence: { Args: { p_link_id: string }; Returns: undefined };
      update_acceptance_criterion: {
        Args: {
          p_body: string;
          p_client_visible?: boolean;
          p_criterion_id: string;
          p_informing_criterion_key?: string;
          p_informing_standard_version_id?: string;
        };
        Returns: undefined;
      };
      update_dam_release: {
        Args: {
          p_change_summary: string;
          p_release_id: string;
          p_summary: string;
          p_title: string;
        };
        Returns: undefined;
      };
      update_implementation_status: {
        Args: {
          p_change_summary?: string;
          p_element_id: string;
          p_publish?: boolean;
          p_rationale?: string;
          p_status: Database["public"]["Enums"]["implementation_status"];
        };
        Returns: string;
      };
      update_method_application: {
        Args: {
          p_application_id: string;
          p_architectural_question: string;
          p_engagement_wide: boolean;
          p_selection_reason: string;
          p_title: string;
        };
        Returns: undefined;
      };
      update_method_asset: {
        Args: {
          p_asset_id: string;
          p_category_key: string;
          p_form?: Database["public"]["Enums"]["method_asset_form"];
          p_steward_user_id: string;
          p_title: string;
          p_usage_restriction: string;
        };
        Returns: undefined;
      };
      update_method_asset_version: {
        Args: { p_content: Json; p_version_id: string };
        Returns: undefined;
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
      withdraw_acceptance_criterion: {
        Args: { p_criterion_id: string; p_reason: string };
        Returns: undefined;
      };
      withdraw_client_action: { Args: { p_action_id: string; p_note: string }; Returns: undefined };
    };
    Enums: {
      acceptance_criterion_state: "proposed" | "agreed" | "superseded" | "withdrawn";
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
      client_action_kind:
        | "question"
        | "information_request"
        | "confirmation"
        | "review_request"
        | "executive_attention";
      client_action_status: "open" | "responded" | "closed" | "withdrawn";
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
      contribution_status: "received" | "incorporated" | "acknowledged";
      credit_note_status: "draft" | "issued" | "void";
      dam_release_status: "draft" | "published" | "superseded" | "retired";
      decision_status: "open" | "recommended" | "decided" | "deferred" | "superseded";
      deliverable_type:
        | "full_architecture_blueprint"
        | "executive_strategy_deck"
        | "capability_map"
        | "implementation_framework"
        | "measurement_model"
        | "executive_summary"
        | "other";
      dependency_status: "open" | "satisfied" | "at_risk" | "broken";
      dependency_type: "prerequisite" | "sequence" | "input" | "funding" | "external";
      element_kind:
        | "object"
        | "assumption"
        | "risk"
        | "constraint"
        | "dependency"
        | "decision"
        | "recommendation"
        | "opportunity"
        | "review"
        | "deliverable"
        | "implementation_initiative";
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
        | "view_architecture"
        | "manage_client_requests"
        | "view_full_architecture"
        | "respond_to_client_actions"
        | "assign_client_actions"
        | "submit_client_input"
        | "manage_reviews"
        | "manage_deliverables"
        | "manage_implementation"
        | "use_architecture_intelligence"
        | "authorize_external_ai_processing";
      engagement_file_purpose:
        "client_response" | "client_contribution" | "evidence" | "deliverable";
      engagement_status: "proposed" | "active" | "paused" | "completed" | "archived";
      engagement_type:
        | "development_architecture_sprint"
        | "development_architecture_intensive"
        | "embedded_development_partner"
        | "cohort"
        | "custom";
      escalation_level: "principal_architect" | "client_executive";
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
      implementation_checkpoint_type:
        | "design_approved"
        | "agreement_executed"
        | "operational_entry"
        | "scheduled_review"
        | "other";
      implementation_status:
        "not_started" | "in_progress" | "operational" | "validated" | "stalled" | "abandoned";
      intelligence_attention: "critical" | "high" | "routine" | "watch";
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
      method_application_element_role: "examined" | "produced" | "revised" | "informed";
      method_application_evidence_role: "drew_on" | "gathered";
      method_application_state: "planned" | "in_progress" | "completed" | "discontinued";
      method_asset_form: "method" | "model" | "standard" | "instrument" | "template";
      method_asset_origin:
        "tplco_developed" | "co_developed" | "client_owned" | "licensed_in" | "third_party";
      method_asset_version_lifecycle: "draft" | "published" | "superseded" | "retired";
      method_identity_disclosure: "internal_only" | "may_be_named";
      method_lineage_role:
        "instantiates" | "produced_from" | "judged_against" | "legacy_derived_from";
      method_rights_role: "owner" | "co_owner" | "licensor" | "contributor";
      method_stage_treatment: "followed" | "adapted" | "skipped";
      milestone_status: "planned" | "ready_to_invoice" | "invoiced" | "cancelled";
      milestone_trigger: "on_signing" | "on_date" | "on_event" | "manual";
      opportunity_status:
        "identified" | "evaluating" | "pursuing" | "realized" | "declined" | "lapsed";
      organization_type: "tplco" | "client" | "licensed_practice";
      payment_method: "ach" | "wire" | "check" | "card_via_processor" | "other";
      payment_status: "recorded" | "reversed";
      payment_structure: "milestone" | "installments" | "percentage" | "retainer" | "custom";
      practice_capability: "author_methodology" | "publish_methodology";
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
      review_participant_role: "organizer" | "reviewer" | "presenter" | "attendee";
      review_status: "scheduled" | "held" | "cancelled";
      review_type: "executive_review" | "architecture_review";
      risk_status: "open" | "mitigating" | "accepted" | "closed" | "materialized";
      skill_proficiency: "foundational" | "proficient" | "expert";
      statement_kind:
        | "finding"
        | "observation"
        | "rationale"
        | "implication"
        | "definition"
        | "note"
        | "approach";
      triage_state: "untriaged" | "triaged";
      validation_status: "unvalidated" | "validating" | "validated" | "invalidated";
    };
    CompositeTypes: {
      ai_context_row: {
        record_type: string | null;
        record_id: string | null;
        version_id: string | null;
        anchor_id: string | null;
        variant: string | null;
        data_class: string | null;
        withheld: boolean | null;
        withheld_reason: string | null;
        digest: string | null;
        content: Json | null;
      };
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
      acceptance_criterion_state: ["proposed", "agreed", "superseded", "withdrawn"],
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
      client_action_kind: [
        "question",
        "information_request",
        "confirmation",
        "review_request",
        "executive_attention",
      ],
      client_action_status: ["open", "responded", "closed", "withdrawn"],
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
      contribution_status: ["received", "incorporated", "acknowledged"],
      credit_note_status: ["draft", "issued", "void"],
      dam_release_status: ["draft", "published", "superseded", "retired"],
      decision_status: ["open", "recommended", "decided", "deferred", "superseded"],
      deliverable_type: [
        "full_architecture_blueprint",
        "executive_strategy_deck",
        "capability_map",
        "implementation_framework",
        "measurement_model",
        "executive_summary",
        "other",
      ],
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
        "opportunity",
        "review",
        "deliverable",
        "implementation_initiative",
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
        "manage_client_requests",
        "view_full_architecture",
        "respond_to_client_actions",
        "assign_client_actions",
        "submit_client_input",
        "manage_reviews",
        "manage_deliverables",
        "manage_implementation",
        "use_architecture_intelligence",
        "authorize_external_ai_processing",
      ],
      engagement_file_purpose: [
        "client_response",
        "client_contribution",
        "evidence",
        "deliverable",
      ],
      engagement_status: ["proposed", "active", "paused", "completed", "archived"],
      engagement_type: [
        "development_architecture_sprint",
        "development_architecture_intensive",
        "embedded_development_partner",
        "cohort",
        "custom",
      ],
      escalation_level: ["principal_architect", "client_executive"],
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
      implementation_checkpoint_type: [
        "design_approved",
        "agreement_executed",
        "operational_entry",
        "scheduled_review",
        "other",
      ],
      implementation_status: [
        "not_started",
        "in_progress",
        "operational",
        "validated",
        "stalled",
        "abandoned",
      ],
      intelligence_attention: ["critical", "high", "routine", "watch"],
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
      method_application_element_role: ["examined", "produced", "revised", "informed"],
      method_application_evidence_role: ["drew_on", "gathered"],
      method_application_state: ["planned", "in_progress", "completed", "discontinued"],
      method_asset_form: ["method", "model", "standard", "instrument", "template"],
      method_asset_origin: [
        "tplco_developed",
        "co_developed",
        "client_owned",
        "licensed_in",
        "third_party",
      ],
      method_asset_version_lifecycle: ["draft", "published", "superseded", "retired"],
      method_identity_disclosure: ["internal_only", "may_be_named"],
      method_lineage_role: [
        "instantiates",
        "produced_from",
        "judged_against",
        "legacy_derived_from",
      ],
      method_rights_role: ["owner", "co_owner", "licensor", "contributor"],
      method_stage_treatment: ["followed", "adapted", "skipped"],
      milestone_status: ["planned", "ready_to_invoice", "invoiced", "cancelled"],
      milestone_trigger: ["on_signing", "on_date", "on_event", "manual"],
      opportunity_status: [
        "identified",
        "evaluating",
        "pursuing",
        "realized",
        "declined",
        "lapsed",
      ],
      organization_type: ["tplco", "client", "licensed_practice"],
      payment_method: ["ach", "wire", "check", "card_via_processor", "other"],
      payment_status: ["recorded", "reversed"],
      payment_structure: ["milestone", "installments", "percentage", "retainer", "custom"],
      practice_capability: ["author_methodology", "publish_methodology"],
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
      review_participant_role: ["organizer", "reviewer", "presenter", "attendee"],
      review_status: ["scheduled", "held", "cancelled"],
      review_type: ["executive_review", "architecture_review"],
      risk_status: ["open", "mitigating", "accepted", "closed", "materialized"],
      skill_proficiency: ["foundational", "proficient", "expert"],
      statement_kind: [
        "finding",
        "observation",
        "rationale",
        "implication",
        "definition",
        "note",
        "approach",
      ],
      triage_state: ["untriaged", "triaged"],
      validation_status: ["unvalidated", "validating", "validated", "invalidated"],
    },
  },
} as const;
