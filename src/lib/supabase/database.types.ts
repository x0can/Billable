// Shape matches `supabase gen types typescript --local`. Regenerate with `npm run db:types`.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      clients: {
        Row: { created_at: string | null; email: string | null; id: string; name: string; owner_id: string };
        Insert: { created_at?: string | null; email?: string | null; id?: string; name: string; owner_id?: string };
        Update: { created_at?: string | null; email?: string | null; id?: string; name?: string; owner_id?: string };
        Relationships: [];
      };
      invoices: {
        Row: {
          client_id: string;
          due_on: string | null;
          id: string;
          issued_on: string | null;
          number: string;
          owner_id: string;
          status: string;
          tax_rate: number;
          total: number;
        };
        Insert: {
          client_id: string;
          due_on?: string | null;
          id?: string;
          issued_on?: string | null;
          number: string;
          owner_id?: string;
          status?: string;
          tax_rate?: number;
          total?: number;
        };
        Update: {
          client_id?: string;
          due_on?: string | null;
          id?: string;
          issued_on?: string | null;
          number?: string;
          owner_id?: string;
          status?: string;
          tax_rate?: number;
          total?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'invoices_client_same_owner';
            columns: ['client_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      projects: {
        Row: {
          budget_hours: number | null;
          client_id: string;
          created_at: string | null;
          end_date: string | null;
          hourly_rate: number;
          id: string;
          name: string;
          owner_id: string;
          start_date: string | null;
          status: string;
        };
        Insert: {
          budget_hours?: number | null;
          client_id: string;
          created_at?: string | null;
          end_date?: string | null;
          hourly_rate: number;
          id?: string;
          name: string;
          owner_id?: string;
          start_date?: string | null;
          status?: string;
        };
        Update: {
          budget_hours?: number | null;
          client_id?: string;
          created_at?: string | null;
          end_date?: string | null;
          hourly_rate?: number;
          id?: string;
          name?: string;
          owner_id?: string;
          start_date?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'projects_client_same_owner';
            columns: ['client_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
      time_entries: {
        Row: {
          billable: boolean;
          description: string | null;
          entry_date: string;
          hours: number;
          id: string;
          invoice_id: string | null;
          owner_id: string;
          project_id: string;
        };
        Insert: {
          billable?: boolean;
          description?: string | null;
          entry_date?: string;
          hours: number;
          id?: string;
          invoice_id?: string | null;
          owner_id?: string;
          project_id: string;
        };
        Update: {
          billable?: boolean;
          description?: string | null;
          entry_date?: string;
          hours?: number;
          id?: string;
          invoice_id?: string | null;
          owner_id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'time_entries_invoice_same_owner';
            columns: ['invoice_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'invoices';
            referencedColumns: ['id', 'owner_id'];
          },
          {
            foreignKeyName: 'time_entries_project_same_owner';
            columns: ['project_id', 'owner_id'];
            isOneToOne: false;
            referencedRelation: 'projects';
            referencedColumns: ['id', 'owner_id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      generate_invoice: {
        Args: { p_client_id: string; p_due_on?: string; p_tax_rate?: number };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
