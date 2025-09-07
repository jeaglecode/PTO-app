import { Injectable } from '@angular/core';
import { supabase } from '../supabase/supabase.client';
import { AuthService } from '../auth/auth.service';
import { State } from './pto.types';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PtoDataService {
  constructor(private auth: AuthService) {}

  private async uid(): Promise<string> {
    // Ask Supabase for the current session to handle refresh cases
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) throw new Error('Not authenticated');
    return uid;
  }

  async save(state: State) {
    const uid = await this.uid();
    const payload = { user_id: uid, data: state, updated_at: new Date().toISOString() } as any;
    const { error } = await supabase.from('pto_states').upsert(payload, { onConflict: 'user_id' });
    if (error) throw error;
  }

  async load(): Promise<State | null> {
    const uid = await this.uid();
    const { data, error } = await supabase
      .from('pto_states')
      .select('data')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    // When selecting a single column, Supabase returns an object with that column key
    return (data as any).data as State;
  }

  // Save using fetch keepalive so it can complete during reload/navigation
  async saveKeepalive(state: State) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const uid = sessionData.session?.user?.id;
    if (!token || !uid) return; // can't save without session

    const url = `${environment.supabaseUrl}/rest/v1/pto_states?on_conflict=user_id`;
    const row = { user_id: uid, data: state, updated_at: new Date().toISOString() };
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': environment.supabaseAnonKey,
          'Authorization': `Bearer ${token}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify([row]),
        keepalive: true
      });
    } catch {}
  }
}
