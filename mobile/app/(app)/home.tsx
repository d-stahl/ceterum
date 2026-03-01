import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { UserProfileIcon, NotificationBellIcon } from '../../lib/icons';
import { getUnreadCount } from '../../lib/events';
import { C, parchmentBg, navyBg } from '../../lib/theme';

const homeBg = require('../../assets/images/home-bg.png');

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
      loadUnreadCount();
    }, [])
  );

  useEffect(() => {
    const channel = supabase
      .channel('home-events')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'events' },
        () => { loadUnreadCount(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function loadUnreadCount() {
    const count = await getUnreadCount();
    setUnreadCount(count);
  }

  async function loadProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();
      if (data) setDisplayName(data.display_name);
    }
  }

  return (
    <ImageBackground source={homeBg} style={styles.background} resizeMode="cover">
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.push('/(app)/events')}
          >
            <NotificationBellIcon size={28} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.push('/(app)/profile')}
          >
            <UserProfileIcon size={28} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>CETERUM</Text>
          <Text style={styles.welcome}>Welcome, {displayName}</Text>

          <View style={styles.buttons}>
            <Pressable style={styles.button} onPress={() => router.push('/(app)/create-game')}>
              <Text style={styles.buttonText}>Create Game</Text>
            </Pressable>

            <Pressable style={styles.button} onPress={() => router.push('/(app)/join-game')}>
              <Text style={styles.buttonText}>Join Game</Text>
            </Pressable>

            <Pressable style={styles.button} onPress={() => router.push('/(app)/my-games')}>
              <Text style={styles.buttonText}>My Games</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: navyBg(0.7),
    paddingHorizontal: 32,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerButton: {
    padding: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: C.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: C.parchment,
    letterSpacing: 8,
    marginBottom: 8,
  },
  welcome: {
    fontSize: 16,
    color: C.parchment,
    marginBottom: 48,
    opacity: 0.8,
  },
  buttons: {
    width: '100%',
    gap: 16,
  },
  button: {
    backgroundColor: parchmentBg(0.15),
    borderWidth: 1,
    borderColor: C.parchment,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: C.parchment,
    fontSize: 18,
    fontWeight: '600',
  },
});
