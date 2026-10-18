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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_name: string | null
          asset_number: string | null
          assigned_to: string | null
          category: string | null
          condition: string | null
          id: string
          purchase_date: string | null
          value: number | null
        }
        Insert: {
          asset_name?: string | null
          asset_number?: string | null
          assigned_to?: string | null
          category?: string | null
          condition?: string | null
          id?: string
          purchase_date?: string | null
          value?: number | null
        }
        Update: {
          asset_name?: string | null
          asset_number?: string | null
          assigned_to?: string | null
          category?: string | null
          condition?: string | null
          id?: string
          purchase_date?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "assets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          attendance_date: string | null
          id: string
          officer_id: string | null
          remarks: string | null
          status: string | null
        }
        Insert: {
          attendance_date?: string | null
          id?: string
          officer_id?: string | null
          remarks?: string | null
          status?: string | null
        }
        Update: {
          attendance_date?: string | null
          id?: string
          officer_id?: string | null
          remarks?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "attendance_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "attendance_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: number
          ip_address: string | null
          record_id: string | null
          table_name: string
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: never
          ip_address?: string | null
          record_id?: string | null
          table_name: string
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: never
          ip_address?: string | null
          record_id?: string | null
          table_name?: string
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      budgets: {
        Row: {
          allocated_amount: number | null
          department: string | null
          fiscal_year: number | null
          id: string
          remaining_amount: number | null
          used_amount: number | null
        }
        Insert: {
          allocated_amount?: number | null
          department?: string | null
          fiscal_year?: number | null
          id?: string
          remaining_amount?: number | null
          used_amount?: number | null
        }
        Update: {
          allocated_amount?: number | null
          department?: string | null
          fiscal_year?: number | null
          id?: string
          remaining_amount?: number | null
          used_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "budgets_department_fkey"
            columns: ["department"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      cadets: {
        Row: {
          address: string | null
          cadet_number: string | null
          date_enrolled: string | null
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          phone: string | null
          status: string | null
        }
        Insert: {
          address?: string | null
          cadet_number?: string | null
          date_enrolled?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          status?: string | null
        }
        Update: {
          address?: string | null
          cadet_number?: string | null
          date_enrolled?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      courses: {
        Row: {
          course_name: string | null
          description: string | null
          duration: number | null
          id: string
          training_program_id: string | null
        }
        Insert: {
          course_name?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          training_program_id?: string | null
        }
        Update: {
          course_name?: string | null
          description?: string | null
          duration?: number | null
          id?: string
          training_program_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_training_program_id_fkey"
            columns: ["training_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplinary_actions: {
        Row: {
          action_taken: string | null
          created_at: string | null
          id: string
          incident_date: string | null
          offense: string | null
          officer_id: string | null
          recorded_by: string | null
        }
        Insert: {
          action_taken?: string | null
          created_at?: string | null
          id?: string
          incident_date?: string | null
          offense?: string | null
          officer_id?: string | null
          recorded_by?: string | null
        }
        Update: {
          action_taken?: string | null
          created_at?: string | null
          id?: string
          incident_date?: string | null
          offense?: string | null
          officer_id?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disciplinary_actions_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "disciplinary_actions_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "disciplinary_actions_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disciplinary_actions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "disciplinary_actions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "disciplinary_actions_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number | null
          description: string | null
          expense_date: string | null
          expense_type: string | null
          id: string
          recorded_by: string | null
        }
        Insert: {
          amount?: number | null
          description?: string | null
          expense_date?: string | null
          expense_type?: string | null
          id?: string
          recorded_by?: string | null
        }
        Update: {
          amount?: number | null
          description?: string | null
          expense_date?: string | null
          expense_type?: string | null
          id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      incoming_mail: {
        Row: {
          assigned_to: string | null
          id: string
          received_date: string | null
          reference_number: string | null
          sender: string | null
          subject: string | null
        }
        Insert: {
          assigned_to?: string | null
          id?: string
          received_date?: string | null
          reference_number?: string | null
          sender?: string | null
          subject?: string | null
        }
        Update: {
          assigned_to?: string | null
          id?: string
          received_date?: string | null
          reference_number?: string | null
          sender?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incoming_mail_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "incoming_mail_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "incoming_mail_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_items: {
        Row: {
          assigned_to: string | null
          category: string
          code: string
          created_at: string
          id: string
          is_asset: boolean
          item_code: string | null
          item_name: string | null
          location: string | null
          name: string
          quantity: number
          quantity_in_stock: number | null
          reorder_level: number
          storage_location: string | null
          unit: string
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          code: string
          created_at?: string
          id?: string
          is_asset?: boolean
          item_code?: string | null
          item_name?: string | null
          location?: string | null
          name: string
          quantity?: number
          quantity_in_stock?: number | null
          reorder_level?: number
          storage_location?: string | null
          unit?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          code?: string
          created_at?: string
          id?: string
          is_asset?: boolean
          item_code?: string | null
          item_name?: string | null
          location?: string | null
          name?: string
          quantity?: number
          quantity_in_stock?: number | null
          reorder_level?: number
          storage_location?: string | null
          unit?: string
        }
        Relationships: []
      }
      leave_balances: {
        Row: {
          annual_leave_allocated: number | null
          annual_leave_balance: number | null
          annual_leave_used: number | null
          emergency_leave_used: number | null
          id: string
          officer_id: string | null
          sick_leave_used: number | null
          updated_at: string | null
          year: number | null
        }
        Insert: {
          annual_leave_allocated?: number | null
          annual_leave_balance?: number | null
          annual_leave_used?: number | null
          emergency_leave_used?: number | null
          id?: string
          officer_id?: string | null
          sick_leave_used?: number | null
          updated_at?: string | null
          year?: number | null
        }
        Update: {
          annual_leave_allocated?: number | null
          annual_leave_balance?: number | null
          annual_leave_used?: number | null
          emergency_leave_used?: number | null
          id?: string
          officer_id?: string | null
          sick_leave_used?: number | null
          updated_at?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "leave_balances_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "leave_balances_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approval_status: string | null
          created_at: string
          current_step: string | null
          end_date: string
          history: Json
          id: string
          leave_type: string
          officer_id: string | null
          reason: string | null
          requested_by: string | null
          stage: number
          start_date: string
          status: string
          total_days: number | null
        }
        Insert: {
          approval_status?: string | null
          created_at?: string
          current_step?: string | null
          end_date: string
          history?: Json
          id?: string
          leave_type: string
          officer_id?: string | null
          reason?: string | null
          requested_by?: string | null
          stage?: number
          start_date: string
          status?: string
          total_days?: number | null
        }
        Update: {
          approval_status?: string | null
          created_at?: string
          current_step?: string | null
          end_date?: string
          history?: Json
          id?: string
          leave_type?: string
          officer_id?: string | null
          reason?: string | null
          requested_by?: string | null
          stage?: number
          start_date?: string
          status?: string
          total_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "leave_requests_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "leave_requests_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean | null
          message: string | null
          read: boolean
          role: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          read?: boolean
          role?: Database["public"]["Enums"]["app_role"] | null
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          read?: boolean
          role?: Database["public"]["Enums"]["app_role"] | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      officer_documents: {
        Row: {
          document_name: string | null
          document_type: string | null
          file_url: string | null
          id: string
          officer_id: string | null
          upload_date: string | null
        }
        Insert: {
          document_name?: string | null
          document_type?: string | null
          file_url?: string | null
          id?: string
          officer_id?: string | null
          upload_date?: string | null
        }
        Update: {
          document_name?: string | null
          document_type?: string | null
          file_url?: string | null
          id?: string
          officer_id?: string | null
          upload_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officer_documents_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "officer_documents_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "officer_documents_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      officers: {
        Row: {
          address: string | null
          blood_group: string | null
          commendations: string | null
          county: string | null
          created_at: string
          current_assignment: string | null
          date_joined: string | null
          date_of_birth: string | null
          designation: string | null
          disciplinary_actions: string | null
          education: string | null
          email: string | null
          emergency_contact: string | null
          employment_status: string
          first_name: string | null
          full_name: string
          gender: string | null
          id: string
          last_name: string | null
          marital_status: string | null
          medical_info: string | null
          middle_name: string | null
          nationality: string | null
          next_of_kin: string | null
          next_of_kin_phone: string | null
          office_id: string | null
          phone: string | null
          photo_url: string | null
          position: string | null
          profile_photo: string | null
          promotion_history: string | null
          rank: string
          section_id: string | null
          service_number: string
          training_history: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          blood_group?: string | null
          commendations?: string | null
          county?: string | null
          created_at?: string
          current_assignment?: string | null
          date_joined?: string | null
          date_of_birth?: string | null
          designation?: string | null
          disciplinary_actions?: string | null
          education?: string | null
          email?: string | null
          emergency_contact?: string | null
          employment_status?: string
          first_name?: string | null
          full_name: string
          gender?: string | null
          id?: string
          last_name?: string | null
          marital_status?: string | null
          medical_info?: string | null
          middle_name?: string | null
          nationality?: string | null
          next_of_kin?: string | null
          next_of_kin_phone?: string | null
          office_id?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          profile_photo?: string | null
          promotion_history?: string | null
          rank: string
          section_id?: string | null
          service_number: string
          training_history?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          blood_group?: string | null
          commendations?: string | null
          county?: string | null
          created_at?: string
          current_assignment?: string | null
          date_joined?: string | null
          date_of_birth?: string | null
          designation?: string | null
          disciplinary_actions?: string | null
          education?: string | null
          email?: string | null
          emergency_contact?: string | null
          employment_status?: string
          first_name?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          last_name?: string | null
          marital_status?: string | null
          medical_info?: string | null
          middle_name?: string | null
          nationality?: string | null
          next_of_kin?: string | null
          next_of_kin_phone?: string | null
          office_id?: string | null
          phone?: string | null
          photo_url?: string | null
          position?: string | null
          profile_photo?: string | null
          promotion_history?: string | null
          rank?: string
          section_id?: string | null
          service_number?: string
          training_history?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "officers_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      offices: {
        Row: {
          description: string | null
          id: string
          name: string
          office_name: string | null
          office_type: string | null
          parent_office: string | null
          rank_order: number
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          office_name?: string | null
          office_type?: string | null
          parent_office?: string | null
          rank_order?: number
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          office_name?: string | null
          office_type?: string | null
          parent_office?: string | null
          rank_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "offices_parent_office_fkey"
            columns: ["parent_office"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      outgoing_mail: {
        Row: {
          created_by: string | null
          dispatch_date: string | null
          id: string
          recipient: string | null
          reference_number: string | null
          subject: string | null
        }
        Insert: {
          created_by?: string | null
          dispatch_date?: string | null
          id?: string
          recipient?: string | null
          reference_number?: string | null
          subject?: string | null
        }
        Update: {
          created_by?: string | null
          dispatch_date?: string | null
          id?: string
          recipient?: string | null
          reference_number?: string | null
          subject?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outgoing_mail_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "outgoing_mail_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "outgoing_mail_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      promotions: {
        Row: {
          id: string
          officer_id: string | null
          previous_rank: string | null
          promoted_rank: string | null
          promotion_date: string | null
          remarks: string | null
        }
        Insert: {
          id?: string
          officer_id?: string | null
          previous_rank?: string | null
          promoted_rank?: string | null
          promotion_date?: string | null
          remarks?: string | null
        }
        Update: {
          id?: string
          officer_id?: string | null
          previous_rank?: string | null
          promoted_rank?: string | null
          promotion_date?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promotions_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "promotions_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "promotions_officer_id_fkey"
            columns: ["officer_id"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          amount: number | null
          id: string
          po_number: string | null
          request_id: string | null
          status: string | null
          vendor_id: string | null
        }
        Insert: {
          amount?: number | null
          id?: string
          po_number?: string | null
          request_id?: string | null
          status?: string | null
          vendor_id?: string | null
        }
        Update: {
          amount?: number | null
          id?: string
          po_number?: string | null
          request_id?: string | null
          status?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          department: string | null
          description: string | null
          estimated_cost: number | null
          id: string
          request_no: string | null
          requested_by: string | null
          status: string | null
        }
        Insert: {
          department?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          request_no?: string | null
          requested_by?: string | null
          status?: string | null
        }
        Update: {
          department?: string | null
          description?: string | null
          estimated_cost?: number | null
          id?: string
          request_no?: string | null
          requested_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_department_fkey"
            columns: ["department"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "purchase_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "purchase_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      sections: {
        Row: {
          created_at: string | null
          id: string
          name: string
          office_id: string | null
          section_head: string | null
          section_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          office_id?: string | null
          section_head?: string | null
          section_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          office_id?: string | null
          section_head?: string | null
          section_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sections_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sections_section_head_fkey"
            columns: ["section_head"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "sections_section_head_fkey"
            columns: ["section_head"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "sections_section_head_fkey"
            columns: ["section_head"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_requests: {
        Row: {
          approval_status: string
          collection_status: string
          created_at: string
          description: string | null
          history: Json
          id: string
          item_id: string | null
          item_name: string
          justification: string | null
          priority: string
          quantity: number
          request_date: string
          request_number: string
          requested_by: string | null
          requested_by_name: string | null
          section_id: string | null
          stage: number
          unit: string
        }
        Insert: {
          approval_status?: string
          collection_status?: string
          created_at?: string
          description?: string | null
          history?: Json
          id?: string
          item_id?: string | null
          item_name: string
          justification?: string | null
          priority?: string
          quantity: number
          request_date?: string
          request_number?: string
          requested_by?: string | null
          requested_by_name?: string | null
          section_id?: string | null
          stage?: number
          unit?: string
        }
        Update: {
          approval_status?: string
          collection_status?: string
          created_at?: string
          description?: string | null
          history?: Json
          id?: string
          item_id?: string | null
          item_name?: string
          justification?: string | null
          priority?: string
          quantity?: number
          request_date?: string
          request_number?: string
          requested_by?: string | null
          requested_by_name?: string | null
          section_id?: string | null
          stage?: number
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "supply_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supply_requests_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string | null
          id: string
          issue_type: string | null
          priority: string | null
          reported_by: string | null
          status: string | null
          ticket_number: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          issue_type?: string | null
          priority?: string | null
          reported_by?: string | null
          status?: string | null
          ticket_number?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          issue_type?: string | null
          priority?: string | null
          reported_by?: string | null
          status?: string | null
          ticket_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "tickets_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "tickets_reported_by_fkey"
            columns: ["reported_by"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          coordinator: string | null
          description: string | null
          end_date: string | null
          id: string
          start_date: string | null
          title: string | null
        }
        Insert: {
          coordinator?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          title?: string | null
        }
        Update: {
          coordinator?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          start_date?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_programs_coordinator_fkey"
            columns: ["coordinator"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "training_programs_coordinator_fkey"
            columns: ["coordinator"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "training_programs_coordinator_fkey"
            columns: ["coordinator"]
            isOneToOne: false
            referencedRelation: "officers"
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
      vehicles: {
        Row: {
          assigned_driver: string | null
          id: string
          make: string | null
          model: string | null
          status: string | null
          vehicle_no: string | null
          year: number | null
        }
        Insert: {
          assigned_driver?: string | null
          id?: string
          make?: string | null
          model?: string | null
          status?: string | null
          vehicle_no?: string | null
          year?: number | null
        }
        Update: {
          assigned_driver?: string | null
          id?: string
          make?: string | null
          model?: string | null
          status?: string | null
          vehicle_no?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_assigned_driver_fkey"
            columns: ["assigned_driver"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["approver_id"]
          },
          {
            foreignKeyName: "vehicles_assigned_driver_fkey"
            columns: ["assigned_driver"]
            isOneToOne: false
            referencedRelation: "equipment_requests"
            referencedColumns: ["requested_by"]
          },
          {
            foreignKeyName: "vehicles_assigned_driver_fkey"
            columns: ["assigned_driver"]
            isOneToOne: false
            referencedRelation: "officers"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          company_name: string | null
          contact_person: string | null
          email: string | null
          id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          company_name?: string | null
          contact_person?: string | null
          email?: string | null
          id?: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          company_name?: string | null
          contact_person?: string | null
          email?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      approvals: {
        Row: {
          action_date: string | null
          action_taken: string | null
          approver_id: string | null
          comments: string | null
          id: string | null
          office_id: string | null
          request_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "officers_office_id_fkey"
            columns: ["office_id"]
            isOneToOne: false
            referencedRelation: "offices"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_requests: {
        Row: {
          collection_status: string | null
          commandant_approval: string | null
          created_at: string | null
          id: string | null
          item_name: string | null
          priority: string | null
          purpose: string | null
          quantity: number | null
          request_date: string | null
          request_number: string | null
          requested_by: string | null
          requesting_section: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_requests_section_id_fkey"
            columns: ["requesting_section"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      act_on_leave: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: undefined
      }
      act_on_supply: {
        Args: { _approve: boolean; _id: string; _note?: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      leave_stage_role: {
        Args: { _stage: number }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      list_users_with_roles: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          roles: Database["public"]["Enums"]["app_role"][]
        }[]
      }
      supply_stage_role: {
        Args: { _stage: number }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
    }
    Enums: {
      app_role:
        | "commandant"
        | "deputy_commandant"
        | "dc_admin"
        | "dc_academy"
        | "assistant_commissioner"
        | "section_head"
        | "officer"
        | "storekeeper"
        | "finance_officer"
        | "hr_officer"
        | "ict_admin"
        | "system_admin"
        | "registry_officer"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: [
        "commandant",
        "deputy_commandant",
        "dc_admin",
        "dc_academy",
        "assistant_commissioner",
        "section_head",
        "officer",
        "storekeeper",
        "finance_officer",
        "hr_officer",
        "ict_admin",
        "system_admin",
        "registry_officer",
      ],
    },
  },
} as const
