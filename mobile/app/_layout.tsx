import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { ensureAuthenticated } from '../lib/auth';
import * as Notifications from 'expo-notifications';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    ensureAuthenticated()
      .then((session) => {
        setSession(session);
        setUserId(session.user.id);
      })
      .catch((e) => {
        console.error('Auth error:', e);
        setError(String(e?.message ?? e));
      })
      .finally(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (loading) return;

    const inApp = segments[0] === '(app)';

    if (session && !inApp) {
      router.replace('/(app)/home');
    } else if (!session && inApp) {
      router.replace('/');
    }
  }, [session, loading, segments]);

  useEffect(() => {
    if (!userId) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    const channel = supabase
      .channel('events-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          Notifications.scheduleNotificationAsync({
            content: {
              title: payload.new.title,
              body: payload.new.body,
            },
            trigger: null,
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#e0c097" />
        <Text style={styles.status}>Connecting...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loading}>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Text style={styles.errorHint}>
          Supabase URL: {process.env.EXPO_PUBLIC_SUPABASE_URL}
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 32,
  },
  status: {
    color: '#e0c097',
    marginTop: 16,
    opacity: 0.6,
  },
  errorTitle: {
    color: '#ff6b6b',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  errorHint: {
    color: '#e0c097',
    fontSize: 12,
    opacity: 0.5,
    textAlign: 'center',
  },
});
