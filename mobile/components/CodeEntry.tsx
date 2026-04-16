import { View, Text, StyleSheet, Pressable, TextInput, ActivityIndicator, KeyboardTypeOptions } from 'react-native';
import { C, parchmentBg } from '../lib/theme';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
  buttonLabel: string;
  submitting?: boolean;
  error?: string | null;
  autoCapitalize?: 'characters' | 'none';
  keyboardType?: KeyboardTypeOptions;
};

export function CodeEntry({
  value,
  onChangeText,
  onSubmit,
  buttonLabel,
  submitting = false,
  error = null,
  autoCapitalize = 'characters',
  keyboardType = 'default',
}: Props) {
  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="ABCDEF"
        placeholderTextColor={parchmentBg(0.3)}
        value={value}
        onChangeText={(text) => {
          const cleaned = text.replace(/\u200B/g, '').toUpperCase();
          onChangeText(cleaned || '\u200B');
        }}
        onFocus={() => { if (!value) onChangeText('\u200B'); }}
        onBlur={() => { if (value === '\u200B') onChangeText(''); }}
        maxLength={7}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        autoCorrect={false}
        editable={!submitting}
      />

      {submitting ? (
        <ActivityIndicator size="large" color={C.parchment} />
      ) : (
        <Pressable style={styles.button} onPress={onSubmit}>
          <Text style={styles.buttonText}>{buttonLabel}</Text>
        </Pressable>
      )}

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  input: {
    width: '100%',
    fontSize: 32,
    fontWeight: 'bold',
    color: C.parchment,
    textAlign: 'center',
    letterSpacing: 8,
    borderBottomWidth: 2,
    borderBottomColor: C.parchment,
    paddingVertical: 12,
    marginBottom: 32,
  },
  button: {
    backgroundColor: parchmentBg(0.15),
    borderWidth: 1,
    borderColor: C.parchment,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  buttonText: {
    color: C.parchment,
    fontSize: 18,
    fontWeight: '600',
  },
  error: {
    color: C.error,
    marginTop: 16,
  },
});
