import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { UserProfileIcon } from '../../lib/icons';

const catoBg = require('../../assets/images/cato-bg.png');

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

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
    <ImageBackground source={catoBg} style={styles.background} resizeMode="cover">
      <View style={[styles.overlay, { paddingTop: insets.top }]}>
        <Pressable
          style={styles.profileButton}
          onPress={() => router.push('/(app)/profile')}
        >
          <UserProfileIcon size={28} />
        </Pressable>

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
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    paddingHorizontal: 32,
  },
  profileButton: {
    alignSelf: 'flex-end',
    padding: 12,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e0c097',
    letterSpacing: 8,
    marginBottom: 8,
  },
  welcome: {
    fontSize: 16,
    color: '#e0c097',
    marginBottom: 48,
    opacity: 0.8,
  },
  buttons: {
    width: '100%',
    gap: 16,
  },
  button: {
    backgroundColor: 'rgba(224, 192, 151, 0.15)',
    borderWidth: 1,
    borderColor: '#e0c097',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#e0c097',
    fontSize: 18,
    fontWeight: '600',
  },
});
