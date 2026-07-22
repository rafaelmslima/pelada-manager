# Pelapan — App mobile (Expo)

App nativo (Android/iOS) do Pelada Manager, feito com **Expo + Expo Router + TypeScript**.
Reutiliza o backend **FastAPI** do projeto (mesmo servidor da web). Autenticação por
**Bearer token** guardado com `expo-secure-store`.

## Rodar em desenvolvimento

1. Suba o backend na raiz do projeto:
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0
   ```
2. Configure a URL da API (veja abaixo) e inicie o app:
   ```bash
   cd mobile
   npx expo start
   ```
3. Abra no emulador Android (`a`), iOS (`i`) ou no app **Expo Go** (QR code).

## URL da API (`EXPO_PUBLIC_API_URL`)

O cliente resolve a base da API em [src/lib/config.ts](src/lib/config.ts):

- **Sem variável definida** (dev): usa o localhost do host — `http://10.0.2.2:8000`
  no emulador Android e `http://localhost:8000` no iOS/web.
- **Aparelho físico (Expo Go):** defina o IP da sua máquina na rede local:
  ```bash
  EXPO_PUBLIC_API_URL=http://192.168.0.10:8000 npx expo start
  ```
- **Produção:** aponte para o backend do Railway:
  ```bash
  EXPO_PUBLIC_API_URL=https://SEU-APP.up.railway.app npx expo start
  ```

## Estrutura

```
src/
  app/                 rotas (Expo Router)
    _layout.tsx        raiz: AuthProvider + gate login/tabs
    login.tsx          login / cadastro
    (tabs)/            5 abas: index (Início), jogadores, times, ranking, config
  components/          Screen, Placeholder (UI base)
  lib/                 api, auth, types, format, config, storage
  theme/               tokens de cor/espaçamento (portados da web)
```

## Estado atual (Fase 0 concluída)

- Auth por token ligada ao backend real (login/cadastro/logout/sessão persistida).
- Navegação com as 5 abas. **Início** já mostra dados reais; as demais são placeholders
  a serem portados da web na Fase 1.

## Notas

- Verificação de tipos: `npx tsc --noEmit`.
- SDK 57 — consulte a doc versionada em https://docs.expo.dev/versions/v57.0.0/ antes de
  usar APIs novas (ver `AGENTS.md`).
