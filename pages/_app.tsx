import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from '../context/authContext';

const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

export default function MyApp({ Component, pageProps }: AppProps) {
  const appShell = (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );

  if (!googleClientId) {
    return appShell;
  }

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      {appShell}
    </GoogleOAuthProvider>
  );
}
