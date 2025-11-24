// crawler.js
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// List of URLs to crawl
const URLS = [
  'https://7bonkers.com',
  'https://9wik.com',
  'https://acegolfs.com',
  'https://artisancutlery.net',
  'https://audienhearing.com',
  'https://beecoolbikes.com',
  'https://bugmd.com',
  'https://carerspk.com',
  'https://clarifion.com',
  'https://cleanomic.com',
  'https://collarsandco.com',
  'https://cosmicmonica.com',
  'https://cozybabywear.com',
  'https://curtarra.com',
  'https://drinkbrez.com',
  'https://funnyfuzzy.com',
  'https://gleefullsupps.com',
  'https://groundingwell.com',
  'https://hobbytron.com',
  'https://inpeaceful.com',
  'https://puranutrausa.com',
  'https://cozytraildel.com',
  'https://etherealing.com',
  'https://yeyolento.com',
  'https://theearthlingco.com',
  'https://truheightvitamins.com'
];

// Configuration for Ollama
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'mistral'; // or 'neural-chat', 'llama2', etc.

/**
 * Fetch HTML content from a URL
 */
async function fetchPage(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      timeout: 10000,
      maxRedirects: 5
    });
    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch: ${error.message}`);
  }
}

/**
 * Extract raw HTML text for LLM analysis
 */
function extractPageContent(html, url) {
  const $ = cheerio.load(html);
  
  // Remove script, style, and nav tags
  $('script, style, nav, footer, noscript').remove();
  
  // Get page title
  const title = $('title').text().trim();
  
  // Get main content area (prioritize main, article, or .content elements)
  let mainContent = $('main, [role="main"], .main-content, .content, article').html();
  
  // Fallback to body if no main content area
  if (!mainContent) {
    mainContent = $('body').html();
  }
  
  // Convert to readable text
  const $2 = cheerio.load(mainContent || '');
  
  // Get all visible text
  let text = $2.text();
  
  // Clean up text
  text = text
    .replace(/\s+/g, ' ') // Collapse whitespace
    .substring(0, 4000); // Limit to 4000 chars to avoid token limits
  
  return {
    url,
    title,
    content: text
  };
}

/**
 * Call Ollama API locally
 */
async function callOllama(prompt) {
  try {
    const response = await axios.post(OLLAMA_URL, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      num_predict: 500
    }, {
      timeout: 60000 // 60 second timeout
    });
    
    return response.data.response;
  } catch (error) {
    throw new Error(`Ollama error: ${error.message}`);
  }
}

/**
 * Validate if a product name is real and not a placeholder
 */
function isValidProductName(name) {
  if (!name || name.length < 3) return false;
  
  // Reject placeholder patterns
  const placeholders = [
    /^\(not identified/i,
    /^product\s+\d+$/i,
    /^item\s+\d+$/i,
    /^article\s+\d+$/i,
    /^name missing/i,
    /^unnamed/i,
    /^unknown/i,
    /^n\/a$/i,
    /^tbd$/i,
    /^pending$/i
  ];
  
  for (const pattern of placeholders) {
    if (pattern.test(name.trim())) {
      return false;
    }
  }
  
  return true;
}

/**
 * Extract products using Ollama LLM with retry logic
 */
async function extractProductsWithOllama(pageContent, retryCount = 0, maxRetries = 5) {
  const { url, title, content } = pageContent;
  
  const prompt = `You are analyzing a landing page. Extract up to 5 distinct products OR articles being sold/featured/published.
  
  Step 1) ask yourself "what kind of website is ${url}". Find out what is its claimed purpose and what is its content type.
  Step 2) If it is a shopping website, Extract the names of up to 5 distinct products, goods, or services being sold/featured. For each one, come up with up to 10 comma-separated keywords for categorization.
  Step 3) If it also presents articles or content pieces, extract the headers of these items. For each one, "article" should be one of the keywords for categorization. Look for article titles in content containers, cards, items, or similar elements (NOT page-level headers or navigation labels).

CRITICAL DISTINCTION:
- PRODUCTS: Items for sale (e-commerce items, physical goods, services with prices)
- ARTICLES: Blog posts, news articles, guides, or educational content with titles and publication info. One of the categories for this product should be "article".
- NOT ARTICLE NAMES: Page-level navigation or headers like "Top Trending", "Latest Articles", "Featured" - these are page labels, not content titles.

IMPORTANT: Only include REAL product/article names that actually exist on the page. If you cannot find any real products or articles, return an empty array [].

URL: ${url}
Page Title: ${title}

Page Content:
${content}

Return ONLY a JSON array with up to 5 products as you can find. Each product should have:
- name: the actual product/article name (NOT page headers, buttons, labels, or navigation items). Only include if you are certain it exists on the page.
- keywords: 3-5 comma-separated keywords for categorization

