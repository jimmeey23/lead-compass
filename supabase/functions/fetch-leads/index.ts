import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { combineColumnValueRanges, getRequiredSalesColumnRanges } from './sheet-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SHEET_ID = '1dQMNF69WnXVQdhlLvUZTig3kL97NA21k6eZ9HRu6xiQ';
const SHEET_NAME = '◉ Leads';
const SHEET_RANGE = `${SHEET_NAME}!A:AG`;
const SALES_SHEET_ID = '1HbGnJk-peffUp7XoXSlsL55924E9yUt8cP_h93cdTT0';
const SALES_HEADER_RANGE = 'sales!1:1';
const SHEET_CACHE_TTL_MS = 2 * 60 * 1000;
const TOKEN_EXPIRY_BUFFER_MS = 60 * 1000;

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let cachedSheetPayload: { data: unknown; expiresAt: number } | null = null;

async function fetchSheetValues(accessToken: string, spreadsheetId: string, range: string) {
  const encodedSheet = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedSheet}`;

  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sheets API error [${response.status}]: ${err}`);
  }

  return response.json();
}

async function batchFetchSheetValues(accessToken: string, spreadsheetId: string, ranges: string[]) {
  const params = new URLSearchParams();
  for (const range of ranges) {
    params.append('ranges', range);
  }

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?${params.toString()}`;
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Sheets API batchGet error [${response.status}]: ${err}`);
  }

  return response.json();
}

async function fetchSalesValues(accessToken: string) {
  const headerData = await fetchSheetValues(accessToken, SALES_SHEET_ID, SALES_HEADER_RANGE);
  const headers = headerData.values?.[0] ?? [];
  const salesColumnRanges = getRequiredSalesColumnRanges(headers);
  const salesColumnData = await batchFetchSheetValues(accessToken, SALES_SHEET_ID, salesColumnRanges);

  return combineColumnValueRanges(salesColumnData.valueRanges ?? []);
}

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now()) {
    return cachedAccessToken.token;
  }

  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const refreshToken = Deno.env.get('GOOGLE_REFRESH_TOKEN');

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Google OAuth credentials not configured');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Token refresh failed: ${err}`);
  }

  const data = await response.json();
  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + Math.max((Number(data.expires_in) || 3600) * 1000 - TOKEN_EXPIRY_BUFFER_MS, 0),
  };

  return cachedAccessToken.token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (cachedSheetPayload && cachedSheetPayload.expiresAt > Date.now()) {
      return new Response(JSON.stringify(cachedSheetPayload.data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
          'X-Lead-Cache': 'HIT',
        },
      });
    }

    const accessToken = await getAccessToken();
    
    const [leadData, salesValues] = await Promise.all([
      fetchSheetValues(accessToken, SHEET_ID, SHEET_RANGE),
      fetchSalesValues(accessToken),
    ]);
    const data = {
      ...leadData,
      salesValues,
    };
    cachedSheetPayload = {
      data,
      expiresAt: Date.now() + SHEET_CACHE_TTL_MS,
    };

    return new Response(JSON.stringify(data), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120, stale-while-revalidate=300',
        'X-Lead-Cache': 'MISS',
      },
    });
  } catch (error) {
    console.error('Error fetching leads:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
