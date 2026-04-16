import { Session } from '@supabase/supabase-js';
import { isAuthApiError } from '@supabase/auth-js';
import { supabase } from './supabase';
import { generateUniqueName } from './name-generator';

/**
 * Return the cached session without a network probe.
 * Used by root layout at startup — lenient cache: we trust the session
 * until a real API call proves it invalid via onAuthStateChange.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Explicitly create a new anonymous user. Only called from the Create Profile
 * button on the unauthenticated landing screen. The handle_new_user trigger
 * auto-inserts a profile row; we then update it with a generated display name.
 */
export async function createAnonymousUser(): Promise<Session> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  if (!data.session) throw new Error('signInAnonymously returned no session');

  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('display_name');
  const existingNames = (existingProfiles ?? []).map((p) => p.display_name);
  const displayName = await generateUniqueName(existingNames);

  await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', data.session.user.id);

  return data.session;
}

/**
 * Start email sign-in flow. Always resolves (swallows user-not-found errors
 * to prevent email enumeration). Caller then shows the OTP dialog regardless
 * of whether an OTP was actually issued.
 */
export async function signInWithEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (!error) return;
  // Swallow non-enumeration-sensitive errors so the UI can show the same
  // "if the mail exists…" message regardless of whether an OTP was issued.
  const swallowable =
    isAuthApiError(error) &&
    (error.code === 'user_not_found' ||
      error.code === 'signup_disabled' ||
      error.code === 'over_email_send_rate_limit' ||
      error.code === 'over_request_rate_limit');
  if (!swallowable) throw error;
}

/**
 * Complete email sign-in. On success the Supabase client sets the session
 * internally and onAuthStateChange fires SIGNED_IN.
 */
export async function verifyEmailOtp(email: string, token: string): Promise<Session> {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;
  if (!data.session) throw new Error('verifyOtp returned no session');
  return data.session;
}

/**
 * Start email-attach / change flow. Must be called while authenticated.
 * Sends an OTP to the new email address.
 */
export async function requestEmailUpdate(email: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
}

/**
 * Complete email-attach / change flow. After success we mirror the email
 * onto the profiles row so the rest of the app can read it via the profiles
 * table (which is what Profile screen queries).
 */
export async function verifyEmailUpdate(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email_change',
  });
  if (error) throw error;

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ email })
      .eq('id', user.id);
  }
}

/**
 * Sign out globally (invalidates all refresh tokens for this user).
 * onAuthStateChange fires SIGNED_OUT; root layout routes to /.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
