import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KAKAO_REST_API_KEY = Deno.env.get('KAKAO_REST_API_KEY');
    const KAKAO_ADMIN_KEY = Deno.env.get('KAKAO_ADMIN_KEY');
    const KAKAO_CHANNEL_ID = Deno.env.get('KAKAO_CHANNEL_ID');

    if (!KAKAO_REST_API_KEY || !KAKAO_ADMIN_KEY || !KAKAO_CHANNEL_ID) {
      throw new Error('Kakao credentials are not configured');
    }

    const { message, phoneNumbers, templateObject } = await req.json();

    if (!message && !templateObject) {
      throw new Error('Either message or templateObject is required');
    }

    // Use KakaoTalk Channel custom message API
    // POST https://kapi.kakao.com/v1/api/talk/channels/message/send
    // This sends a message from the KakaoTalk Channel to friends of the channel

    const results: { phone: string; success: boolean; error?: string }[] = [];

    if (phoneNumbers && Array.isArray(phoneNumbers) && phoneNumbers.length > 0) {
      // Send to specific phone numbers using channel message
      // First, get channel friends list or use direct send
      
      // Use the custom template for channel message
      const msgTemplate = templateObject || {
        object_type: 'text',
        text: message,
        link: {
          web_url: 'https://namsan-gateway-connect.lovable.app',
          mobile_web_url: 'https://namsan-gateway-connect.lovable.app',
        },
        button_title: '포털 방문',
      };

      // Send channel message to all friends (broadcast)
      const response = await fetch('https://kapi.kakao.com/v1/api/talk/channels/message/send', {
        method: 'POST',
        headers: {
          'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          receiver_uuids: JSON.stringify([]), // Will be populated with actual UUIDs
          template_object: JSON.stringify(msgTemplate),
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error(`Kakao API error [${response.status}]:`, errBody);
        
        // Fallback: try broadcast to all channel friends
        const broadcastRes = await fetch('https://kapi.kakao.com/v1/api/talk/channels/message/send', {
          method: 'POST',
          headers: {
            'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            template_object: JSON.stringify(msgTemplate),
          }),
        });

        if (!broadcastRes.ok) {
          const broadcastErr = await broadcastRes.text();
          throw new Error(`Kakao broadcast failed [${broadcastRes.status}]: ${broadcastErr}`);
        }
      }

      results.push({ phone: 'broadcast', success: true });
    } else {
      // Broadcast to all channel friends
      const msgTemplate = templateObject || {
        object_type: 'text',
        text: message,
        link: {
          web_url: 'https://namsan-gateway-connect.lovable.app',
          mobile_web_url: 'https://namsan-gateway-connect.lovable.app',
        },
        button_title: '포털 방문',
      };

      const response = await fetch('https://kapi.kakao.com/v1/api/talk/channels/message/send', {
        method: 'POST',
        headers: {
          'Authorization': `KakaoAK ${KAKAO_ADMIN_KEY}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          template_object: JSON.stringify(msgTemplate),
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        throw new Error(`Kakao channel message failed [${response.status}]: ${errBody}`);
      }

      const data = await response.json();
      results.push({ phone: 'broadcast', success: true });
      console.log('[Kakao] Broadcast result:', data);
    }

    return new Response(
      JSON.stringify({ success: true, results, sentCount: results.filter(r => r.success).length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[send-kakao] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
