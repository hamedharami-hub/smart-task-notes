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
      abc_records: {
        Row: {
          belief: string
          consequences: string[] | null
          created_at: string
          duration_minutes: number | null
          id: string
          regret_level: number | null
          trigger: string
          user_id: string
        }
        Insert: {
          belief: string
          consequences?: string[] | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          regret_level?: number | null
          trigger: string
          user_id: string
        }
        Update: {
          belief?: string
          consequences?: string[] | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          regret_level?: number | null
          trigger?: string
          user_id?: string
        }
        Relationships: []
      }
      about_me: {
        Row: {
          ai_analysis: Json | null
          ai_suggestions: Json | null
          analyzed_at: string | null
          answers: Json
          created_at: string
          free_text: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis?: Json | null
          ai_suggestions?: Json | null
          analyzed_at?: string | null
          answers?: Json
          created_at?: string
          free_text?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis?: Json | null
          ai_suggestions?: Json | null
          analyzed_at?: string | null
          answers?: Json
          created_at?: string
          free_text?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assessment_responses: {
        Row: {
          assessment_type: string
          completed: boolean
          created_at: string
          current_index: number
          id: string
          responses: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_type: string
          completed?: boolean
          created_at?: string
          current_index?: number
          id?: string
          responses?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_type?: string
          completed?: boolean
          created_at?: string
          current_index?: number
          id?: string
          responses?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      assessment_results: {
        Row: {
          analysis: Json | null
          assessment_type: string
          completed_at: string
          id: string
          scores: Json
          user_id: string
        }
        Insert: {
          analysis?: Json | null
          assessment_type: string
          completed_at?: string
          id?: string
          scores: Json
          user_id: string
        }
        Update: {
          analysis?: Json | null
          assessment_type?: string
          completed_at?: string
          id?: string
          scores?: Json
          user_id?: string
        }
        Relationships: []
      }
      cycle_logs: {
        Row: {
          created_at: string
          energy: number | null
          event: string | null
          flow: number | null
          id: string
          log_date: string
          mood: number | null
          notes: string | null
          pain: number | null
          profile_id: string
          symptoms: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          energy?: number | null
          event?: string | null
          flow?: number | null
          id?: string
          log_date: string
          mood?: number | null
          notes?: string | null
          pain?: number | null
          profile_id: string
          symptoms?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          energy?: number | null
          event?: string | null
          flow?: number | null
          id?: string
          log_date?: string
          mood?: number | null
          notes?: string | null
          pain?: number | null
          profile_id?: string
          symptoms?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cycle_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "cycle_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cycle_profiles: {
        Row: {
          avg_cycle_length: number
          avg_period_length: number
          color: string
          created_at: string
          id: string
          is_self: boolean
          label: string
          luteal_length: number
          notify_ovulation: boolean
          notify_period: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_cycle_length?: number
          avg_period_length?: number
          color?: string
          created_at?: string
          id?: string
          is_self?: boolean
          label: string
          luteal_length?: number
          notify_ovulation?: boolean
          notify_period?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_cycle_length?: number
          avg_period_length?: number
          color?: string
          created_at?: string
          id?: string
          is_self?: boolean
          label?: string
          luteal_length?: number
          notify_ovulation?: boolean
          notify_period?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          energy: number | null
          focus: number | null
          id: string
          mood: number | null
          notes: string | null
          sleep_hours: number | null
          sleep_quality: number | null
          stress: number | null
          tags: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          energy?: number | null
          focus?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          energy?: number | null
          focus?: number | null
          id?: string
          mood?: number | null
          notes?: string | null
          sleep_hours?: number | null
          sleep_quality?: number | null
          stress?: number | null
          tags?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      decision_journal: {
        Row: {
          actual_outcome: string | null
          chosen_option: string | null
          context: string | null
          created_at: string
          decision_title: string
          emotional_state: string | null
          id: string
          lessons_learned: string | null
          options_considered: Json | null
          outcome_rating: number | null
          predicted_confidence: number | null
          predicted_outcome: string | null
          rationale: string | null
          review_date: string | null
          reviewed_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_outcome?: string | null
          chosen_option?: string | null
          context?: string | null
          created_at?: string
          decision_title: string
          emotional_state?: string | null
          id?: string
          lessons_learned?: string | null
          options_considered?: Json | null
          outcome_rating?: number | null
          predicted_confidence?: number | null
          predicted_outcome?: string | null
          rationale?: string | null
          review_date?: string | null
          reviewed_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_outcome?: string | null
          chosen_option?: string | null
          context?: string | null
          created_at?: string
          decision_title?: string
          emotional_state?: string | null
          id?: string
          lessons_learned?: string | null
          options_considered?: Json | null
          outcome_rating?: number | null
          predicted_confidence?: number | null
          predicted_outcome?: string | null
          rationale?: string | null
          review_date?: string | null
          reviewed_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      folder_columns: {
        Row: {
          color: string | null
          created_at: string
          folder_id: string
          id: string
          name: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          folder_id: string
          id?: string
          name: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          folder_id?: string
          id?: string
          name?: string
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      folders: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          parent_id: string | null
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          position?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      habit_logs: {
        Row: {
          habit_id: string
          id: string
          log_date: string
          note: string | null
          user_id: string
        }
        Insert: {
          habit_id: string
          id?: string
          log_date?: string
          note?: string | null
          user_id: string
        }
        Update: {
          habit_id?: string
          id?: string
          log_date?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          color: string | null
          created_at: string
          frequency: string
          icon: string | null
          id: string
          name: string
          target_per_week: number
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          frequency?: string
          icon?: string | null
          id?: string
          name: string
          target_per_week?: number
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          frequency?: string
          icon?: string | null
          id?: string
          name?: string
          target_per_week?: number
          user_id?: string
        }
        Relationships: []
      }
      holidays: {
        Row: {
          country_code: string
          created_at: string
          date: string
          id: string
          local_name: string | null
          name: string
          type: string | null
        }
        Insert: {
          country_code: string
          created_at?: string
          date: string
          id?: string
          local_name?: string | null
          name: string
          type?: string | null
        }
        Update: {
          country_code?: string
          created_at?: string
          date?: string
          id?: string
          local_name?: string | null
          name?: string
          type?: string | null
        }
        Relationships: []
      }
      mh_profile: {
        Row: {
          ai_tone: string
          attachment_quadrant: string | null
          attention_points: Json | null
          hexaco_pattern: string | null
          signature_strengths: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_tone?: string
          attachment_quadrant?: string | null
          attention_points?: Json | null
          hexaco_pattern?: string | null
          signature_strengths?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_tone?: string
          attachment_quadrant?: string | null
          attention_points?: Json | null
          hexaco_pattern?: string | null
          signature_strengths?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      note_tags: {
        Row: {
          note_id: string
          tag_id: string
          user_id: string
        }
        Insert: {
          note_id: string
          tag_id: string
          user_id: string
        }
        Update: {
          note_id?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_tags_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          folder_id: string | null
          id: string
          pinned: boolean
          sr_due_date: string | null
          sr_ease: number
          sr_enabled: boolean
          sr_interval: number
          sr_last_reviewed_at: string | null
          sr_reps: number
          task_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          pinned?: boolean
          sr_due_date?: string | null
          sr_ease?: number
          sr_enabled?: boolean
          sr_interval?: number
          sr_last_reviewed_at?: string | null
          sr_reps?: number
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          pinned?: boolean
          sr_due_date?: string | null
          sr_ease?: number
          sr_enabled?: boolean
          sr_interval?: number
          sr_last_reviewed_at?: string | null
          sr_reps?: number
          task_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      outcome_executions: {
        Row: {
          created_at: string
          created_task_ids: string[]
          id: string
          outcome_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_task_ids?: string[]
          id?: string
          outcome_id: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_task_ids?: string[]
          id?: string
          outcome_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "outcome_executions_outcome_id_fkey"
            columns: ["outcome_id"]
            isOneToOne: false
            referencedRelation: "task_outcomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outcome_executions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      pomodoro_sessions: {
        Row: {
          completed: boolean
          duration_minutes: number
          ended_at: string | null
          id: string
          started_at: string
          task_id: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pomodoro_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_questions_queue: {
        Row: {
          answer: number | null
          answered_at: string | null
          asked_at: string | null
          created_at: string
          id: string
          question_key: string
          question_text: string
          reverse_scored: boolean
          scale_max: number
          scale_min: number
          scheduled_for: string | null
          source: string
          status: string
          trait: string | null
          trigger_context: string | null
          user_id: string
        }
        Insert: {
          answer?: number | null
          answered_at?: string | null
          asked_at?: string | null
          created_at?: string
          id?: string
          question_key: string
          question_text: string
          reverse_scored?: boolean
          scale_max?: number
          scale_min?: number
          scheduled_for?: string | null
          source: string
          status?: string
          trait?: string | null
          trigger_context?: string | null
          user_id: string
        }
        Update: {
          answer?: number | null
          answered_at?: string | null
          asked_at?: string | null
          created_at?: string
          id?: string
          question_key?: string
          question_text?: string
          reverse_scored?: boolean
          scale_max?: number
          scale_min?: number
          scheduled_for?: string | null
          source?: string
          status?: string
          trait?: string | null
          trigger_context?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ai_language: string
          avatar_url: string | null
          clinical_consent: boolean
          clinical_consent_at: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          ai_language?: string
          avatar_url?: string | null
          clinical_consent?: boolean
          clinical_consent_at?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          ai_language?: string
          avatar_url?: string | null
          clinical_consent?: boolean
          clinical_consent_at?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      shares: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          owner_id: string
          permission: Database["public"]["Enums"]["share_permission"]
          recipient_email: string
          recipient_id: string | null
          resource_id: string
          resource_type: Database["public"]["Enums"]["share_resource_type"]
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          owner_id: string
          permission?: Database["public"]["Enums"]["share_permission"]
          recipient_email: string
          recipient_id?: string | null
          resource_id: string
          resource_type: Database["public"]["Enums"]["share_resource_type"]
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          permission?: Database["public"]["Enums"]["share_permission"]
          recipient_email?: string
          recipient_id?: string | null
          resource_id?: string
          resource_type?: Database["public"]["Enums"]["share_resource_type"]
          updated_at?: string
        }
        Relationships: []
      }
      subtasks: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          position: number
          task_id: string
          title: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          task_id: string
          title: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          position?: number
          task_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtasks_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      task_activities: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json
          task_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json
          task_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json
          task_id?: string
          user_id?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string | null
          position: number
          size_bytes: number | null
          storage_path: string
          task_id: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind?: string
          mime_type?: string | null
          position?: number
          size_bytes?: number | null
          storage_path: string
          task_id: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string | null
          position?: number
          size_bytes?: number | null
          storage_path?: string
          task_id?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      task_outcomes: {
        Row: {
          actions: Json
          color: string | null
          created_at: string
          icon: string | null
          id: string
          label: string
          position: number
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actions?: Json
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          label: string
          position?: number
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actions?: Json
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          label?: string
          position?: number
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_outcomes_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_step_lists: {
        Row: {
          created_at: string
          id: string
          position: number
          style: string
          task_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          style?: string
          task_id: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          style?: string
          task_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      task_steps: {
        Row: {
          completed: boolean
          created_at: string
          id: string
          list_id: string
          position: number
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          id?: string
          list_id: string
          position?: number
          text?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          id?: string
          list_id?: string
          position?: number
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_steps_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "task_step_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      task_tags: {
        Row: {
          tag_id: string
          task_id: string
          user_id: string
        }
        Insert: {
          tag_id: string
          task_id: string
          user_id: string
        }
        Update: {
          tag_id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_tags_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_templates: {
        Row: {
          created_at: string
          description: string | null
          due_offset_hours: number | null
          folder_id: string | null
          id: string
          payload: Json
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence: Database["public"]["Enums"]["recurrence_type"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          due_offset_hours?: number | null
          folder_id?: string | null
          id?: string
          payload?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          due_offset_hours?: number | null
          folder_id?: string | null
          id?: string
          payload?: Json
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_templates_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          bucket_anchor: string | null
          bucket_calendar: string | null
          bucket_kind: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          end_at: string | null
          estimated_minutes: number | null
          folder_id: string | null
          goal_level: string | null
          id: string
          is_avoidance: boolean
          kanban_column_id: string | null
          location: string | null
          parent_id: string | null
          pinned: boolean
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          quadrant: number | null
          recurrence: Database["public"]["Enums"]["recurrence_type"]
          recurrence_rule: Json | null
          reminder_at: string | null
          start_at: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bucket_anchor?: string | null
          bucket_calendar?: string | null
          bucket_kind?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          end_at?: string | null
          estimated_minutes?: number | null
          folder_id?: string | null
          goal_level?: string | null
          id?: string
          is_avoidance?: boolean
          kanban_column_id?: string | null
          location?: string | null
          parent_id?: string | null
          pinned?: boolean
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          quadrant?: number | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_rule?: Json | null
          reminder_at?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bucket_anchor?: string | null
          bucket_calendar?: string | null
          bucket_kind?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          end_at?: string | null
          estimated_minutes?: number | null
          folder_id?: string | null
          goal_level?: string | null
          id?: string
          is_avoidance?: boolean
          kanban_column_id?: string | null
          location?: string | null
          parent_id?: string | null
          pinned?: boolean
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          quadrant?: number | null
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          recurrence_rule?: Json | null
          reminder_at?: string | null
          start_at?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      thought_records: {
        Row: {
          ai_feedback: string | null
          alternative_thought: string | null
          automatic_thought: string
          created_at: string
          distortions: string[] | null
          emotion_intensity_after: number | null
          emotion_intensity_before: number
          emotions: string[] | null
          evidence_against: string[] | null
          evidence_for: string[] | null
          id: string
          situation: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          alternative_thought?: string | null
          automatic_thought: string
          created_at?: string
          distortions?: string[] | null
          emotion_intensity_after?: number | null
          emotion_intensity_before: number
          emotions?: string[] | null
          evidence_against?: string[] | null
          evidence_for?: string[] | null
          id?: string
          situation: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          alternative_thought?: string | null
          automatic_thought?: string
          created_at?: string
          distortions?: string[] | null
          emotion_intensity_after?: number | null
          emotion_intensity_before?: number
          emotions?: string[] | null
          evidence_against?: string[] | null
          evidence_for?: string[] | null
          id?: string
          situation?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          active_cycle_profile_id: string | null
          auto_create_daily_tasks: boolean
          checkin_reminder_enabled: boolean
          checkin_reminder_time: string
          created_at: string
          cycle_overlay_enabled: boolean
          default_landing: string
          font_size: string
          micro_prompt_enabled: boolean
          notifications_enabled: boolean
          show_daily_checkin: boolean
          task_card_layout: string
          task_defaults: Json
          theme: string
          ui_scale: number
          updated_at: string
          user_id: string
        }
        Insert: {
          active_cycle_profile_id?: string | null
          auto_create_daily_tasks?: boolean
          checkin_reminder_enabled?: boolean
          checkin_reminder_time?: string
          created_at?: string
          cycle_overlay_enabled?: boolean
          default_landing?: string
          font_size?: string
          micro_prompt_enabled?: boolean
          notifications_enabled?: boolean
          show_daily_checkin?: boolean
          task_card_layout?: string
          task_defaults?: Json
          theme?: string
          ui_scale?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          active_cycle_profile_id?: string | null
          auto_create_daily_tasks?: boolean
          checkin_reminder_enabled?: boolean
          checkin_reminder_time?: string
          created_at?: string
          cycle_overlay_enabled?: boolean
          default_landing?: string
          font_size?: string
          micro_prompt_enabled?: boolean
          notifications_enabled?: boolean
          show_daily_checkin?: boolean
          task_card_layout?: string
          task_defaults?: Json
          theme?: string
          ui_scale?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_share: { Args: { _share_id: string }; Returns: undefined }
      admin_user_list: {
        Args: never
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          is_admin: boolean
          last_sign_in_at: string
          note_count: number
          task_count: number
          user_id: string
        }[]
      }
      decline_share: { Args: { _share_id: string }; Returns: undefined }
      get_effective_share_permission: {
        Args: {
          _resource_id: string
          _resource_type: Database["public"]["Enums"]["share_resource_type"]
          _user_id: string
        }
        Returns: Database["public"]["Enums"]["share_permission"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_share_access: {
        Args: {
          _min_permission?: Database["public"]["Enums"]["share_permission"]
          _resource_id: string
          _resource_type: Database["public"]["Enums"]["share_resource_type"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      recurrence_type: "none" | "daily" | "weekly" | "monthly"
      share_permission: "view" | "comment" | "edit"
      share_resource_type: "task" | "note" | "folder"
      task_priority: "none" | "low" | "medium" | "urgent" | "high"
      task_status: "todo" | "in_progress" | "done"
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
      recurrence_type: ["none", "daily", "weekly", "monthly"],
      share_permission: ["view", "comment", "edit"],
      share_resource_type: ["task", "note", "folder"],
      task_priority: ["none", "low", "medium", "urgent", "high"],
      task_status: ["todo", "in_progress", "done"],
    },
  },
} as const
