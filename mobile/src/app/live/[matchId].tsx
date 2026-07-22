import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '@/lib/api';
import { formatPosition } from '@/lib/format';
import type { MatchRead } from '@/lib/types';
import { colors, fonts, radius, spacing } from '@/theme';

function applyDelta(match: MatchRead, mpId: number, goals: number, assists: number): MatchRead {
  return {
    ...match,
    teams: match.teams.map((team) => ({
      ...team,
      players: team.players.map((mp) =>
        mp.id === mpId
          ? { ...mp, goals: Math.max(0, mp.goals + goals), assists: Math.max(0, mp.assists + assists) }
          : mp,
      ),
    })),
  };
}

function teamScore(team: MatchRead['teams'][number]): number {
  return team.players.reduce((sum, mp) => sum + mp.goals, 0);
}

export default function LiveMatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const id = Number(matchId);

  const [match, setMatch] = useState<MatchRead | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    api.getMatch(id).then(setMatch).catch(() => {});
  }, [id]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [running]);

  function event(mpId: number, goals: number, assists: number) {
    if (!match) return;
    setMatch(applyDelta(match, mpId, goals, assists));
    api.matchEvent(id, mpId, goals, assists).catch(() => load());
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <View style={[styles.page, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="chevron-back" size={26} color={colors.onDark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ao vivo</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={styles.timerCard}>
        <Text style={styles.timer}>
          {mm}:{ss}
        </Text>
        <View style={styles.timerActions}>
          <TouchableOpacity style={styles.timerBtn} onPress={() => setRunning((r) => !r)} activeOpacity={0.85}>
            <Ionicons name={running ? 'pause' : 'play'} size={20} color={colors.dark} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.timerBtnGhost}
            onPress={() => {
              setRunning(false);
              setSeconds(0);
            }}
            activeOpacity={0.85}>
            <Ionicons name="refresh" size={18} color={colors.onDark} />
          </TouchableOpacity>
        </View>
      </View>

      {!match ? (
        <ActivityIndicator color={colors.onDark} style={{ marginTop: spacing.six }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {match.teams.map((team) => (
            <View key={team.id} style={styles.teamCard}>
              <View style={styles.teamHeader}>
                <Text style={styles.teamName}>{team.name}</Text>
                <Text style={styles.teamScore}>{teamScore(team)}</Text>
              </View>
              {team.players.map((mp) => (
                <View key={mp.id} style={styles.playerRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.playerName}>{mp.player.name}</Text>
                    <Text style={styles.playerMeta}>
                      {formatPosition(mp.player.position)} · {mp.goals}G · {mp.assists}A
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.goalBtn} onPress={() => event(mp.id, 1, 0)} activeOpacity={0.8}>
                    <Ionicons name="football" size={16} color={colors.onDark} />
                    <Text style={styles.goalBtnText}>Gol</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.assistBtn} onPress={() => event(mp.id, 0, 1)} activeOpacity={0.8}>
                    <Text style={styles.assistBtnText}>+A</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => event(mp.id, -1, 0)} hitSlop={6} style={styles.undo}>
                    <Ionicons name="remove-circle-outline" size={20} color={colors.onDark2} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ))}

          <TouchableOpacity
            style={[styles.finish, { marginBottom: insets.bottom + spacing.four }]}
            onPress={() => router.back()}
            activeOpacity={0.85}>
            <Text style={styles.finishText}>Encerrar partida</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.dark },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.four,
    paddingVertical: spacing.three,
  },
  headerTitle: { color: colors.onDark, fontSize: 16, fontWeight: '700' },

  timerCard: { alignItems: 'center', gap: spacing.three, paddingVertical: spacing.three },
  timer: { color: colors.onDark, fontSize: 68, fontFamily: fonts.display, letterSpacing: 3 },
  timerActions: { flexDirection: 'row', gap: spacing.three },
  timerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerBtnGhost: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.dark2,
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: { paddingHorizontal: spacing.four, paddingTop: spacing.three, gap: spacing.three },
  teamCard: { backgroundColor: colors.dark2, borderRadius: radius.cardMd, padding: spacing.three, gap: spacing.two },
  teamHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  teamName: { color: colors.onDark, fontSize: 16, fontWeight: '800' },
  teamScore: { color: colors.green, fontSize: 34, fontFamily: fonts.display },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.two },
  playerName: { color: colors.onDark, fontSize: 14, fontWeight: '600' },
  playerMeta: { color: colors.onDark2, fontSize: 12 },
  goalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.one,
    backgroundColor: colors.green,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    borderRadius: radius.btn,
  },
  goalBtnText: { color: colors.onDark, fontWeight: '800', fontSize: 13 },
  assistBtn: {
    backgroundColor: colors.dark3,
    paddingHorizontal: spacing.three,
    paddingVertical: spacing.two,
    borderRadius: radius.btn,
  },
  assistBtnText: { color: colors.onDark, fontWeight: '800', fontSize: 13 },
  undo: { paddingHorizontal: spacing.one },

  finish: {
    backgroundColor: colors.surface,
    borderRadius: radius.btn,
    paddingVertical: spacing.four,
    alignItems: 'center',
    marginTop: spacing.two,
  },
  finishText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
});
