// WARNING: UPDATE THIS to your Mac's local network IP address when testing on a physical device.
// Run: ifconfig | grep "inet " | grep -v 127.0.0.1
// Example: 192.168.1.42
export const LOCAL_IP = '172.20.10.6';

export const API_URL = __DEV__
  ? `http://${LOCAL_IP}:3001`
  : 'https://api.scamshield.ai';

export const APP_VERSION = '1.0.0';
