// Everything you need to change before release lives in this file.
export const CONFIG = {
  appName: 'Play Sudoku',
  version: '1.0.0',
  // Tap the version line in Settings 7 times to unlock every level and simulate
  // purchases while testing. SET THIS TO false BEFORE UPLOADING TO GOOGLE PLAY.
  allowTesterMode: true,
  helpPerGame: 3,
  winsToUnlock: 10,
  // These ids must match the in-app products you create in Google Play Console.
  products: { pro: 'pro_unlimited', pack: 'hints_25' },
  packSize: 25,
  // Paste the values from your Firebase project to turn on worldwide scores.
  firebase: { apiKey: '', projectId: '', databaseURL: '' },
  privacyUrl: '',
};
export const LEVELS = [
  { id: 'easy', name: 'Easy', blurb: 'Learn to scan for the last spot', base: 1000, par: 420 },
  { id: 'medium', name: 'Medium', blurb: 'Fewer clues, same simple tricks', base: 2000, par: 600 },
  { id: 'hard', name: 'Hard', blurb: 'Start using notes, pairs and pointing', base: 3000, par: 900 },
  { id: 'expert', name: 'Expert', blurb: 'Hidden pairs and triples', base: 4000, par: 1200 },
  { id: 'extreme', name: 'Extreme', blurb: 'X-Wing, Y-Wing and Swordfish', base: 5000, par: 1500 },
];
export const MATCH_LEVELS = ['easy', 'medium', 'hard'];
if (CONFIG.allowTesterMode && typeof window !== 'undefined' && window.__FB) Object.assign(CONFIG.firebase, window.__FB);
