import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { C, navyBg } from '../lib/theme';

const homeBg = require('../assets/images/home-bg.png');

export default function SplashScreen() {
  return (
    <ImageBackground source={homeBg} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <Text style={styles.title}>CETERUM</Text>
        <Text style={styles.subtitle}>Entering the Senate...</Text>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: navyBg(0.7),
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: C.parchment,
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 16,
    color: C.parchment,
    marginTop: 16,
    opacity: 0.7,
  },
});
