import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const googleSearchApiKey = Deno.env.get('GOOGLE_SEARCH_API_KEY');
const googleSearchEngineId = Deno.env.get('GOOGLE_SEARCH_ENGINE_ID');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompetitorResult {
  name: string;
  url: string;
  description: string;
  source: string;
}

interface GoogleSearchItem {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchItem[];
  searchInformation?: {
    totalResults: string;
  };
  error?: {
    message: string;
    code: number;
  };
}

/**
 * Search Google Custom Search API for a single query.
 * Returns up to 10 results per call.
 */
async function searchGoogle(
  query: string,
  startIndex: number = 1
): Promise<GoogleSearchItem[]> {
  const params = new URLSearchParams({
    key: googleSearchApiKey!,
    cx: googleSearchEngineId!,
    q: query,
    num: '10',
    start: String(startIndex),
  });

  const response = await fetch(
    `https://www.googleapis.com/customsearch/v1?${params.toString()}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Google Search API error (${response.status}):`, errorText);
    throw new Error(`Google Search API error: ${response.status}`);
  }

  const data: GoogleSearchResponse = await response.json();

  if (data.error) {
    throw new Error(`Google Search API: ${data.error.message}`);
  }

  return data.items ?? [];
}

/**
 * Deduplicate competitors by domain, keeping the first occurrence.
 */
function deduplicateByDomain(competitors: CompetitorResult[]): CompetitorResult[] {
  const seen = new Set<string>();
  return competitors.filter((competitor) => {
    const domain = extractDomain(competitor.url);
    if (seen.has(domain)) return false;
    seen.add(domain);
    return true;
  });
}

/**
 * Extract root domain from a URL for deduplication.
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    // Remove www. prefix for consistent comparison
    return hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Filter out non-competitor results (directories, marketplaces, social media, etc.)
 */
function isLikelyCompetitor(item: GoogleSearchItem): boolean {
  const excludedDomains = [
    'amazon.com', 'ebay.com', 'walmart.com', 'target.com',
    'wikipedia.org', 'youtube.com', 'facebook.com', 'instagram.com',
    'twitter.com', 'x.com', 'linkedin.com', 'pinterest.com',
    'reddit.com', 'yelp.com', 'bbb.org', 'crunchbase.com',
    'glassdoor.com', 'indeed.com', 'google.com',
    'tiktok.com', 'medium.com', 'quora.com',
  ];

  const domain = extractDomain(item.link);
  return !excludedDomains.some((excluded) => domain.endsWith(excluded));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!googleSearchApiKey || !googleSearchEngineId) {
      throw new Error('Missing GOOGLE_SEARCH_API_KEY or GOOGLE_SEARCH_ENGINE_ID environment variables');
    }

    const { brandName, industry, productCategory, maxResults = 15 } = await req.json();

    if (!brandName || !industry) {
      return new Response(
        JSON.stringify({ error: 'brandName and industry are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Competitor discovery request:', { brandName, industry, productCategory, maxResults });

    // Build search queries targeting direct competitors
    const queries = [
      `${industry} ${productCategory || ''} brands competitors`.trim(),
      `best ${industry} ${productCategory || ''} companies`.trim(),
      `${brandName} competitors ${industry}`.trim(),
    ];

    const allItems: GoogleSearchItem[] = [];

    for (const query of queries) {
      try {
        console.log(`Searching: "${query}"`);
        const items = await searchGoogle(query);
        allItems.push(...items);
      } catch (queryError) {
        console.error(`Search failed for query "${query}":`, queryError);
        // Continue with other queries
      }
    }

    if (allItems.length === 0) {
      return new Response(
        JSON.stringify({ competitors: [], message: 'No results found. Try different search terms.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter and transform results
    const competitors: CompetitorResult[] = allItems
      .filter(isLikelyCompetitor)
      .map((item) => ({
        name: item.title.split(' - ')[0].split(' | ')[0].trim(),
        url: item.link,
        description: item.snippet || '',
        source: 'google_search',
      }));

    // Deduplicate and limit
    const uniqueCompetitors = deduplicateByDomain(competitors).slice(0, maxResults);

    // Remove the requesting brand from results
    const filtered = uniqueCompetitors.filter((c) => {
      const domain = extractDomain(c.url);
      const brandLower = brandName.toLowerCase().replace(/\s+/g, '');
      return !domain.includes(brandLower);
    });

    console.log(`Competitor discovery completed: ${filtered.length} competitors found`);

    return new Response(
      JSON.stringify({
        competitors: filtered,
        totalFound: filtered.length,
        queriesUsed: queries,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in competitor-discovery function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
