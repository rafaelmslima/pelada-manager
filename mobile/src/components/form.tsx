import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

export function Field({ label, ...props }: { label: string } & ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} placeholderTextColor={colors.ink4} {...props} />
    </View>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.segmented}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => onChange(opt.value)}
              activeOpacity={0.8}>
              <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={styles.switchLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border2, true: colors.green }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.primary, (disabled || loading) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}>
      {loading ? <ActivityIndicator color={colors.onDark} /> : <Text style={styles.primaryText}>{label}</Text>}
    </TouchableOpacity>
  );
}

export function GhostButton({
  label,
  onPress,
  tone = 'neutral',
}: {
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'danger';
}) {
  return (
    <TouchableOpacity
      style={[styles.ghost, tone === 'danger' && styles.ghostDanger]}
      onPress={onPress}
      activeOpacity={0.8}>
      <Text style={[styles.ghostText, tone === 'danger' && styles.ghostTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.one },
  label: { color: colors.ink3, fontSize: 12, fontWeight: '700' },
  input: {
    backgroundColor: colors.page,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border2,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.three,
    color: colors.ink,
    fontSize: 15,
  },
  segmented: { flexDirection: 'row', gap: spacing.two },
  segment: {
    flex: 1,
    paddingVertical: spacing.three,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border2,
    alignItems: 'center',
    backgroundColor: colors.page,
  },
  segmentActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  segmentText: { color: colors.ink2, fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: colors.onDark },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.one,
  },
  switchLabel: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1 },
  primary: {
    backgroundColor: colors.dark,
    borderRadius: radius.btn,
    paddingVertical: spacing.four,
    alignItems: 'center',
  },
  primaryText: { color: colors.onDark, fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  ghost: {
    borderRadius: radius.btn,
    paddingVertical: spacing.three,
    alignItems: 'center',
    backgroundColor: colors.raised,
  },
  ghostDanger: { backgroundColor: colors.absBg },
  ghostText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  ghostTextDanger: { color: colors.absT },
});
