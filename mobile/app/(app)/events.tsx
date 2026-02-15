import { View, Text, StyleSheet, Pressable, FlatList, ActivityIndicator, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getEvents, markAllRead, type GameEvent } from '../../lib/events';

const eventsBg = require('../../assets/images/events-bg.png');

export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [events, setEvents] = useState<GameEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
      await markAllRead();
    } finally {
      setLoading(false);
    }
  }

  function formatTime(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  if (loading) {
    return (
      <ImageBackground source={eventsBg} style={styles.background} resizeMode="cover">
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#e0c097" />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={eventsBg} style={styles.background} resizeMode="cover">
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.title}>Events</Text>

      {events.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No events yet</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[styles.eventCard, !item.read && styles.eventCardUnread]}>
              <View style={styles.eventHeader}>
                <Text style={styles.eventTitle}>{item.title}</Text>
                <Text style={styles.eventTime}>{formatTime(item.created_at)}</Text>
              </View>
              <Text style={styles.eventBody}>{item.body}</Text>
            </View>
          )}
          style={styles.list}
          contentContainerStyle={styles.listContent}
        />
      )}

      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e0c097',
    marginBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: '#e0c097',
    opacity: 0.5,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    gap: 10,
  },
  eventCard: {
    backgroundColor: 'rgba(224, 192, 151, 0.08)',
    borderRadius: 8,
    padding: 14,
  },
  eventCardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: '#e0c097',
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  eventTitle: {
    color: '#e0c097',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  eventTime: {
    color: '#e0c097',
    opacity: 0.5,
    fontSize: 12,
    marginLeft: 8,
  },
  eventBody: {
    color: '#e0c097',
    opacity: 0.8,
    fontSize: 14,
  },
  backButton: {
    paddingVertical: 24,
  },
  backText: {
    color: '#e0c097',
    opacity: 0.6,
    fontSize: 16,
  },
});
