import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { isSupabaseConfigured } from "./lib/supabase";

const categories = [
  { mark: "C", title: "Cow milk", detail: "Fresh and everyday", tint: "#e9f4df" },
  { mark: "B", title: "Buffalo milk", detail: "Rich and creamy", tint: "#f7eddb" },
  { mark: "A2", title: "A2 milk", detail: "Explore local options", tint: "#e2f0ec" },
];

export default function App() {
  const [selected, setSelected] = useState("Cow milk");

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.topbar}>
          <View style={styles.brandMark}><Text style={styles.brandLetter}>D</Text></View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>Doodhwala</Text>
            <Text style={styles.brandTagline}>Local milk, nearby.</Text>
          </View>
          <View style={styles.freshBadge}><View style={styles.dot} /><Text style={styles.freshText}>LOCAL FIRST</Text></View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>FRESH · LOCAL · DIRECT</Text>
          <Text style={styles.title}>Your neighbourhood’s milk,{"\n"}<Text style={styles.titleAccent}>one tap away.</Text></Text>
          <Text style={styles.description}>Discover independent milk sellers near your home. Compare options and choose what works for your family.</Text>
          <View style={styles.heroPills}>
            <Text style={styles.heroPill}>✓ Independent sellers</Text>
            <Text style={styles.heroPill}>✓ Clear prices</Text>
          </View>
          <View style={styles.illustration}>
            <View style={styles.sun} />
            <View style={styles.hillBack} />
            <View style={styles.hillFront} />
            <View style={styles.bottleCap} />
            <View style={styles.bottleNeck} />
            <View style={styles.bottleBody}>
              <Text style={styles.bottleFlower}>✳</Text>
              <Text style={styles.bottleLabel}>FRESH{"\n"}DAILY</Text>
            </View>
            <View style={styles.artCaption}><Text style={styles.artCaptionStrong}>Closer to home</Text><Text style={styles.artCaptionSmall}>Supporting local milk sellers</Text></View>
          </View>
        </View>

        <View style={styles.sectionHeading}>
          <View><Text style={styles.eyebrow}>A GOOD PLACE TO START</Text><Text style={styles.sectionTitle}>Find your kind of milk</Text></View>
          <Text style={styles.sectionDescription}>Choose a category to get started.</Text>
        </View>

        <View style={styles.categories}>
          {categories.map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: selected === item.title }}
              key={item.title}
              onPress={() => setSelected(item.title)}
              style={[styles.categoryCard, selected === item.title && styles.categorySelected]}
            >
              <View style={[styles.categoryMark, { backgroundColor: item.tint }]}><Text style={styles.categoryMarkText}>{item.mark}</Text></View>
              <View style={styles.categoryCopy}><Text style={styles.categoryTitle}>{item.title}</Text><Text style={styles.categoryDetail}>{item.detail}</Text></View>
              <Text style={styles.categoryArrow}>{selected === item.title ? "✓" : "›"}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{isSupabaseConfigured ? "Backend configuration detected" : "Getting your local milk journey ready"}</Text>
          <Text style={styles.noticeText}>{isSupabaseConfigured ? "The public Supabase settings are present. Live seller discovery and authenticated ordering will be enabled after staging API journeys are verified." : "This mobile foundation is ready for the staging backend connection. Add the public Supabase URL and publishable key to the local environment; never add service-role secrets to the app."}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Doodhwala</Text>
          <Text style={styles.footerText}>Built around neighbourhoods, powered by local sellers.</Text>
          <Text style={styles.footerMeta}>Website · Android · iOS</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8faf5" },
  page: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 36, maxWidth: 620, width: "100%", alignSelf: "center" },
  topbar: { flexDirection: "row", alignItems: "center", marginBottom: 28 },
  brandMark: { width: 42, height: 42, borderRadius: 15, backgroundColor: "#1f6b43", alignItems: "center", justifyContent: "center" },
  brandLetter: { color: "#fff", fontSize: 23, fontWeight: "800" },
  brandCopy: { marginLeft: 10 },
  brandName: { color: "#183a29", fontSize: 18, fontWeight: "800", letterSpacing: -0.5 },
  brandTagline: { color: "#738276", fontSize: 11, marginTop: 2 },
  freshBadge: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#eaf3e7", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#3d8c55" },
  freshText: { color: "#356848", fontSize: 9, fontWeight: "800", letterSpacing: 0.7 },
  hero: { backgroundColor: "#edf5e8", borderRadius: 28, padding: 22, overflow: "hidden" },
  eyebrow: { color: "#4c805b", fontSize: 10, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 },
  title: { color: "#183a29", fontSize: 32, lineHeight: 37, fontWeight: "800", letterSpacing: -1.1 },
  titleAccent: { color: "#4c8a53", fontStyle: "italic" },
  description: { color: "#607565", fontSize: 14, lineHeight: 21, marginTop: 14 },
  heroPills: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  heroPill: { color: "#315e40", backgroundColor: "#fff", overflow: "hidden", borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7, fontSize: 10, fontWeight: "700" },
  illustration: { height: 190, backgroundColor: "#dcebd1", borderRadius: 20, marginTop: 22, overflow: "hidden", alignItems: "center", justifyContent: "flex-end" },
  sun: { position: "absolute", width: 68, height: 68, borderRadius: 34, backgroundColor: "#f8e6a9", top: 18, right: 26 },
  hillBack: { position: "absolute", width: 300, height: 130, borderRadius: 100, backgroundColor: "#b9d6a9", bottom: -70, left: -50, transform: [{ rotate: "-8deg" }] },
  hillFront: { position: "absolute", width: 350, height: 100, borderRadius: 100, backgroundColor: "#8fbd82", bottom: -65, right: -80, transform: [{ rotate: "8deg" }] },
  bottleCap: { position: "absolute", width: 35, height: 13, borderTopLeftRadius: 5, borderTopRightRadius: 5, backgroundColor: "#39754d", bottom: 132, zIndex: 2 },
  bottleNeck: { position: "absolute", width: 30, height: 24, backgroundColor: "#fffdf7", bottom: 111, zIndex: 1 },
  bottleBody: { position: "absolute", width: 76, height: 110, bottom: 13, backgroundColor: "#fffdf7", borderRadius: 18, borderWidth: 2, borderColor: "#d2dfcc", alignItems: "center", justifyContent: "center", zIndex: 1 },
  bottleFlower: { fontSize: 24, color: "#4c8a53" },
  bottleLabel: { color: "#3f6e4c", textAlign: "center", fontSize: 9, fontWeight: "900", letterSpacing: 1, marginTop: 3 },
  artCaption: { position: "absolute", bottom: 12, left: 12, backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, zIndex: 3 },
  artCaptionStrong: { color: "#244c31", fontSize: 11, fontWeight: "800" },
  artCaptionSmall: { color: "#728375", fontSize: 9, marginTop: 2 },
  sectionHeading: { marginTop: 30, marginBottom: 14 },
  sectionTitle: { color: "#183a29", fontSize: 23, fontWeight: "800", letterSpacing: -0.7 },
  sectionDescription: { color: "#738276", fontSize: 12, marginTop: 6 },
  categories: { gap: 10 },
  categoryCard: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e7ece3", borderRadius: 18, padding: 13 },
  categorySelected: { borderColor: "#7cac79", backgroundColor: "#f8fcf5" },
  categoryMark: { width: 45, height: 45, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  categoryMarkText: { color: "#325c3e", fontSize: 15, fontWeight: "900" },
  categoryCopy: { flex: 1, marginLeft: 12 },
  categoryTitle: { color: "#243f2e", fontSize: 14, fontWeight: "800" },
  categoryDetail: { color: "#7b887e", fontSize: 11, marginTop: 4 },
  categoryArrow: { color: "#4d8259", fontSize: 20, fontWeight: "700", paddingHorizontal: 6 },
  notice: { marginTop: 22, backgroundColor: "#f0f4ed", borderRadius: 18, padding: 16, borderWidth: 1, borderColor: "#e0e9dc" },
  noticeTitle: { color: "#2d5839", fontSize: 13, fontWeight: "800" },
  noticeText: { color: "#66766a", fontSize: 12, lineHeight: 18, marginTop: 7 },
  footer: { alignItems: "center", paddingTop: 28, gap: 7 },
  footerBrand: { color: "#2e6943", fontSize: 16, fontWeight: "900" },
  footerText: { color: "#7b887e", textAlign: "center", fontSize: 11 },
  footerMeta: { color: "#9aa49b", fontSize: 10, marginTop: 4 },
});
