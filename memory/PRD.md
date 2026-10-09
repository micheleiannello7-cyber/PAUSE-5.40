# PAUSE — Product Requirement Document

## Overview
PAUSE is a bite-sized curiosity & microlearning Expo mobile app. Users pick topics they love and PAUSE serves short, narrated stories (and short lessons) with illustrated 3D / holographic covers, chapterized audio playback, bookmarks, collections and reading history.

## Origin
Imported from https://github.com/micheleiannello7-cyber/PAUSE-5.38 and overlaid with the user-supplied `PAUSE-modifiche-emergent.zip` session patches (holographic icons, home card badges, zoom fix, no-faces covers, Italian TTS naturalness, collection scroll-to-row, voice selector, collection summary background, etc.).

## Tech
- Frontend: Expo SDK 57 + expo-router, React 19, react-native 0.86, reanimated, expo-image, expo-audio, expo-video, SVG icons (holographic + 3D themes).
- Backend: FastAPI + Motor (MongoDB) with seeded content (12 categories, 493 stories).
- Storage: Emergent Managed Object Storage for cover images and TTS assets.
- LLM/TTS: Universal Emergent LLM key for OpenAI image/TTS (gpt-4o-mini-tts for Italian, tts-1-hd for English). TTS endpoints are gated by `TTS_ENABLED=true`.

## Key Features
- Onboarding (guest or Google) with topic selection (Curiosities / Learn).
- Discover feed with holographic card deck, Tipo · Categoria · Durata badges embedded in the card.
- Audio narration (shared cache per story+lang+voice+text hash).
- Collection grid with scroll-to-row deep-link + planet background and curiosity quote.
- Bookmarks, History, Stats, Premium/Paywall screens.
- Icon theme switcher (Holo / 3D) in Profile → Temi, persisted via AsyncStorage.

## Environment
- `/app/backend/.env`: MONGO_URL, DB_NAME, EMERGENT_LLM_KEY.
- `/app/frontend/.env`: EXPO_PACKAGER_* and EXPO_PUBLIC_BACKEND_URL (protected).
- Preview URL: https://pause-build-2.preview.emergentagent.com

## Status
- Both services running (supervisor: backend, expo).
- Onboarding and category grid verified end-to-end (frontend ↔ backend `/api/categories`).
- TTS disabled by default (TTS_ENABLED unset). Enable only if Universal Key balance available.

## Next Steps
- Enable `TTS_ENABLED=true` in backend `.env` if audio preview is desired (uses Universal Key credits).
- Continue cover-no-faces regeneration (`cd backend && python reduce_faces.py apply`) once more Universal Key balance is added.

## Import 5.39 (Oct 2026)
- Imported from https://github.com/micheleiannello7-cyber/PAUSE-5.39 as-is; only added EMERGENT_LLM_KEY to backend .env.
- Tested end-to-end: backend 13/13, guest onboarding → topics → discover → reader → bookmarks → profile all working.
- Mocked/disabled: TTS (TTS_ENABLED unset), Stripe (no STRIPE_API_KEY), Google login untested.

## Oct 2026 updates
- Topic picker: icons reduced 15%, removed light-bar/reflection under tiles (selection via glowing border).
- Shareable story cards: share bottom sheet in reader (Storia 9:16 / Post 4:5), 1080px PNG export via expo-sharing on device; text fallback on web.
- Icon themes: added "Gemstone 3D" family (SVG faceted gems + gold rims, src/components/gem-icons.tsx) wired in tab bar, action icons, kind badges, clocks, headphones, CTA. Profile → Themes redesigned (theme-family-picker.tsx) with 6 reference icons per theme. AI-rendered gem PNGs pending (script backend/gen_gem_icons.py) — Universal Key budget was 0.
- Gemstone 3D now uses 16 AI-rendered PNGs (frontend/assets/images/gem/, nav-topics-active recoloured from base); SVG kept as fallback. Theme picker: same icon order for all 3 themes; Hologram marked "TEMA BASE" with note that only it follows the accent colour.
- Icon themes 3D Realistico & Gemstone 3D are Premium-only (useIconFamily falls back to holo for free users; locked cards route to /premium). Topic light bars restored.
- Collection: "storie completate" shown as bold pill; quote changed to "Non smettere mai di essere curioso, la curiosità è la chiave di ogni scoperta". Mini collection card (reader ending) shows the full cover without title overlay.
- Collection locked cards now show dimmed category 3D art + lock badge per category.
- Reading time: reading_time_min/deep_dive_time_min now = real silent-reading estimate (210 wpm + 3s/chapter, rounded; stored as reading_minutes_est it/en). Audio estimate exposed as audio_time_min (used by playlist). Note: Universal Key currently invalid/without credit → new cover uploads to object storage fail (401), existing covers served from cache; gen_theme_icons.py ready for Gemstone categories + Carta theme.
- Collection now counts full catalog (493 = 304 curiosità + 189 lezioni); early-access Premium stories shown as locked cards.
