import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { address, chain } = await req.json()

    if (!address || chain !== 'solana') {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Generate a random nonce
    const nonce = crypto.randomUUID()
    const messageToSign = `Sign in to tawf.finance\n\nWallet: ${address}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`

    // Store nonce in DB (expires in 5 minutes)
    const { error } = await supabase.from('auth_nonces').upsert({
      address,
      nonce,
      message: messageToSign,
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    })

    if (error) throw error

    return new Response(JSON.stringify({ messageToSign }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
