import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Sheet } from '@/components/Sheet';
import { Field, GhostButton, PrimaryButton } from '@/components/form';
import { cancelAllReminders, countScheduledReminders, scheduleReminder } from '@/lib/reminders';
import { colors, spacing } from '@/theme';

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function ReminderSheet({
  visible,
  peladaName,
  defaultTime,
  onClose,
}: {
  visible: boolean;
  peladaName: string;
  defaultTime: string;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState(defaultTime || '20:00');
  const [count, setCount] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setDate(todayISO());
      setTime(defaultTime || '20:00');
      setFeedback(null);
      countScheduledReminders().then(setCount);
    }
  }, [visible, defaultTime]);

  async function schedule() {
    const when = new Date(`${date}T${time}:00`);
    if (isNaN(when.getTime())) {
      setFeedback('Data ou hora inválida.');
      return;
    }
    const ok = await scheduleReminder(
      when,
      `⚽ ${peladaName}`,
      'Sua pelada é hoje! Confirme presença e convoque a galera.',
    );
    setFeedback(
      ok ? 'Lembrete agendado ✓' : 'Não foi possível agendar (permissão negada ou data no passado).',
    );
    setCount(await countScheduledReminders());
  }

  async function cancel() {
    await cancelAllReminders();
    setCount(0);
    setFeedback('Lembretes cancelados.');
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Lembrete da pelada">
      <Text style={styles.hint}>
        Agende um lembrete no seu celular para não esquecer de convocar a galera.
      </Text>
      <View style={styles.row}>
        <View style={{ flex: 1.4 }}>
          <Field label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Hora (HH:MM)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
        </View>
      </View>
      {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
      <PrimaryButton label="Agendar lembrete" onPress={schedule} />
      {count > 0 && <GhostButton label={`Cancelar lembretes (${count})`} tone="danger" onPress={cancel} />}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.ink3, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: spacing.three },
  feedback: { color: colors.greenB, fontSize: 13, fontFamily: undefined },
});
