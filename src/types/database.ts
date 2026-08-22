/**
 * Supabase database types for the `public` schema.
 *
 * Keep this file aligned with SQL migrations under `supabase/migrations/`.
 * When a linked Supabase project is available, regenerate with:
 *
 *   pnpm dlx supabase gen types typescript --project-id <project-id> --schema public > src/types/database.ts
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          role: Database['public']['Enums']['app_role'];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          role?: Database['public']['Enums']['app_role'];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          role?: Database['public']['Enums']['app_role'];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey';
            columns: ['id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_allowlist: {
        Row: {
          email: string;
          role: Database['public']['Enums']['app_role'];
          created_at: string;
        };
        Insert: {
          email: string;
          role: Database['public']['Enums']['app_role'];
          created_at?: string;
        };
        Update: {
          email?: string;
          role?: Database['public']['Enums']['app_role'];
          created_at?: string;
        };
        Relationships: [];
      };
      vehicles: {
        Row: {
          id: string;
          vehicle_name: string;
          vehicle_number: string;
          brand: string;
          color: string | null;
          fuel_type: Database['public']['Enums']['fuel_type'];
          transmission_type: Database['public']['Enums']['transmission_type'];
          default_daily_rate: number;
          availability_status: Database['public']['Enums']['vehicle_availability'];
          image_path: string | null;
          is_active: boolean;
          city: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehicle_name: string;
          vehicle_number: string;
          brand: string;
          color?: string | null;
          fuel_type: Database['public']['Enums']['fuel_type'];
          transmission_type: Database['public']['Enums']['transmission_type'];
          default_daily_rate: number;
          availability_status?: Database['public']['Enums']['vehicle_availability'];
          image_path?: string | null;
          is_active?: boolean;
          city?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehicle_name?: string;
          vehicle_number?: string;
          brand?: string;
          color?: string | null;
          fuel_type?: Database['public']['Enums']['fuel_type'];
          transmission_type?: Database['public']['Enums']['transmission_type'];
          default_daily_rate?: number;
          availability_status?: Database['public']['Enums']['vehicle_availability'];
          image_path?: string | null;
          is_active?: boolean;
          city?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoice_sequences: {
        Row: {
          id: string;
          prefix: string;
          year: number;
          current_sequence: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          prefix: string;
          year: number;
          current_sequence?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          prefix?: string;
          year?: number;
          current_sequence?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      bookings: {
        Row: {
          id: string;
          invoice_number: string;
          vehicle_id: string;
          mode: Database['public']['Enums']['rental_mode'];
          customer_name: string;
          address: string | null;
          city: string | null;
          state: string | null;
          zip_code: string | null;
          place_to_visit: string | null;
          document_submitted: boolean;
          contact_number: string | null;
          invoice_date: string;
          delivery_date: string;
          return_date: string;
          driver_name: string | null;
          daily_charge: number;
          fuel_range: string | null;
          duration: number | null;
          booking_amount: number;
          payment_method: Database['public']['Enums']['payment_method'] | null;
          total_amount: number;
          status: Database['public']['Enums']['booking_status'];
          notes: string | null;
          rejection_reason: string | null;
          payment_due_at: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          invoice_number: string;
          vehicle_id: string;
          mode: Database['public']['Enums']['rental_mode'];
          customer_name: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          place_to_visit?: string | null;
          document_submitted?: boolean;
          contact_number?: string | null;
          invoice_date?: string;
          delivery_date: string;
          return_date: string;
          driver_name?: string | null;
          daily_charge: number;
          fuel_range?: string | null;
          duration?: number | null;
          booking_amount?: number;
          payment_method?: Database['public']['Enums']['payment_method'] | null;
          total_amount?: number;
          status?: Database['public']['Enums']['booking_status'];
          notes?: string | null;
          rejection_reason?: string | null;
          payment_due_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          invoice_number?: string;
          vehicle_id?: string;
          mode?: Database['public']['Enums']['rental_mode'];
          customer_name?: string;
          address?: string | null;
          city?: string | null;
          state?: string | null;
          zip_code?: string | null;
          place_to_visit?: string | null;
          document_submitted?: boolean;
          contact_number?: string | null;
          invoice_date?: string;
          delivery_date?: string;
          return_date?: string;
          driver_name?: string | null;
          daily_charge?: number;
          fuel_range?: string | null;
          duration?: number | null;
          booking_amount?: number;
          payment_method?: Database['public']['Enums']['payment_method'] | null;
          total_amount?: number;
          status?: Database['public']['Enums']['booking_status'];
          notes?: string | null;
          rejection_reason?: string | null;
          payment_due_at?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'bookings_vehicle_id_fkey';
            columns: ['vehicle_id'];
            isOneToOne: false;
            referencedRelation: 'vehicles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'bookings_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      booking_documents: {
        Row: {
          id: string;
          booking_id: string;
          customer_id: string;
          document_type: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          customer_id: string;
          document_type: string;
          file_name: string;
          storage_path: string;
          mime_type: string;
          file_size: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          customer_id?: string;
          document_type?: string;
          file_name?: string;
          storage_path?: string;
          mime_type?: string;
          file_size?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'booking_documents_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'booking_documents_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      payments: {
        Row: {
          id: string;
          booking_id: string;
          customer_id: string;
          provider: Database['public']['Enums']['payment_provider'];
          status: Database['public']['Enums']['booking_payment_status'];
          amount: number;
          currency: string;
          provider_order_id: string | null;
          provider_payment_id: string | null;
          receipt: string | null;
          failure_reason: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          booking_id: string;
          customer_id: string;
          provider?: Database['public']['Enums']['payment_provider'];
          status?: Database['public']['Enums']['booking_payment_status'];
          amount: number;
          currency?: string;
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          receipt?: string | null;
          failure_reason?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          booking_id?: string;
          customer_id?: string;
          provider?: Database['public']['Enums']['payment_provider'];
          status?: Database['public']['Enums']['booking_payment_status'];
          amount?: number;
          currency?: string;
          provider_order_id?: string | null;
          provider_payment_id?: string | null;
          receipt?: string | null;
          failure_reason?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'payments_booking_id_fkey';
            columns: ['booking_id'];
            isOneToOne: false;
            referencedRelation: 'bookings';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'payments_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      apply_staff_allowlist: {
        Args: Record<PropertyKey, never>;
        Returns: {
          promoted: number;
          demoted: number;
        }[];
      };
      current_user_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Enums']['app_role'];
      };
      ensure_own_profile: {
        Args: Record<PropertyKey, never>;
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      is_active_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      normalize_staff_email: {
        Args: {
          p_email: string;
        };
        Returns: string;
      };
      resolve_profile_role_for_email: {
        Args: {
          p_email: string;
        };
        Returns: Database['public']['Enums']['app_role'];
      };
      max_booking_invoice_sequence: {
        Args: {
          p_prefix: string;
          p_year: number;
        };
        Returns: number;
      };
      list_vehicle_booking_conflicts: {
        Args: {
          p_vehicle_id: string;
          p_delivery_date: string;
          p_return_date: string;
          p_exclude_booking_id?: string | null;
        };
        Returns: {
          id: string;
          vehicle_id: string;
          status: Database['public']['Enums']['booking_status'];
          delivery_date: string;
          return_date: string;
          invoice_number: string | null;
          customer_name: string | null;
        }[];
      };
      mark_booking_documents_submitted: {
        Args: {
          p_booking_id: string;
        };
        Returns: Database['public']['Tables']['bookings']['Row'];
      };
      create_booking_payment_attempt: {
        Args: {
          p_booking_id: string;
          p_amount: number;
          p_currency: string;
          p_provider_order_id: string;
          p_receipt?: string | null;
          p_metadata?: Json;
        };
        Returns: Database['public']['Tables']['payments']['Row'];
      };
      update_own_payment_attempt_outcome: {
        Args: {
          p_payment_id: string;
          p_status: Database['public']['Enums']['booking_payment_status'];
          p_provider_payment_id?: string | null;
          p_failure_reason?: string | null;
        };
        Returns: Database['public']['Tables']['payments']['Row'];
      };
      attach_payment_provider_payment_id: {
        Args: {
          p_provider_order_id: string;
          p_provider_payment_id: string;
        };
        Returns: Database['public']['Tables']['payments']['Row'];
      };
      complete_booking_payment: {
        Args: {
          p_provider_order_id: string;
          p_provider_payment_id: string;
          p_amount: number;
          p_currency: string;
          p_payment_method?: Database['public']['Enums']['payment_method'];
        };
        Returns: Database['public']['Tables']['payments']['Row'];
      };
      mark_payment_attempt_failed_by_order: {
        Args: {
          p_provider_order_id: string;
          p_provider_payment_id?: string | null;
          p_failure_reason?: string | null;
        };
        Returns: Database['public']['Tables']['payments']['Row'];
      };
      release_overdue_unpaid_bookings: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      next_invoice_sequence: {
        Args: {
          p_prefix: string;
          p_year: number;
        };
        Returns: number;
      };
      peek_next_invoice_sequence: {
        Args: {
          p_prefix: string;
          p_year: number;
        };
        Returns: number;
      };
    };
    Enums: {
      app_role: 'owner' | 'manager' | 'customer';
      fuel_type: 'petrol' | 'diesel' | 'cng' | 'electric' | 'hybrid';
      transmission_type: 'manual' | 'automatic' | 'amt' | 'cvt' | 'dct';
      vehicle_availability: 'available' | 'booked' | 'maintenance' | 'reserved' | 'inactive';
      rental_mode: 'with_driver' | 'without_driver';
      payment_method: 'cash' | 'upi' | 'card' | 'bank_transfer' | 'cheque' | 'other';
      booking_status: 'draft' | 'confirmed' | 'ongoing' | 'completed' | 'cancelled' | 'denied';
      payment_provider: 'razorpay';
      booking_payment_status: 'pending' | 'failed' | 'cancelled' | 'paid';
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];
