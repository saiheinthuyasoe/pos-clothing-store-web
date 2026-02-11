# PWA Install Prompt Implementation

## Overview

Your web app now has a Progressive Web App (PWA) install prompt feature that asks users to install the app when they visit the site.

## Features Implemented

### 1. PWA Manifest (`public/manifest.json`)

- Defines app name, icons, theme colors, and display mode
- Enables "Add to Home Screen" functionality
- Sets app to run in standalone mode (without browser UI)

### 2. Service Worker (`public/sw.js`)

- Enables offline functionality
- Caches important resources for faster loading
- Automatically updates when new versions are available

### 3. Install Prompt Component (`src/components/InstallPrompt.tsx`)

- **Auto-shows after 5 seconds** of visiting the site
- Beautiful, animated prompt at bottom of screen
- "Install" button triggers native browser install dialog
- "Not Now" button dismisses and remembers user's choice
- Only shows once per user (unless they clear browser storage)
- Doesn't show if app is already installed

### 4. Service Worker Registration (`src/components/ServiceWorkerRegistration.tsx`)

- Automatically registers the service worker
- Runs on page load

## How It Works

1. **User visits the website** for the first time
2. **After 5 seconds**, the install prompt appears at the bottom
3. **User can choose to**:
   - Click "Install" → Native browser install dialog appears
   - Click "Not Now" → Prompt disappears and won't show again
4. **If installed**, the app:
   - Opens in standalone mode (no browser UI)
   - Works offline with cached resources
   - Can be launched from home screen/app drawer

## User Experience Flow

```
Visit Website → Wait 5 seconds → See Install Prompt
                                        ↓
                        ┌──────────────┴──────────────┐
                        ↓                             ↓
                   Click "Install"            Click "Not Now"
                        ↓                             ↓
              Native Install Dialog          Dismissed Forever
                        ↓
                  App Installed!
```

## Customization Options

### Change Delay Time

Edit `InstallPrompt.tsx`, line with `setTimeout`:

```typescript
setTimeout(() => {
  setShowInstallPrompt(true);
}, 5000); // Change 5000 to desired milliseconds (e.g., 3000 = 3 seconds)
```

### Reset "Not Now" Choice

Users can clear `localStorage` in browser developer tools, or you can add a button:

```javascript
localStorage.removeItem("pwa-install-dismissed");
```

### Update App Colors

Edit `public/manifest.json`:

```json
{
  "theme_color": "#111827", // Browser toolbar color
  "background_color": "#ffffff" // Splash screen background
}
```

## Testing

### Desktop (Chrome/Edge)

1. Open DevTools (F12)
2. Go to Application > Manifest → Check for errors
3. Application > Service Workers → Verify registered
4. Visit site → Wait 5 seconds → Prompt should appear

### Mobile (Android - Chrome/Samsung Internet)

1. Visit the site
2. Wait 5 seconds
3. Install prompt appears
4. After install, find app icon on home screen

### Mobile (iOS - Safari)

**Note**: iOS doesn't support the `beforeinstallprompt` event. Users must manually:

1. Tap Share button
2. Select "Add to Home Screen"

## Browser Support

| Browser                  | Support                     |
| ------------------------ | --------------------------- |
| Chrome (Desktop/Android) | ✅ Full Support             |
| Edge                     | ✅ Full Support             |
| Samsung Internet         | ✅ Full Support             |
| Firefox                  | ⚠️ Limited (no auto-prompt) |
| Safari (iOS)             | ⚠️ Manual install only      |

## Files Created/Modified

- ✅ `public/manifest.json` - PWA configuration
- ✅ `public/sw.js` - Service worker for offline support
- ✅ `src/components/InstallPrompt.tsx` - Install prompt UI
- ✅ `src/components/ServiceWorkerRegistration.tsx` - SW registration
- ✅ `src/app/layout.tsx` - Added manifest link and components
- ✅ `src/app/globals.css` - Added slide-up animation

## Notes

- The prompt respects user choice (dismissed = never show again)
- Install prompt only works on HTTPS (or localhost for testing)
- Some browsers may have their own install prompts alongside this custom one
- The 5-second delay helps avoid annoying users immediately upon arrival
