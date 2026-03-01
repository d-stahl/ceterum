import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { C, navyBg } from '../lib/theme';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';

type Props = {
  subRound: number;
  roundNumber: number;
};

export default function SubRoundAnnouncement({ subRound, roundNumber }: Props) {
  const opacity = useSharedValue(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(true);
    opacity.value = withSequence(
      withTiming(1, { duration: 400 }),
      withDelay(1500, withTiming(0, { duration: 400 })),
    );

    const timer = setTimeout(() => {
      setVisible(false);
    }, 2400);

    return () => clearTimeout(timer);
  }, [subRound, roundNumber]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, animatedStyle]} pointerEvents="none">
      <Animated.Text style={styles.title}>DEMAGOGERY</Animated.Text>
      <Animated.Text style={styles.step}>Step {subRound}</Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: navyBg(0.85),
    zIndex: 10000,
  },
  title: {
    color: C.parchment,
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 6,
    marginBottom: 8,
  },
  step: {
    color: C.parchment,
    fontSize: 20,
    opacity: 0.7,
    letterSpacing: 2,
  },
});
