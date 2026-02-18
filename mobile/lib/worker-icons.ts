import { ImageSourcePropType } from 'react-native';

const SENATOR_ICONS: Record<string, ImageSourcePropType> = {
  ivory: require('../assets/images/senator-icon-ivory.png'),
  slate: require('../assets/images/senator-icon-slate.png'),
  crimson: require('../assets/images/senator-icon-crimson.png'),
  cobalt: require('../assets/images/senator-icon-cobalt.png'),
  emerald: require('../assets/images/senator-icon-emerald.png'),
  purple: require('../assets/images/senator-icon-purple.png'),
  gold: require('../assets/images/senator-icon-gold.png'),
  burnt_orange: require('../assets/images/senator-icon-orange.png'),
  orange: require('../assets/images/senator-icon-orange.png'),
  rose: require('../assets/images/senator-icon-rose.png'),
  teal: require('../assets/images/senator-icon-teal.png'),
};

const SABOTEUR_ICONS: Record<string, ImageSourcePropType> = {
  ivory: require('../assets/images/saboteur-icon-ivory.png'),
  slate: require('../assets/images/saboteur-icon-slate.png'),
  crimson: require('../assets/images/saboteur-icon-crimson.png'),
  cobalt: require('../assets/images/saboteur-icon-cobalt.png'),
  emerald: require('../assets/images/saboteur-icon-emerald.png'),
  purple: require('../assets/images/saboteur-icon-purple.png'),
  gold: require('../assets/images/saboteur-icon-gold.png'),
  burnt_orange: require('../assets/images/saboteur-icon-orange.png'),
  orange: require('../assets/images/saboteur-icon-orange.png'),
  rose: require('../assets/images/saboteur-icon-rose.png'),
  teal: require('../assets/images/saboteur-icon-teal.png'),
};

const SENATOR_ICON_EMPTY: ImageSourcePropType = require('../assets/images/senator-icon-empty.png');
const SABOTEUR_ICON_EMPTY: ImageSourcePropType = require('../assets/images/saboteur-icon-empty.png');

export function getSenatorIcon(playerColor: string): ImageSourcePropType {
  return SENATOR_ICONS[playerColor] ?? SENATOR_ICONS.ivory;
}

export function getSenatorEmptyIcon(): ImageSourcePropType {
  return SENATOR_ICON_EMPTY;
}

export function getSaboteurIcon(playerColor: string): ImageSourcePropType {
  return SABOTEUR_ICONS[playerColor] ?? SABOTEUR_ICONS.ivory;
}

export function getSaboteurEmptyIcon(): ImageSourcePropType {
  return SABOTEUR_ICON_EMPTY;
}
