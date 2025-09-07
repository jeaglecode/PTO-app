import { Injectable, signal } from '@angular/core';
import { supabase } from '../supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // Current user signal (null when signed out)
  user = signal<import('@supabase/supabase-js').User | null>(null);

  constructor() {
    // Initialize from current session
    supabase.auth.getSession().then(({ data }) => {
      this.user.set(data.session?.user ?? null);
    });
    // React to auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      this.user.set(session?.user ?? null);
    });
  }

  async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async register(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }
}

