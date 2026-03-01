import Svg, { Circle, Text as SvgText } from 'react-native-svg';
import { C } from '../../lib/theme';

type Props = {
  size?: number;
  color?: string;
};

export default function HelpIcon({ size = 24, color = C.parchment }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="10.5" stroke={color} strokeWidth="1.5" fill="none" />
      <SvgText
        x="12"
        y="17"
        textAnchor="middle"
        fontSize="14"
        fontWeight="700"
        fill={color}
      >
        ?
      </SvgText>
    </Svg>
  );
}
