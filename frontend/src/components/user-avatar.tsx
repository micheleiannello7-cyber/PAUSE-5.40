// PAUSE — avatar dell'utente: anello in gradiente con la foto profilo (se
// scelta dalla galleria) o l'iniziale del nome. Nell'header Home il tocco porta
// al Profilo; nel Profilo è il punto da cui si cambia la foto.
import { ReactNode } from "react";
import { Pressable, Text, View, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import Ionicons from "@react-native-vector-icons/ionicons";

import { avatarUrl, UserState } from "@/src/api";
import { makeStyles, useTheme, typography, withAlpha } from "@/src/theme";
import { useI18n } from "@/src/i18n";

type Props = {
  name: string;
  user?: UserState | null;
  size?: number;
  /** Mostra il badge "fotocamera" (Profilo). */
  editable?: boolean;
  busy?: boolean;
  onPress?: () => void;
  testID?: string;
};

export function UserAvatar({ name, user, size = 40, editable = false, busy = false, onPress, testID = "home-greeting" }: Props) {
  const router = useRouter();
  const styles = useStyles();
  const { colors } = useTheme();
  const { t } = useI18n();
  const uri = avatarUrl(user);
  const initial = (name.trim()[0] ?? "").toUpperCase();
  const ring = Math.max(2, Math.round(size * 0.055));
  const handlePress = onPress ?? (() => router.push("/(tabs)/profile"));

  let content: ReactNode;
  if (busy) content = <ActivityIndicator size="small" color={colors.brand} />;
  else if (uri) content = <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={200} cachePolicy="memory-disk" testID={`${testID}-photo`} />;
  else content = <Text style={[styles.initial, { fontSize: size * 0.42, lineHeight: size * 0.5 }]} testID={`${testID}-name`}>{initial}</Text>;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={editable ? t.avatar_change : `${t.greeting}, ${name}`}
      hitSlop={8}
      onPress={handlePress}
      style={({ pressed }) => [{ width: size, height: size }, pressed && styles.pressed]}
    >
      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.ring, { borderRadius: size / 2, padding: ring }]}>
        <View style={[styles.inner, { borderRadius: size / 2 - ring }]}>{content}</View>
      </LinearGradient>
      {editable ? (
        <View style={styles.badge} testID={`${testID}-edit`}>
          <Ionicons name="camera" size={12} color={colors.onBrand} />
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  ring: { flex: 1, boxShadow: `0px 0px 14px ${colors.cyanGlowSoft}` },
  inner: { flex: 1, overflow: "hidden", backgroundColor: colors.surfaceDeep, alignItems: "center", justifyContent: "center" },
  initial: { color: colors.onSurface, fontFamily: typography.displayBold },
  badge: {
    position: "absolute", right: -2, bottom: -2, width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.brand, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.surface, boxShadow: `0px 2px 8px ${withAlpha(colors.brand, 0.45)}`,
  },
  pressed: { opacity: 0.8 },
}));
