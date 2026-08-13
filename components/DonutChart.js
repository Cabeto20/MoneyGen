import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

/**
 * Gráfico de rosca. Cada fatia é um arco desenhado com `strokeDasharray` sobre
 * o mesmo círculo, deslocado pelo acumulado das fatias anteriores.
 */
const DonutChart = ({
  data = [],
  size = 200,
  strokeWidth = 26,
  theme,
  centerLabel,
  centerValue,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const slices = useMemo(() => {
    const positive = data.filter(item => item.value > 0);
    const total = positive.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) return [];

    // Espaço entre fatias só faz sentido quando há mais de uma.
    const gap = positive.length > 1 ? Math.min(circumference * 0.006, 4) : 0;

    let consumed = 0;
    return positive.map(item => {
      const length = Math.max((item.value / total) * circumference - gap, 0.5);
      const slice = {
        key: item.name,
        color: item.color,
        length,
        offset: consumed,
      };
      consumed += (item.value / total) * circumference;
      return slice;
    });
  }, [data, circumference]);

  const styles = createStyles(theme);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Trilho de fundo: também é o estado vazio quando não há fatias. */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.border}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          {slices.map(slice => (
            <Circle
              key={slice.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              fill="transparent"
              strokeDasharray={`${slice.length} ${circumference - slice.length}`}
              strokeDashoffset={-slice.offset}
            />
          ))}
        </G>
      </Svg>

      <View style={styles.center} pointerEvents="none">
        {!!centerValue && <Text style={styles.centerValue}>{centerValue}</Text>}
        {!!centerLabel && <Text style={styles.centerLabel}>{centerLabel}</Text>}
      </View>
    </View>
  );
};

const createStyles = (theme) => StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  centerValue: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.text,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  centerLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
});

export default DonutChart;
