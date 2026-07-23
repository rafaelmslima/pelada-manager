import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Field, GhostButton } from '@/components/form';
import { DEFAULT_API_BASE_URL, getApiBaseUrl, setApiBaseUrlOverride } from '@/lib/config';
import { clearApiUrl, getApiUrl, saveApiUrl } from '@/lib/storage';
import { colors, spacing } from '@/theme';

/**
 * Campo de depuração para apontar o app a outro backend. Só aparece em desenvolvimento
 * (`__DEV__`) — em produção o app já usa o backend do Railway automaticamente, então o
 * usuário final não vê nem precisa configurar nada.
 */
export function ServerUrlField() {
  const [url, setUrl] = useState('');
  const [current, setCurrent] = useState(getApiBaseUrl());
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getApiUrl().then((value) => {
      if (value) setUrl(value);
    });
  }, []);

  async function apply() {
    const trimmed = url.trim();
    if (trimmed) {
      await saveApiUrl(trimmed);
      setApiBaseUrlOverride(trimmed);
    } else {
      await clearApiUrl();
      setApiBaseUrlOverride(null);
    }
    setCurrent(getApiBaseUrl());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // Em produção o app já aponta para o Railway; escondemos o campo do usuário final.
  if (!__DEV__) return null;

  return (
    <View style={styles.wrap}>
      <Field
        label="Servidor (URL da API)"
        value={url}
        onChangeText={setUrl}
        placeholder={DEFAULT_API_BASE_URL}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
      />
      <View style={styles.row}>
        <Text style={styles.current} numberOfLines={1}>
          Atual: {current}
        </Text>
        <View style={styles.btn}>
          <GhostButton label={saved ? 'Salvo ✓' : 'Aplicar'} onPress={apply} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.three },
  current: { color: colors.ink3, fontSize: 12, flex: 1 },
  btn: { minWidth: 96 },
});
