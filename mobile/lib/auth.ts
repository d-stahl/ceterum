import { supabase } from './supabase';
import { generateUniqueName } from './name-generator';

export async function ensureAuthenticated() {
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // Validate the session is still good (user exists in DB after a reset)
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      return session;
    }

    // Stale session - sign out and re-authenticate
    await supabase.auth.signOut();
  }

  // Sign in anonymously
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;

  // Generate a unique display name
  const { data: existingProfiles } = await supabase
    .from('profiles')
    .select('display_name');

  const existingNames = (existingProfiles ?? []).map((p) => p.display_name);
  const displayName = await generateUniqueName(existingNames);

  // Update the auto-created profile with the generated name
  await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', data.session!.user.id);

  return data.session;
}

export async function linkEmail(email: string) {
  const { error } = await supabase.auth.signInWithOtp({ email });
  if (error) throw error;
}

export async function verifyOtp(email: string, token: string) {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;

  // Update profile with email
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase
      .from('profiles')
      .update({ email })
      .eq('id', user.id);
  }
}
