import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  ListRenderItemInfo,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, spacing, fontSize, radius } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  gradient: readonly [string, string, string];
  isLast?: boolean;
}

const SLIDES: Slide[] = [
  {
    id: '1',
    emoji: '🛡️',
    title: 'ScamShield',
    subtitle: "India's #1 scam app detector. Verify before you trust.",
    gradient: ['#0B0F1A', '#1a1040', '#0B0F1A'],
  },
  {
    id: '2',
    emoji: '🔍',
    title: 'Three-layer verification',
    subtitle:
      '• RBI registration check\n• Permission risk analysis\n• Community reports',
    gradient: ['#0B0F1A', '#0d1f11', '#0B0F1A'],
  },
  {
    id: '3',
    emoji: '🚨',
    title: 'Stay protected',
    subtitle:
      'Before opening any loan app, paste its Play Store link and get an instant verdict.',
    gradient: ['#0B0F1A', '#1a0505', '#0B0F1A'],
    isLast: true,
  },
];

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;
};

export default function OnboardingScreen({ navigation }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Slide>>(null);
  const slideOpacity = useRef(new Animated.Value(0)).current;
  const slideTranslateY = useRef(new Animated.Value(20)).current;

  const runEntranceAnimation = () => {
    slideOpacity.setValue(0);
    slideTranslateY.setValue(20);
    Animated.parallel([
      Animated.timing(slideOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideTranslateY, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  // Run entrance animation on mount
  React.useEffect(() => {
    runEntranceAnimation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const handleGetStarted = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await AsyncStorage.setItem('onboarding_complete', 'true');
    navigation.replace('Home');
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    flatListRef.current?.scrollToEnd({ animated: true });
  };

  const renderSlide = ({ item }: ListRenderItemInfo<Slide>) => (
    <LinearGradient colors={item.gradient} style={styles.slide} locations={[0, 0.5, 1]}>
      <Animated.View
        style={[
          styles.slideContent,
          { opacity: slideOpacity, transform: [{ translateY: slideTranslateY }] },
        ]}
      >
        <View style={styles.emojiContainer}>
          <Text style={styles.emoji}>{item.emoji}</Text>
        </View>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
        {item.isLast && (
          <TouchableOpacity style={styles.getStartedBtn} onPress={handleGetStarted} activeOpacity={0.85}>
            <Text style={styles.getStartedText}>Get Started</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </LinearGradient>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Skip button */}
      {currentIndex < SLIDES.length - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
          runEntranceAnimation();
        }}
        style={styles.flatList}
      />

      {/* Dots + Next */}
      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
        {currentIndex < SLIDES.length - 1 && (
          <TouchableOpacity style={styles.nextBtn} onPress={goToNext} activeOpacity={0.85}>
            <Text style={styles.nextText}>Next →</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  skipBtn: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.md,
    zIndex: 10,
    padding: spacing.sm,
  },
  skipText: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  flatList: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
  },
  slideContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
  },
  emojiContainer: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: '#6366F115',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1.5,
    borderColor: '#6366F130',
  },
  emoji: {
    fontSize: 60,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 26,
  },
  getStartedBtn: {
    marginTop: spacing.xl + spacing.md,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl + spacing.md,
    borderRadius: radius.full,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  getStartedText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 8,
    backgroundColor: colors.textMuted,
  },
  nextBtn: {
    backgroundColor: colors.bgCard,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextText: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
