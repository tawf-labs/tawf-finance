import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { PublicKey } from 'https://esm.sh/@solana/web3.js@1'
import nacl from 'https://esm.sh/tweetnacl@1'
import bs58 from 'https://esm.sh/bs58@5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { address, chain, signature } = await req.json()

    if (!address || !signature || chain !== 'solana') {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch and validate nonce
    const { data: nonceRow, error: nonceErr } = await supabase
      .from('auth_nonces')
      .select('message, expires_at')
      .eq('address', address)
      .single()

    if (nonceErr || !nonceRow) {
      return new Response(JSON.stringify({ error: 'Nonce not found' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (new Date(nonceRow.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: 'Nonce expired' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify signature
    const messageBytes = new TextEncoder().encode(nonceRow.message)
    const signatureBytes = bs58.decode(signature)
    const publicKeyBytes = new PublicKey(address).toBytes()

    const valid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes)

    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete used nonce
    await supabase.from('auth_nonces').delete().eq('address', address)

    // Upsert user record
    const { data: userRow, error: userErr } = await supabase
      .from('users')
      .upsert({ address, chain: 'solana', last_login: new Date().toISOString() }, { onConflict: 'address' })
      .select('id, plan, limit_per_month, used_this_month')
      .single()

    if (userErr) throw userErr

    // Generate API key (use user id + secret as a simple token)
    const apiKey = `tawf_${userRow.id}_${crypto.randomUUID().replace(/-/g, '')}`

    // Store API key
    await supabase.from('api_keys').upsert({ user_id: userRow.id, key: apiKey, address })

    return new Response(JSON.stringify({
      apiKey,
      plan: userRow.plan ?? 'free',
      limitPerMonth: userRow.limit_per_month ?? 100,
      usedThisMonth: userRow.used_this_month ?? 0,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
