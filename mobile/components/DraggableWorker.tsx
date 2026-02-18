import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { WorkerType } from '../lib/game-engine/workers';
import { getSenatorIcon, getSenatorEmptyIcon, getSaboteurEmptyIcon, getSaboteurIcon } from '../lib/worker-icons';
import { getColorHex } from '../lib/player-colors';

type Props = {
  workerType: WorkerType;
  playerColor: string;
  size?: number;
  disabled?: boolean;
  showEmpty?: boolean;
  onDragStart?: (workerType: WorkerType, absoluteX: number, absoluteY: number) => void;
  onDragMove?: (absoluteX: number, absoluteY: number) => void;
  onDragEnd?: (absoluteX: number, absoluteY: number) => void;
};

export default function DraggableWorker({
  workerType,
  playerColor,
  size = 48,
  disabled,
  showEmpty,
  onDragStart,
  onDragMove,
  onDragEnd,
}: Props) {
  const isDragging = useSharedValue(false);

  const pan = Gesture.Pan()
    .enabled(!disabled)
    .onStart((e) => {
      isDragging.value = true;
      if (onDragStart) {
        runOnJS(onDragStart)(workerType, e.absoluteX, e.absoluteY);
      }
    })
    .onUpdate((e) => {
      if (onDragMove) {
        runOnJS(onDragMove)(e.absoluteX, e.absoluteY);
      }
    })
    .onEnd((e) => {
      isDragging.value = false;
      if (onDragEnd) {
        runOnJS(onDragEnd)(e.absoluteX, e.absoluteY);
      }
    });

  // Opacity: 0 when actively dragging (overlay handles the visual),
  // 0.4 for empty icons, 0.3 for disabled, 1 otherwise
  const baseOpacity = showEmpty ? 0.4 : disabled ? 0.3 : 1;
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: isDragging.value ? 0 : baseOpacity,
  }));

  const colorHex = getColorHex(playerColor);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.wrapper, { width: size, height: size }, animatedStyle]}>
        {showEmpty ? (
          <EmptyIcon workerType={workerType} size={size} />
        ) : (
          <ColoredIcon workerType={workerType} playerColor={playerColor} colorHex={colorHex} size={size} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

function ColoredIcon({ workerType, playerColor, colorHex, size }: { workerType: WorkerType; playerColor: string; colorHex: string; size: number }) {
  if (workerType === 'orator') {
    return (
      <Image
        source={getSenatorIcon(playerColor)}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  if (workerType === 'promoter') {
    return (
      <View
        style={[
          styles.promoterSquare,
          {
            width: size * 0.7,
            height: size * 0.7,
            backgroundColor: colorHex,
            borderRadius: size * 0.1,
          },
        ]}
      />
    );
  }
  if (workerType === 'saboteur') {
    return (
      <Image
        source={getSaboteurIcon(playerColor)}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  return null;
}

function EmptyIcon({ workerType, size }: { workerType: WorkerType; size: number }) {
  if (workerType === 'orator') {
    return (
      <Image
        source={getSenatorEmptyIcon()}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  if (workerType === 'saboteur') {
    return (
      <Image
        source={getSaboteurEmptyIcon()}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    );
  }
  // Promoter: outlined square with no fill
  return (
    <View
      style={{
        width: size * 0.7,
        height: size * 0.7,
        borderRadius: size * 0.1,
        borderWidth: 1.5,
        borderColor: 'rgba(224, 192, 151, 0.25)',
      }}
    />
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoterSquare: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
});
