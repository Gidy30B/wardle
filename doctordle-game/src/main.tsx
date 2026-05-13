import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as CapacitorApp } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Capacitor } from "@capacitor/core";
import { ClerkProvider } from '@clerk/clerk-react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './app/App'
import AppErrorBoundary from './app/components/AppErrorBoundary'
import {
  getClerkFallbackRedirectUrl,
  mapNativeAuthUrlToInternalPath,
} from './features/auth/authRedirects'

const WARDLE_NATIVE_BACKGROUND = '#1E1E2C'

// ── Native plugin bootstrap ──────────────────────────────────────
// Only run native calls when we're actually inside a Capacitor runtime
// (i.e. on device or in the Capacitor DevTools, not plain browser).
async function initNative() {
  if (!Capacitor.isNativePlatform()) return;

  void CapacitorApp.addListener('appUrlOpen', ({ url }) => {
    handleNativeAppUrl(url)
  })

  try {
    const launchUrl = await CapacitorApp.getLaunchUrl()
    if (launchUrl?.url) {
      handleNativeAppUrl(launchUrl.url)
    }
  } catch (_) {
    // Launch URL can be unavailable on some platform/plugin combinations.
  }

  try {
    // Match the StatusBar to the app's styling
    await StatusBar.setStyle({ style: Style.Light });
    await StatusBar.setBackgroundColor({ color: WARDLE_NATIVE_BACKGROUND });
    await StatusBar.setOverlaysWebView({ overlay: false });
  } catch (_) {
    // StatusBar may not be available on all devices
  }

  try {
    // Hide the splash once React has mounted
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch (_) {
    // ignore
  }
}

function handleNativeAppUrl(appUrl: string) {
  const callbackPath = mapNativeAuthUrlToInternalPath(appUrl)

  if (
    callbackPath &&
    window.location.pathname + window.location.search + window.location.hash !== callbackPath
  ) {
    window.location.replace(callbackPath)
  }
}

function clerkNavigate(to: string) {
  window.location.assign(to)
}

function clerkReplace(to: string) {
  window.location.replace(to)
}

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPublishableKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY')
}

const clerkFallbackRedirectUrl = getClerkFallbackRedirectUrl()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <StrictMode>
    <ClerkProvider
      publishableKey={clerkPublishableKey}
      routerPush={clerkNavigate}
      routerReplace={clerkReplace}
      signInFallbackRedirectUrl={clerkFallbackRedirectUrl}
      signUpFallbackRedirectUrl={clerkFallbackRedirectUrl}
      afterSignOutUrl={clerkFallbackRedirectUrl}
    >
      <QueryClientProvider client={queryClient}>
        <AppErrorBoundary>
          <App />
        </AppErrorBoundary>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);

// Init after first render so the app is visible before splash hides
initNative();
