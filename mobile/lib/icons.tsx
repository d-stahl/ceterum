import Svg, { Path } from 'react-native-svg';

export function UserProfileIcon({ size = 24, color = '#e0c097' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9.69 10.863a4.5 4.5 0 1 1 4.62 0A7.503 7.503 0 0 1 19.5 18c0 1.509-3.403 2.5-7.5 2.5-4.146 0-7.5-.964-7.5-2.5a7.503 7.503 0 0 1 5.19-7.137zM12 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zm0 9c3.5 0 6.5-.874 6.5-1.5a6.5 6.5 0 1 0-13 0c0 .65 2.955 1.5 6.5 1.5z"
        fill={color}
      />
    </Svg>
  );
}

export function NotificationBellIcon({ size = 24, color = '#e0c097' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Path
        d="M16,29a4,4,0,0,1-4-4,1,1,0,0,1,1-1h6a1,1,0,0,1,1,1A4,4,0,0,1,16,29Zm-1.73-3a2,2,0,0,0,3.46,0Z"
        fill={color}
      />
      <Path
        d="M18,7H14a1,1,0,0,1-1-1,3,3,0,0,1,6,0A1,1,0,0,1,18,7ZM16,5h0Z"
        fill={color}
      />
      <Path
        d="M27,26H5a1,1,0,0,1-1-1,7,7,0,0,1,3-5.75V14a9,9,0,0,1,8.94-9h.11a9,9,0,0,1,9,9v5.25A7,7,0,0,1,28,25h0A1,1,0,0,1,27,26ZM6.1,24H25.9a5,5,0,0,0-2.4-3.33,1,1,0,0,1-.5-.87V14A7,7,0,1,0,9,14v5.8a1,1,0,0,1-.5.87A5,5,0,0,0,6.1,24Z"
        fill={color}
      />
    </Svg>
  );
}
