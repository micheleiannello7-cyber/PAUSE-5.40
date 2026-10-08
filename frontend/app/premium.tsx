import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, LayoutAnimation, Platform, UIManager } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@react-native-vector-icons/ionicons";

import { api, heroUrl } from "@/src/api";
import { spacing, radius, typography, useTheme, makeStyles, withAlpha } from "@/src/theme";
import { GradientButton } from "@/src/components/gradient-button";
import { HomeButton } from "@/src/components/home-button";
import { Screen } from "@/src/components/screen";
import { PLANS, PlanId, YEARLY_PER_MONTH, usePremium } from "@/src/premium";
import { useI18n } from "@/src/i18n";

// Paywall v4 — hero con le tre copertine a ventaglio e selettore piani
// (invariati). Sotto: quattro card fotografiche "glass" con ciò che Premium
// sblocca, un link che espande la lista completa, un confronto rapido
// Gratis / Premium a cinque righe e la CTA fissa in basso.
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FEATURE_ART = {
  stories: require("../assets/images/premium-stories.jpg"),
  learn: require("../assets/images/premium-learn.jpg"),
  audio: require("../assets/images/premium-audio.jpg"),
  personal: require("../assets/images/premium-personal.jpg"),
};

export default function Premium() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useI18n();
  const { colors, scheme } = useTheme();
  const styles = useStyles();
  const { isPremium, activate, cancel, isPending } = usePremium();
  const [selected, setSelected] = useState<PlanId>("yearly");
  const [allFeatures, setAllFeatures] = useState(false);
  const plan = PLANS.find((p) => p.id === selected)!;
  const yearly = PLANS.find((p) => p.id === "yearly")!;

  // Tre copertine reali per il ventaglio in alto (prima le più "cinematografiche").
  const { data: stories } = useQuery({ queryKey: ["paywall-covers"], queryFn: () => api.stories({ limit: 60 }) });
  const withCover = (stories ?? []).filter((s) => s.hero_image_generated);
  const preferred = ["aurora-borealis", "black-holes-basics", "how-stars-die", "moon-tides", "mars-red", "how-many-galaxies"];
  const covers = [
    ...preferred.map((id) => withCover.find((s) => s.id === id)).filter(Boolean),
    ...withCover.filter((s) => !preferred.includes(s.id)),
  ].slice(0, 3) as typeof withCover;

  const planLabel = (id: PlanId) => (id === "monthly" ? t.plan_month : id === "yearly" ? t.plan_year : t.plan_lifetime);
  const planPeriod = (id: PlanId) => (id === "monthly" ? t.per_month : id === "yearly" ? t.per_year : t.per_once);

  // Sotto al selettore: cosa comporta il piano scelto.
  const planHint = plan.trialDays
    ? t.trial_note.replace("{d}", String(plan.trialDays))
    : plan.id === "lifetime" ? t.pw_lifetime_hint : t.pw_month_hint;
  const ctaLabel = plan.trialDays ? t.pw_cta_trial : t.pw_cta_plan.replace("{plan}", planLabel(plan.id));
  const ctaNote = plan.trialDays
    ? t.pw_note_free
    : plan.id === "lifetime" ? t.pw_lifetime_hint : t.pw_no_charge;
  const ctaThen = plan.trialDays ? t.pw_note_then.replace("{price}", plan.price).replace("{period}", planPeriod(plan.id)) : null;

  // Quattro card fotografiche: ciò che Premium sblocca, raccontato per temi.
  const features = [
    { key: "stories", icon: "book-outline", title: t.pw_f_stories_t, sub: t.pw_f_stories_s },
    { key: "learn", icon: "school-outline", title: t.pw_f_learn_t, sub: t.pw_f_learn_s },
    { key: "audio", icon: "headset-outline", title: t.pw_f_audio_t, sub: t.pw_f_audio_s },
    { key: "personal", icon: "person-outline", title: t.pw_f_personal_t, sub: t.pw_f_personal_s },
  ] as const;

  // Confronto Gratis / Premium: solo funzioni presenti nell'app (vedi backend
  // FREE_/PREMIUM_CAPACITY, HISTORY_FREE_DAYS, FREE_SAVED_LIMIT, EARLY_ACCESS_DAYS
  // e i gate `isPremium` di audio, browse, playlist, stats, accento).
  type Row = { icon: string; title: string; free: string | false; premium: string | true };
  const quickRows: Row[] = [
    { icon: "layers-outline", title: t.pw_r_sessions, free: "4", premium: "5" },
    { icon: "flash-outline", title: t.pw_r_recharge, free: t.pw_q_recharge_free, premium: t.pw_q_recharge_premium },
    { icon: "time-outline", title: t.pw_r_history_short, free: t.pw_r_history_free, premium: t.pw_r_history_premium },
    { icon: "headset-outline", title: t.pw_r_audio_short, free: false, premium: true },
    { icon: "heart-outline", title: t.pw_r_saved_short, free: "20", premium: t.pw_unlimited },
  ];
  const rows: Row[] = [
    { icon: "layers-outline", title: t.pw_r_sessions, free: "4", premium: "5" },
    { icon: "flash-outline", title: t.pw_r_recharge, free: t.pw_r_recharge_free_short, premium: t.pw_r_recharge_premium_short },
    { icon: "school-outline", title: t.pw_r_lessons, free: false, premium: true },
    { icon: "time-outline", title: t.pw_r_history, free: t.pw_r_history_free, premium: t.pw_r_history_premium },
    { icon: "headset-outline", title: t.pw_r_audio, free: false, premium: true },
    { icon: "albums-outline", title: t.pw_r_choose, free: false, premium: true },
    { icon: "stats-chart-outline", title: t.pw_r_stats, free: false, premium: true },
    { icon: "heart-outline", title: t.pw_r_saved, free: "20", premium: t.pw_unlimited },
    { icon: "sparkles-outline", title: t.pw_r_early, free: t.pw_r_early_free, premium: t.pw_r_early_premium_short },
    { icon: "color-palette-outline", title: t.pw_r_accent, free: "1", premium: "5" },
  ];

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/discover"));
  const onActivate = async () => {
    await activate();
    goBack();
  };

  const dark = scheme === "dark";
  const bg = dark ? PAYWALL_BG : colors.surface;
  const cardBg = colors.surfaceDeep;

  return (
    <Screen style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}>
        {dark ? <PaywallBackdrop bg={bg} /> : null}
        {/* ---- Hero: ventaglio di copertine su sfondo sfocato (invariato) ---- */}
        <View style={[styles.hero, { paddingTop: insets.top + 48 }]} testID="paywall-hero">
          {covers[0] ? (
            <Image source={{ uri: heroUrl(covers[0], "thumb") }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={30} cachePolicy="memory-disk" />
          ) : null}
          <LinearGradient
            colors={["rgba(5,7,12,0.35)", "rgba(5,7,12,0.55)", bg]}
            locations={[0, 0.6, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.fan}>
            {covers.map((s, i) => (
              <View
                key={s.id}
                style={[
                  styles.fanCard,
                  i === 0 && { transform: [{ rotate: "-9deg" }, { translateX: -26 }, { translateY: 10 }] },
                  i === 1 && { zIndex: 2, transform: [{ scale: 1.08 }] },
                  i === 2 && { transform: [{ rotate: "9deg" }, { translateX: 26 }, { translateY: 10 }] },
                ]}
              >
                <Image source={{ uri: heroUrl(s, "thumb") }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} cachePolicy="memory-disk" />
                <LinearGradient colors={["transparent", "rgba(5,7,12,0.75)"]} style={StyleSheet.absoluteFill} />
                {i === 1 ? (
                  <View style={styles.fanPlay}>
                    <Ionicons name="headset" size={16} color="#FFFFFF" />
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.body}>
          {/* ---- Claim: titolo + prezzo mensile equivalente ---- */}
          <View style={styles.pill} testID="paywall-trial-pill">
            <Ionicons name="sparkles" size={12} color={colors.brand} />
            <Text style={styles.pillText}>{t.pw_trial_pill.toUpperCase()}</Text>
          </View>
          <Text style={styles.title} testID="paywall-title">{t.pw_title}</Text>
          <View style={styles.claimRow} testID="paywall-claim">
            <Text style={styles.claimPrice}>{YEARLY_PER_MONTH}</Text>
            <Text style={styles.claimUnit}>{t.pw_claim_unit}</Text>
          </View>
          <Text style={styles.claimNote} testID="paywall-claim-note">
            {t.pw_claim_note.replace("{price}", yearly.price).replace("{period}", t.per_year)}
          </Text>

          {/* ---- Selettore piani: tre in una riga, annuale al centro in evidenza ---- */}
          <Text style={styles.sectionLabel}>{t.pw_choose_plan}</Text>
          <View style={styles.plans}>
            {(["monthly", "yearly", "lifetime"] as PlanId[]).map((id) => {
              const p = PLANS.find((x) => x.id === id)!;
              const active = selected === id;
              const tag = id === "yearly" ? t.badge_save : id === "lifetime" ? t.badge_best : undefined;
              return (
                <Pressable key={id} onPress={() => setSelected(id)} testID={`plan-${id}`} accessibilityRole="radio" accessibilityState={{ selected: active }} style={styles.planWrap}>
                  <LinearGradient
                    colors={active ? colors.gradient : [colors.border, colors.border]}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                    style={styles.planBorder}
                  >
                    <View style={[styles.plan, active && styles.planActive]}>
                      {tag ? (
                        <View style={[styles.planTag, id === "yearly" ? styles.planTagBrand : styles.planTagSuccess]}>
                          <Text style={[styles.planTagText, id === "yearly" ? styles.planTagTextBrand : styles.planTagTextSuccess]} numberOfLines={1}>{tag.toUpperCase()}</Text>
                        </View>
                      ) : <View style={styles.planTagSpacer} />}
                      <Text style={styles.planName} numberOfLines={1}>{planLabel(id)}</Text>
                      <Text style={styles.planPrice} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{p.price}</Text>
                      <Text style={styles.planPeriod} numberOfLines={1}>{planPeriod(id)}</Text>
                      <Radio active={active} />
                    </View>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.planHint} testID="plan-hint">
            <Ionicons name={plan.trialDays ? "gift-outline" : plan.id === "lifetime" ? "infinite-outline" : "refresh-outline"} size={14} color={colors.brand} />
            <Text style={styles.planHintText}>{planHint}</Text>
          </View>

          {/* ---- Quattro card fotografiche: cosa offre Premium ---- */}
          <Text style={styles.featTitle} testID="paywall-features-title">{t.pw_features_title}</Text>
          <Text style={styles.featSub}>{t.pw_features_sub}</Text>
          <View style={styles.grid} testID="paywall-features">
            {features.map((f) => (
              <View key={f.key} style={styles.card} testID={`feature-${f.key}`}>
                <View style={styles.cardArt}>
                  <Image source={FEATURE_ART[f.key]} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} accessible={false} />
                  <LinearGradient colors={["transparent", withAlpha(cardBg, 0.35), cardBg]} locations={[0.45, 0.8, 1]} style={StyleSheet.absoluteFill} />
                </View>
                <View style={styles.cardIcon}>
                  <Ionicons name={f.icon as any} size={16} color={colors.onSurface} />
                </View>
                <Text style={styles.cardTitle}>{f.title}</Text>
                <Text style={styles.cardSub}>{f.sub}</Text>
              </View>
            ))}
          </View>

          <Pressable
            onPress={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setAllFeatures((v) => !v); }}
            style={styles.allBtn} testID="paywall-all-features" accessibilityRole="button" accessibilityState={{ expanded: allFeatures }}
          >
            <Text style={styles.allBtnText}>{allFeatures ? t.pw_less_features : t.pw_all_features}</Text>
            <Ionicons name={allFeatures ? "chevron-up" : "arrow-forward"} size={15} color={colors.brand} />
          </Pressable>

          {/* ---- Confronto rapido (5 righe) · espandibile alla lista completa ---- */}
          <View style={styles.table} testID="paywall-compare">
            <View style={styles.tableHead}>
              <Text style={styles.compareTitle} testID="paywall-compare-title" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{t.pw_quick_compare}</Text>
              <Text style={[styles.colLabel, styles.colFree, allFeatures && styles.colFreeWide]}>{t.pw_free_label}</Text>
              <View style={[styles.colPremiumHead, allFeatures && styles.colPremiumWide]}>
                <Text style={styles.colPremiumText}>{t.pw_premium_label}</Text>
              </View>
            </View>
            {(allFeatures ? rows : quickRows).map((r, i, arr) => (
              <View key={r.title} style={[styles.row, i === arr.length - 1 && styles.rowLast]} testID={`compare-${r.icon}`}>
                <View style={styles.rowIcon}>
                  <Ionicons name={r.icon as any} size={14} color={colors.onSurfaceSecondary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowTitle} numberOfLines={2}>{r.title}</Text>
                </View>
                <View style={[styles.cellFree, allFeatures && styles.colFreeWide]}>
                  {r.free === false
                    ? <Ionicons name="remove" size={16} color={colors.muted} />
                    : <Text style={styles.cellFreeText} numberOfLines={2}>{r.free}</Text>}
                </View>
                <View style={[styles.cellPremium, allFeatures && styles.colPremiumWide]}>
                  {r.premium === true
                    ? <Ionicons name="checkmark-circle-outline" size={18} color={colors.brand} />
                    : <Text style={styles.cellPremiumText} numberOfLines={2}>{r.premium}</Text>}
                </View>
              </View>
            ))}
            {/* Colonna Premium: velo cyan + glow, sotto alle celle. */}
            <View pointerEvents="none" style={[styles.premiumColumnTint, allFeatures && styles.premiumColumnTintWide]} />
          </View>

          {/* ---- CTA ---- */}
          <View style={styles.ctaWrap}>
            {isPremium ? (
              <View style={styles.activeChip} testID="premium-active-chip">
                <Ionicons name="checkmark-done" size={18} color={colors.success} />
                <Text style={styles.activeChipText}>{t.premium_active}</Text>
              </View>
            ) : (
              <GradientButton label={ctaLabel} icon="arrow-forward" onPress={onActivate} loading={isPending} testID="premium-activate" style={styles.cta} />
            )}
            <Text style={styles.ctaNote} testID="paywall-cta-note">{ctaNote}</Text>
            {ctaThen ? <Text style={styles.ctaThen} testID="paywall-cta-then">{ctaThen}</Text> : null}
            <Pressable onPress={() => {}} testID="premium-restore" hitSlop={8}>
              <Text style={styles.restore}>{t.premium_restore}</Text>
            </Pressable>
            {isPremium ? (
              <Pressable style={styles.cancel} onPress={() => cancel()} testID="premium-cancel">
                <Text style={styles.cancelText}>{t.premium_cancel_preview}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* ---- Barra superiore sopra l'hero ---- */}
      <View style={[styles.topBar, { top: insets.top + spacing.xs }]}>
        <HomeButton testID="premium-home" />
        <Pressable style={styles.closeBtn} onPress={goBack} testID="premium-close" hitSlop={10}>
          <Ionicons name="close" size={20} color="#FFFFFF" />
        </Pressable>
      </View>
    </Screen>
  );
}

// Sfondo del paywall (solo tema scuro): blu notte uniforme, scie di luce
// cyan sulla destra all'altezza delle card, orizzonte di montagne in fondo.
function PaywallBackdrop({ bg }: { bg: string }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} testID="paywall-backdrop">
      <View style={bd.streak}>
        <Image source={BG_STREAK} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right" transition={0} accessible={false} />
        <LinearGradient colors={[bg, withAlpha(bg, 0)]} start={{ x: 0, y: 0.5 }} end={{ x: 0.55, y: 0.5 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={[bg, withAlpha(bg, 0), withAlpha(bg, 0), bg]} locations={[0, 0.25, 0.75, 1]} style={StyleSheet.absoluteFill} />
      </View>
      <View style={bd.horizon}>
        <Image source={BG_HORIZON} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="bottom" transition={0} accessible={false} />
        {/* Veli: fusione in alto con lo sfondo, orizzonte appena visibile, base scura per la CTA e le note. */}
        <LinearGradient colors={[bg, withAlpha(bg, 0.72), withAlpha(bg, 0.42), withAlpha(bg, 0.5), withAlpha(bg, 0.72)]} locations={[0, 0.3, 0.55, 0.78, 1]} style={StyleSheet.absoluteFill} />
      </View>
    </View>
  );
}

const BG_STREAK = require("../assets/images/premium-bg-streak.jpg");
const BG_HORIZON = require("../assets/images/premium-bg-horizon.jpg");
const PAYWALL_BG = "#010914"; // stesso blu notte del fondo delle immagini di sfondo

const bd = StyleSheet.create({
  streak: { position: "absolute", right: 0, top: 540, width: 260, height: 760, overflow: "hidden" },
  horizon: { position: "absolute", left: 0, right: 0, bottom: 0, height: 480, overflow: "hidden" },
});

function Radio({ active }: { active: boolean }) {
  const styles = useStyles();
  return <View style={[styles.radio, active && styles.radioActive]}>{active ? <View style={styles.radioDot} /> : null}</View>;
}

const FAN_W = 108;
const FAN_H = 144;
const COL_FREE_W = 58;
const COL_PREMIUM_W = 78;
// Lista completa espansa: valori più lunghi ("Dopo 7 giorni"), colonne più larghe.
const COL_FREE_W_WIDE = 72;
const COL_PREMIUM_W_WIDE = 92;

const useStyles = makeStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.surface },
  topBar: {
    position: "absolute", left: spacing.xl, right: spacing.xl,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(5,7,12,0.45)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)",
  },
  // Hero (invariato)
  hero: { height: 300, overflow: "hidden", alignItems: "center", justifyContent: "flex-end", paddingBottom: spacing.lg },
  fan: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: FAN_H + 24 },
  fanCard: {
    width: FAN_W, height: FAN_H, borderRadius: 18, overflow: "hidden", marginHorizontal: -22,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: colors.surfaceSecondary,
    boxShadow: "0px 14px 30px rgba(0,0,0,0.45)",
  },
  fanPlay: {
    position: "absolute", right: 10, bottom: 10, width: 30, height: 30, borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.35)",
  },
  body: { paddingHorizontal: spacing.xl, marginTop: -spacing.sm },
  // Claim
  pill: {
    alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.brand, 0.1), borderWidth: 1, borderColor: withAlpha(colors.brand, 0.27),
  },
  pillText: { color: colors.brand, fontFamily: typography.bodyBold, fontSize: 10, letterSpacing: 1.6 },
  title: { color: colors.onSurface, fontFamily: typography.displayHero, fontSize: 30, lineHeight: 36, marginTop: spacing.md },
  claimRow: { flexDirection: "row", alignItems: "flex-end", gap: 4, marginTop: spacing.md },
  claimPrice: { color: colors.brand, fontFamily: typography.displayBold, fontSize: 44, lineHeight: 48, letterSpacing: -1 },
  claimUnit: { color: colors.onSurfaceSecondary, fontFamily: typography.bodyBold, fontSize: 18, lineHeight: 34 },
  claimNote: { color: colors.muted, fontFamily: typography.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  // Piani
  sectionLabel: { color: colors.muted, fontFamily: typography.bodyBold, fontSize: 10.5, letterSpacing: 1.6, marginTop: spacing.xl, marginBottom: spacing.sm },
  plans: { flexDirection: "row", gap: spacing.sm },
  planWrap: { flex: 1 },
  planBorder: { borderRadius: radius.lg + 2, padding: 1.5, flex: 1 },
  plan: {
    flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
    paddingHorizontal: spacing.sm, paddingTop: spacing.sm, paddingBottom: spacing.md, alignItems: "center", gap: 2,
  },
  planActive: { backgroundColor: colors.surfaceTertiary },
  planTag: { paddingHorizontal: 7, height: 18, borderRadius: radius.pill, alignItems: "center", justifyContent: "center", marginBottom: spacing.xs, maxWidth: "100%" },
  planTagSpacer: { height: 18, marginBottom: spacing.xs },
  planTagBrand: { backgroundColor: colors.brand },
  planTagSuccess: { backgroundColor: withAlpha(colors.success, 0.16) },
  planTagText: { fontFamily: typography.bodyBold, fontSize: 8.5, letterSpacing: 0.8 },
  planTagTextBrand: { color: colors.onBrand },
  planTagTextSuccess: { color: colors.success },
  planName: { color: colors.onSurfaceSecondary, fontFamily: typography.bodyMedium, fontSize: 12 },
  planPrice: { color: colors.onSurface, fontFamily: typography.displayBold, fontSize: 19, lineHeight: 24, marginTop: 2 },
  planPeriod: { color: colors.muted, fontFamily: typography.body, fontSize: 11, marginBottom: spacing.sm },
  planHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: spacing.md },
  planHintText: { color: colors.brand, fontFamily: typography.bodyBold, fontSize: 12.5 },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.borderStrong,
    alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: colors.brand },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  // Card fotografiche
  featTitle: { color: colors.onSurface, fontFamily: typography.displayBold, fontSize: 22, lineHeight: 28, marginTop: spacing.xl + spacing.md },
  featSub: { color: colors.onSurfaceSecondary, fontFamily: typography.body, fontSize: 14, lineHeight: 20, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  card: {
    width: "48%", flexGrow: 1, borderRadius: radius.lg + 4, overflow: "hidden",
    backgroundColor: withAlpha(colors.surfaceDeep, 0.92), borderWidth: 1, borderColor: withAlpha(colors.brand, 0.22),
    paddingBottom: spacing.md, boxShadow: `0px 10px 30px ${withAlpha(colors.brand, 0.08)}, 0px 0px 0px 0.5px ${withAlpha(colors.brand, 0.12)}`,
  },
  cardArt: { height: 118, backgroundColor: colors.surfaceDeep },
  cardIcon: {
    width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center",
    marginTop: -17, marginLeft: spacing.md, backgroundColor: withAlpha(colors.surfaceDeep, 0.9),
    borderWidth: 1, borderColor: withAlpha(colors.brand, 0.3), boxShadow: `0px 0px 14px ${withAlpha(colors.brand, 0.25)}`,
  },
  cardTitle: { color: colors.onSurface, fontFamily: typography.bodyBold, fontSize: 14, lineHeight: 18, marginTop: spacing.sm, paddingHorizontal: spacing.md },
  cardSub: { color: colors.onSurfaceSecondary, fontFamily: typography.body, fontSize: 11.5, lineHeight: 16, marginTop: 4, marginBottom: spacing.xs, paddingHorizontal: spacing.md },
  allBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "stretch",
    height: 46, borderRadius: radius.pill, marginTop: spacing.lg,
    backgroundColor: withAlpha(colors.brand, 0.06), borderWidth: 1, borderColor: withAlpha(colors.brand, 0.3),
  },
  allBtnText: { color: colors.brand, fontFamily: typography.bodyBold, fontSize: 14 },
  // Confronto rapido
  compareTitle: { flex: 1, color: colors.onSurface, fontFamily: typography.displayBold, fontSize: 16 },
  table: {
    marginTop: spacing.xl, borderRadius: radius.lg + 2, backgroundColor: withAlpha(colors.surfaceDeep, 0.85),
    borderWidth: 1, borderColor: withAlpha(colors.brand, 0.14), overflow: "hidden", position: "relative",
  },
  tableHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, zIndex: 1 },
  colLabel: { fontFamily: typography.bodyMedium, fontSize: 12, textAlign: "center" },
  colFree: { width: COL_FREE_W, color: colors.muted },
  colPremiumHead: {
    width: COL_PREMIUM_W, alignItems: "center", justifyContent: "center", height: 26, borderRadius: radius.sm, marginLeft: spacing.xs,
    backgroundColor: withAlpha(colors.brand, 0.14), borderWidth: 1, borderColor: withAlpha(colors.brand, 0.35),
    boxShadow: `0px 0px 16px ${withAlpha(colors.brand, 0.3)}`,
  },
  colPremiumText: { color: colors.brand, fontFamily: typography.bodyBold, fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: 8, zIndex: 1 },
  rowLast: { paddingBottom: spacing.md },
  rowIcon: { width: 20, alignItems: "center", marginRight: spacing.sm },
  rowText: { flex: 1, minWidth: 0, paddingRight: spacing.xs },
  rowTitle: { color: colors.onSurface, fontFamily: typography.bodyMedium, fontSize: 13, lineHeight: 17 },
  cellFree: { width: COL_FREE_W, alignItems: "center", justifyContent: "center" },
  cellFreeText: { color: colors.onSurfaceSecondary, fontFamily: typography.bodyMedium, fontSize: 12.5, textAlign: "center", lineHeight: 15, paddingHorizontal: 2 },
  cellPremium: { width: COL_PREMIUM_W, marginLeft: spacing.xs, alignItems: "center", justifyContent: "center" },
  cellPremiumText: { color: colors.brand, fontFamily: typography.bodyBold, fontSize: 12.5, textAlign: "center", lineHeight: 15 },
  colFreeWide: { width: COL_FREE_W_WIDE },
  colPremiumWide: { width: COL_PREMIUM_W_WIDE },
  premiumColumnTintWide: { width: COL_PREMIUM_W_WIDE + 8 },
  premiumColumnTint: {
    position: "absolute", top: spacing.sm, bottom: spacing.sm, right: spacing.md - 4, width: COL_PREMIUM_W + 8, borderRadius: radius.md,
    backgroundColor: withAlpha(colors.brand, 0.07), borderWidth: 1, borderColor: withAlpha(colors.brand, 0.18),
    boxShadow: `0px 0px 22px ${withAlpha(colors.brand, 0.12)}`,
  },
  // CTA
  ctaWrap: { marginTop: spacing.xl, alignItems: "center", gap: spacing.xs },
  cta: { alignSelf: "stretch" },
  ctaNote: { color: colors.onSurfaceSecondary, fontFamily: typography.bodyMedium, fontSize: 12.5, lineHeight: 17, textAlign: "center", marginTop: spacing.xs },
  ctaThen: { color: colors.muted, fontFamily: typography.body, fontSize: 11.5, lineHeight: 16, textAlign: "center" },
  restore: { color: colors.brand, fontFamily: typography.bodyBold, fontSize: 13, marginTop: spacing.sm },
  cancel: { alignSelf: "center", padding: spacing.sm },
  cancelText: { color: colors.muted, fontFamily: typography.bodyMedium, fontSize: 13 },
  activeChip: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm, alignSelf: "stretch", justifyContent: "center",
    height: 52, borderRadius: radius.pill,
    backgroundColor: withAlpha(colors.success, 0.1), borderWidth: 1, borderColor: withAlpha(colors.success, 0.33),
  },
  activeChipText: { color: colors.success, fontFamily: typography.bodyBold, fontSize: 15 },
}));