Exclude:
- Button text ("Quick add", "Quick view", "Browse All")
- Navigation/page headers ("Top trendings", "Latest articles", "Featured")
- Price text (that's NOT a product name)
- Labels ("New arrival", "Product type")
- Non-product elements ("Contact Us", "Mastercard")
- Generic/placeholder names like "Product 1", "Item 2", "Article 3", "(not identified)", "unnamed", "product/articlename1", "product/articlename2", "product/articlename3", "keyword1", "keyword2", "keyword3"
- Made-up or inferred product names that don't actually appear on the page

If you find NO real products, return an empty array: []

Return valid JSON only. Example:
[
  {"name": "product/articlename1", "keywords": "keyword1, keyword2, keyword3"},
  {"name": "product/articlename2", "keywords": "keyword1, keyword2, keyword3"}
]`;

  try {
    const response = await callOllama(prompt);
    
    // Parse JSON from response
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error(`    ✗ No JSON array found in response`);
      console.error(`    Response preview: ${response.substring(0, 200)}`);
      throw new Error('No JSON found in response');
    }
    
    const jsonStr = jsonMatch[0];
    
    let products;
    try {
      products = JSON.parse(jsonStr);
    } catch (parseError) {
      // Log detailed error information for debugging
      console.error(`    ✗ JSON parsing failed: ${parseError.message}`);
      console.error(`    JSON length: ${jsonStr.length} characters`);
      console.error(`    First 500 chars: ${jsonStr.substring(0, 500)}`);
      console.error(`    Last 500 chars: ${jsonStr.substring(Math.max(0, jsonStr.length - 500))}`);
      
      // Try to find the problematic character
      const match = parseError.message.match(/position (\d+)/);
      if (match) {
        const pos = parseInt(match[1]);
        const start = Math.max(0, pos - 100);
        const end = Math.min(jsonStr.length, pos + 100);
        console.error(`    Context around error (pos ${pos}): ...${jsonStr.substring(start, end)}...`);
      }
      
      throw parseError;
    }
    
    // Validate all products
    const validProducts = products.filter(p => isValidProductName(p.name));
    
    // If no valid products found, retry
    if (validProducts.length === 0 && retryCount < maxRetries) {
      console.log(`    ⚠ No valid products found (attempt ${retryCount + 1}/${maxRetries + 1}), retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
      return extractProductsWithOllama(pageContent, retryCount + 1, maxRetries);
    }
    
    // If still no valid products after max retries, log and return empty
    if (validProducts.length === 0) {
      console.log(`    ⚠ No valid products found after ${maxRetries + 1} attempts`);
    }
    
    return validProducts.map(p => ({
      url,
      productName: p.name,
      keywords: p.keywords
    }));
    
  } catch (error) {
    // Retry on error
    if (retryCount < maxRetries) {
      console.error(`  Error with Ollama (attempt ${retryCount + 1}/${maxRetries + 1}): ${error.message}, retrying...`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait before retry
      return extractProductsWithOllama(pageContent, retryCount + 1, maxRetries);
    }
    
    console.error(`  Error with Ollama (final attempt): ${error.message}`);
    return [];
  }
}

/**
 * Convert results to CSV format
 */
function resultsToCSV(results) {
  const headers = ['URL', 'Product Name', 'Keywords'];
  const rows = results.map(r => [
    `"${r.url}"`,
    `"${r.productName.replace(/"/g, '""')}"`,
    `"${r.keywords}"`
  ]);
  
  return [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n');
}

/**
 * Main crawler function
 */
async function crawl() {
  console.log('Starting product landing page crawler with Ollama LLM analysis...\n');
  console.log(`Total URLs to crawl: ${URLS.length}\n`);
  
  const results = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`[${i + 1}/${URLS.length}] Analyzing: ${url}`);
    
    try {
      const html = await fetchPage(url);
      const pageContent = extractPageContent(html, url);
      
      console.log(`  → Processing with Ollama...`);
      try {
        const products = await extractProductsWithOllama(pageContent);
        results.push(...products);
        console.log(`    ✓ Found ${products.length} products`);
        successCount++;
      } catch (error) {
        console.log(`    ✗ Ollama extraction failed: ${error.message}`);
        failureCount++;
      }    
      console.log();
      
    } catch (error) {
      console.log(`  ✗ Fetch error: ${error.message}\n`);
      failureCount++;
    }
    
    // Polite delay between requests
    if (i < URLS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Save results
  const csv = resultsToCSV(results);
  const filename = 'product_crawler_results_ollama.csv';
  
  fs.writeFileSync(filename, csv, 'utf8');
  
  console.log('\n' + '='.repeat(70));
  console.log(`✓ Crawling complete!`);
  console.log(`\nResults:`);
  console.log(`  ✓ File: ${filename}`);
  console.log(`  ✓ Total products extracted: ${results.length}`);
  console.log(`  ✓ Successful URLs: ${successCount}`);
  console.log(`  ✓ Failed URLs: ${failureCount}`);
  console.log('='.repeat(70));
}

// Run the crawler
crawl().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});