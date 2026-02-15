import { View, Text, StyleSheet, ImageBackground } from 'react-native';

const catoBg = require('../assets/images/cato-bg.png');

export default function SplashScreen() {
  return (
    <ImageBackground source={catoBg} style={styles.background} resizeMode="cover">
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
    backgroundColor: 'rgba(26, 26, 46, 0.7)',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#e0c097',
    letterSpacing: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0c097',
    marginTop: 16,
    opacity: 0.7,
  },
});
