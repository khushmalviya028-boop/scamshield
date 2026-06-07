import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { colors } from '../theme';
import { RiskBand } from '../types';

interface RiskGaugeProps {
  score: number;
  band: RiskBand;
}

const BAND_COLOR: Record<RiskBand, string> = {
  safe: colors.safe,
  caution: colors.caution,
  'high-risk': colors.highRisk,
};

function NativeGauge({ score, band }: RiskGaugeProps) {
  const { default: Svg, Path, Circle } = require('react-native-svg');

  const W = 240, H = 135;
  const CX = W / 2, CY = 115;
  const R = 98;
  const STROKE = 18;
  const color = BAND_COLOR[band];

  function polarToXY(angleDeg: number, radius = R) {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
  }

  function arcPath(startDeg: number, endDeg: number) {
    const s = polarToXY(startDeg);
    const e = polarToXY(endDeg);
    const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  // 180° = left (score 0), 0° = right (score 100)
  const needleDeg = 180 - score * 1.8;
  const capPt = polarToXY(needleDeg);

  return (
    <View style={styles.gaugeWrap}>
      <Svg width={W} height={H}>
        {/* Track */}
        <Path d={arcPath(180, 0)} stroke="#1E2436" strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        {/* Zone tints */}
        <Path d={arcPath(180, 126)} stroke="#22C55E22" strokeWidth={STROKE} fill="none" />
        <Path d={arcPath(126, 63)} stroke="#F59E0B22" strokeWidth={STROKE} fill="none" />
        <Path d={arcPath(63, 0)} stroke="#EF444422" strokeWidth={STROKE} fill="none" />
        {/* Progress arc */}
        {score > 0 && (
          <Path d={arcPath(180, needleDeg)} stroke={color} strokeWidth={STROKE} fill="none" strokeLinecap="round" />
        )}
        {/* Glowing end cap */}
        {score > 0 && (
          <>
            <Circle cx={capPt.x} cy={capPt.y} r={18} fill={color} opacity={0.15} />
            <Circle cx={capPt.x} cy={capPt.y} r={11} fill={color} opacity={0.45} />
            <Circle cx={capPt.x} cy={capPt.y} r={6} fill={color} />
          </>
        )}
      </Svg>

      {/* Score overlaid at arc center-bottom */}
      <View style={styles.scoreOverlay} pointerEvents="none">
        <Text style={[styles.scoreNum, { color }]}>{score}</Text>
        <Text style={styles.scoreOf}>out of 100</Text>
      </View>
    </View>
  );
}

function WebGauge({ score, band }: RiskGaugeProps) {
  const color = BAND_COLOR[band];
  return (
    <View style={styles.webWrap}>
      <View style={[styles.webCircle, { borderColor: color }]}>
        <Text style={[styles.webScore, { color }]}>{score}</Text>
        <Text style={styles.webOf}>/ 100</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${score}%` as any, backgroundColor: color }]} />
        <View style={[styles.marker, { left: '30%' }]} />
        <View style={[styles.marker, { left: '65%' }]} />
      </View>
    </View>
  );
}

export default function RiskGauge({ score, band }: RiskGaugeProps) {
  if (Platform.OS === 'web') return <WebGauge score={score} band={band} />;
  return <NativeGauge score={score} band={band} />;
}

const styles = StyleSheet.create({
  gaugeWrap: { alignItems: 'center', justifyContent: 'center' },
  scoreOverlay: { position: 'absolute', bottom: 0, alignItems: 'center' },
  scoreNum: { fontSize: 52, fontWeight: '900', letterSpacing: -3, lineHeight: 56 },
  scoreOf: { fontSize: 12, color: '#64748B', fontWeight: '600', letterSpacing: 0.5, marginTop: 2 },
  webWrap: { alignItems: 'center', gap: 16 },
  webCircle: {
    width: 120, height: 120, borderRadius: 60, borderWidth: 6,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#141826',
  },
  webScore: { fontSize: 40, fontWeight: '900', letterSpacing: -2 },
  webOf: { fontSize: 12, color: '#64748B' },
  barTrack: { width: 220, height: 12, borderRadius: 6, backgroundColor: '#1E2436', position: 'relative', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 6 },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#0B0F1A' },
});
