import { supabase } from '../../lib/supabase'

export type SocialProvider = 'google' | 'facebook'

export async function loginWithSocialProvider(
  provider: SocialProvider,
  destination: string,
) {
  const callbackUrl = new URL('/auth/callback', window.location.origin)
  callbackUrl.searchParams.set('redirect', destination)

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: callbackUrl.toString(),
    },
  })

  if (error) {
    throw new Error('SOCIAL_LOGIN_UNAVAILABLE')
  }
}
