import { createClient } from '@supabase/supabase-js';

// Vérifier que les variables d'environnement sont définies
if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_URL');
}
if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Client Supabase pour l'API (côté serveur avec service_role pour contourner RLS si nécessaire)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Client Supabase pour le frontend (avec anon key)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Types pour TypeScript (adaptés pour UUID)
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string; // UUID
          email: string;
          name: string | null;
          password: string | null;
          role: 'ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE' | 'VIEWER';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          email: string;
          name?: string | null;
          password?: string | null;
          role?: 'ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE' | 'VIEWER';
        };
        Update: {
          email?: string;
          name?: string | null;
          password?: string | null;
          role?: 'ADMIN' | 'PROJECT_MANAGER' | 'EMPLOYEE' | 'VIEWER';
        };
      };
      projects: {
        Row: {
          id: string; // UUID
          title: string;
          description: string | null;
          start_date: string | null;
          end_date: string | null;
          due_date: string | null;
          status: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
          created_by_id: string | null; // UUID
          manager_id: string | null; // UUID
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          due_date?: string | null;
          status?: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
          created_by_id?: string | null;
          manager_id?: string | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          due_date?: string | null;
          status?: 'PLANNING' | 'IN_PROGRESS' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
          manager_id?: string | null;
        };
      };
      tasks: {
        Row: {
          id: string; // UUID
          title: string;
          description: string | null;
          status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
          priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
          due_date: string | null;
          completed_at: string | null;
          assigned_to_id: string | null; // UUID
          project_id: string; // UUID
          stage_id: string | null; // UUID
          created_at: string;
          updated_at: string;
        };
        Insert: {
          title: string;
          description?: string | null;
          status?: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
          priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
          due_date?: string | null;
          assigned_to_id?: number | null;
          project_id: number;
          stage_id?: number | null;
        };
        Update: {
          title?: string;
          description?: string | null;
          status?: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'COMPLETED' | 'CANCELLED';
          priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
          due_date?: string | null;
          completed_at?: string | null;
          assigned_to_id?: number | null;
          stage_id?: number | null;
        };
      };
      notifications: {
        Row: {
          id: number;
          user_id: number;
          type: 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'TASK_COMPLETED' | 'STAGE_COMPLETED' | 'PROJECT_DEADLINE' | 'MENTION' | 'COMMENT';
          title: string;
          message: string;
          is_read: boolean;
          metadata: any | null;
          created_at: string;
        };
        Insert: {
          user_id: number;
          type: 'TASK_ASSIGNED' | 'TASK_UPDATED' | 'TASK_COMPLETED' | 'STAGE_COMPLETED' | 'PROJECT_DEADLINE' | 'MENTION' | 'COMMENT';
          title: string;
          message: string;
          is_read?: boolean;
          metadata?: any | null;
        };
        Update: {
          is_read?: boolean;
          metadata?: any | null;
        };
      };
      email_logs: {
        Row: {
          id: number;
          recipient_id: number | null;
          recipient: string;
          subject: string;
          body: string;
          status: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'FAILED' | 'BOUNCED';
          sent_at: string | null;
          delivered_at: string | null;
          opened_at: string | null;
          clicked_at: string | null;
          error_message: string | null;
          retry_count: number;
          metadata: any | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          recipient_id?: number | null;
          recipient: string;
          subject: string;
          body: string;
          status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'FAILED' | 'BOUNCED';
          metadata?: any | null;
        };
        Update: {
          status?: 'PENDING' | 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'FAILED' | 'BOUNCED';
          sent_at?: string | null;
          delivered_at?: string | null;
          opened_at?: string | null;
          clicked_at?: string | null;
          error_message?: string | null;
          retry_count?: number;
        };
      };
      activity_logs: {
        Row: {
          id: number;
          user_id: number;
          action: string;
          entity_type: string;
          entity_id: number;
          details: string | null;
          metadata: any | null;
          created_at: string;
        };
        Insert: {
          user_id: number;
          action: string;
          entity_type: string;
          entity_id: number;
          details?: string | null;
          metadata?: any | null;
        };
        Update: never;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
