// crawler.js
import axios from 'axios';
import fs from 'fs';
import Firecrawl from '@mendable/firecrawl-js';
const firecrawl = new Firecrawl({ apiKey: "fc-195000cba7b24263bb25a10a8328c68d"});

// Ollama configuration
const OLLAMA_URL = 'http://localhost:11434/api/generate';
const OLLAMA_MODEL = 'mistral';

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

/**
 * Start a Firecrawl crawl job
 */
async function startFirecrawl(baseUrl) {
	
	const options = {
			"url": baseUrl,
			"sitemap": "include",
			"crawlEntireDomain": false,
			"limit": 10,
			"includePaths": [
				"products/.+"
			],
			"excludePaths": ['\\?page=.+', '\\?sort=.+', '\\?filter=.+'],
			"scrapeOptions": {
				"onlyMainContent": false,
				"maxAge": 172800000,
				"parsers": [
					"pdf"
				],
				"formats": [
					{
						"type": "json",
						"schema": {
							"type": "object",
							"required": [],
							"properties": {
								"product_name": {
									"type": "string"
								  }
							}
						},
						"prompt": "Extract the name of the product this page is selling"
					}
				]
			}
	};
  try {
    const crawlResponse = await firecrawl.crawl(baseUrl, options);
	
    return crawlResponse;
  } catch (error) {
    throw new Error(`Firecrawl start failed: ${error.message}`);
  }
}

/**
 * Check Firecrawl job status and get results
 */
async function getFirecrawlResults(jobId) {
  const maxAttempts = 60; // 10 minutes max wait
  const delayMs = 10000; // Check every 10 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await firecrawl.getCrawlStatus(jobId);
	  
      if (response.status === 'completed') {
        return response.data;
      } else if (status === 'failed') {
        throw new Error('Firecrawl job failed');
      }

      // Still processing, wait and retry
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (error) {
      if (attempt === maxAttempts - 1) {
        throw new Error(`Firecrawl status check failed: ${error.message}`);
      }
    }
  }

  throw new Error('Firecrawl job timeout');
}

/**
 * Call Ollama to generate keywords
 */
async function generateKeywords(productName, description = '') {
  const prompt = `Given the following product information, generate up to 10 keywords that could be used for categorization. These keywords should describe the product type, category, features, or use case.

Product Name: ${productName}
${description ? `Description: ${description}` : ''}

Return ONLY a JSON array of exactly 5 keywords (lowercase, single words or short 2-word phrases):
["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7", "keyword8", "keyword9", "keyword10"]`;

  try {
    const response = await axios.post(OLLAMA_URL, {
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
      num_predict: 200
    }, {
      timeout: 30000
    });

    // Extract JSON array from response
    const jsonMatch = response.data.response.match(/\[[\s\S]*?\]/);
	console.log("json: " + response.data.response);
    if (!jsonMatch) {
      // Fallback: generate basic keywords from product name
      const words = productName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      return words.slice(0, 5).join(', ');
    }

    const keywords = JSON.parse(jsonMatch[0]);
    return keywords.join(', ');
  } catch (error) {
    console.error(`    ✗ Ollama keyword generation failed: ${error.message}`);
    // Fallback: use product name words as keywords
    const words = productName.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    return words.slice(0, 5).join(', ');
  }
}

/**
 * Extract product name from Firecrawl result
 */
function extractProductName(item) {
  // Try different possible locations for product name
  if (item.json && item.json.product_name) {
    return item.json.product_name;
  }
  
  if (item.metadata && item.metadata.title) {
    return item.metadata.title;
  }
  
  if (item.metadata && item.metadata.ogTitle) {
    return item.metadata.ogTitle;
  }
  
  return null;
}

/**
 * Extract description from Firecrawl result
 */
function extractDescription(item) {
  if (item.metadata && item.metadata.description) {
    return item.metadata.description;
  }
  
  if (item.metadata && item.metadata.ogDescription) {
    return item.metadata.ogDescription;
  }
  
  return '';
}

/**
 * Process Firecrawl results and generate keywords
 */
async function processFirecrawlResults(baseUrl, results) {
  const products = [];

  console.log(`  → Processing ${results.length} pages from Firecrawl...`);

  for (const item of results) {
    const productName = extractProductName(item);
    
    if (!productName || productName.length < 3) {
      continue; // Skip items without valid product names
    }

    const description = extractDescription(item);

    console.log(`    → Generating keywords for: ${productName}`);
    const keywords = await generateKeywords(productName, description);

    products.push({
      url: baseUrl,
      productName: productName,
      keywords: keywords
    });

    // Small delay between keyword generation calls
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return products;
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
  console.log('Starting product crawler with Firecrawl + Ollama...\n');
  console.log(`Total sites to crawl: ${URLS.length}\n`);
  
  const allResults = [];
  let successCount = 0;
  let failureCount = 0;
  
  for (let i = 0; i < URLS.length; i++) {
    const url = URLS[i];
    console.log(`[${i + 1}/${URLS.length}] Crawling: ${url}`);
    
    try {
      // Start Firecrawl job
      console.log(`  → Starting Firecrawl job for products/*...`);
      const confirmation = await startFirecrawl(url);
	  const jobId = confirmation.id;
      
      // Wait for results
      console.log(`  → Waiting for crawl to complete...`);
	  const finalResults = await getFirecrawlResults(jobId);
      
      // Process results with Ollama
      const products = await processFirecrawlResults(url, finalResults);
      allResults.push(...products);
      console.log(`  ✓ Extracted ${products.length} products with keywords\n`);
      successCount++;
      
    } catch (error) {
      console.log(`  ✗ Error: ${error.message}\n`);
      failureCount++;
    }
    
    // Polite delay between sites
    if (i < URLS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  
  // Save results
  const csv = resultsToCSV(allResults);
  const filename = 'product_crawler_results_firecrawl.csv';
  
  fs.writeFileSync(filename, csv, 'utf8');
  
  console.log('\n' + '='.repeat(70));
  console.log(`✓ Crawling complete!`);
  console.log(`\nResults:`);
  console.log(`  ✓ File: ${filename}`);
  console.log(`  ✓ Total products extracted: ${allResults.length}`);
  console.log(`  ✓ Successful sites: ${successCount}`);
  console.log(`  ✓ Failed sites: ${failureCount}`);
  console.log('='.repeat(70));
}

// Run the crawler
crawl().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});