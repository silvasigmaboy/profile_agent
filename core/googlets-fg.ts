import { chromium, Page } from "playwright";
import { newInjectedContext } from "fingerprint-injector";
import {
  generateNoise,
  noisifyScript,
  preferences,
  weightedRandom,
  shouldBlockUrl,
} from "./functions.js";
import fs from "fs";
import {
  getRandomUnfetchedKeyword,
  markKeywordFetched,
  saveUrls,
  saveQuestions,
  saveSearchQueries,
} from "../data/actions.js";

type ScrapedSearchResult = {
  url: string;
  title: string;
};

type ScrapedQuestion = {
  question: string;
};

type ScrapedSearchQuery = {
  query: string;
};

const LOOP_COUNT = 5;
const UNUSUAL_TRAFFIC_TEXT =
  "Our systems have detected unusual traffic from your computer";
const DISCORD_screenshot = true;
function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const dicord = async (page: Page, keyword: string, iteration: number) => {
  try {
    const screenshotPath = `screenshot_${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });

    if (DISCORD_screenshot) {
      const formData = new FormData();
      formData.append(
        "content",
        `📸 View from "America/New_York", searched for ${keyword} (iteration ${iteration})`,
      );

      const fileBuffer = fs.readFileSync(screenshotPath);
      const fileArrayBuffer: ArrayBuffer = fileBuffer.buffer.slice(
        fileBuffer.byteOffset,
        fileBuffer.byteOffset + fileBuffer.byteLength,
      ) as ArrayBuffer;
      const fileBlob = new Blob([fileArrayBuffer], { type: "image/png" });
      formData.append("file", fileBlob, "screenshot.png");

      await fetch(process.env.DISCORD_WEBHOOK_URL || "", {
        method: "POST",
        body: formData,
      });
      console.log("[discord] Screenshot sent!");
    }
    fs.unlinkSync(screenshotPath); // clean up
    // mark keyword fetched
    await markKeywordFetched(keyword);
  } catch (ssError: any) {
    console.log("[error] Screenshot failed:", ssError.message);
  }
};

async function scrapeGoogleResultUrls(
  page: Page,
): Promise<ScrapedSearchResult[]> {
  const scrapedResults = await page.evaluate(() => {
    const resultAnchors = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(
        '#search a[href], a[href][jsname="UWckNb"]',
      ),
    );

    return resultAnchors.map((anchor) => ({
      url: anchor.href,
      title:
        anchor.querySelector("h3")?.textContent?.trim() ||
        anchor.getAttribute("aria-label")?.trim() ||
        anchor.textContent?.trim() ||
        "",
    }));
  });

  // Filter results using global blocking function (server-side)
  const filtered = scrapedResults.filter(({ url, title }) => {
    // Basic validation
    if (!url || !title) {
      return false;
    }

    // Apply global blocking function
    return !shouldBlockUrl(url);
  });

  // Deduplicate by URL
  const seen = new Set<string>();
  return filtered.filter((item) => {
    const normalized = item.url.trim();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

async function scrapeGoogleQuestions(page: Page): Promise<ScrapedQuestion[]> {
  const scrapedQuestions = await page.evaluate(() => {
    // Find all question containers in the "People also ask" section
    const questionElements = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".Wt5Tfe .wQiwMc.related-question-pair span.CSkcDe",
      ),
    );

    return questionElements
      .map((element) => ({
        question: element.textContent?.trim() || "",
      }))
      .filter(({ question }) => question.length > 0);
  });

  // Deduplicate questions
  const seen = new Set<string>();
  return scrapedQuestions.filter((item) => {
    const normalized = item.question.toLowerCase().trim();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

async function scrapeGoogleSearchQueries(
  page: Page,
): Promise<ScrapedSearchQuery[]> {
  const scrapedQueries = await page.evaluate(() => {
    // Find all search query links in the "People also search for" section
    const queryLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(".oIk2Cb .ngTNl.ggLgoc"),
    );

    return queryLinks
      .map((link) => {
        // Extract query text from the span with class "dg6jd"
        const querySpan = link.querySelector(".dg6jd.JGD2rd");
        const queryText = querySpan?.textContent?.trim() || "";
        return { query: queryText };
      })
      .filter(({ query }) => query.length > 0);
  });

  // Deduplicate queries
  const seen = new Set<string>();
  return scrapedQueries.filter((item) => {
    const normalized = item.query.toLowerCase().trim();
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

async function openBrowserOnce(
  iteration: number,
  keyword: string,
): Promise<void> {
  const userPreference = weightedRandom(preferences);
  const browser = await chromium.launch({
    headless: false,
  });

  // let timezone = await checkTz();

  //   // Only return false if it STILL failed after all retries
  //   if (timezone == undefined) {
  //     console.log("Failed to get timezone after retries, skipping bot.");
  //     return false;
  //   }

  const context = await newInjectedContext(browser, {
    fingerprintOptions: {
      devices: ["desktop"],
      browsers: ["chrome"],
      operatingSystems: ["windows"],
      mockWebRTC: true,
    },
    newContextOptions: {
      timezoneId: "America/New_York",
    },
  });

  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;

    const noise = generateNoise();
    const page = await context.newPage();
    await page.addInitScript(noisifyScript(noise));
    await page.goto(url, { waitUntil: "load" });

    await page
      .waitForLoadState("networkidle", { timeout: 30000 })
      .catch(() => {});

    const pageHtml = await page.content();
    if (pageHtml.includes(UNUSUAL_TRAFFIC_TEXT)) {
      console.log(
        `[sample] run ${iteration}/${LOOP_COUNT} blocked by unusual-traffic page, skipping to next iteration`,
      );
      return;
    }

    await page.waitForTimeout(randomDelay(10000, 30000));
    const results = await scrapeGoogleResultUrls(page);

    console.log(`[sample] run ${iteration}/${LOOP_COUNT} completed`);
    console.log(`[sample] extracted ${results.length} urls`);

    results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.url}`);
    });

    await saveUrls(
      keyword,
      results.map((result) => result.url),
    );

    const questions = await scrapeGoogleQuestions(page);
    console.log(`[sample] extracted ${questions.length} questions`);

    await saveQuestions(
      keyword,
      questions.map((question) => question.question),
    );

    const searchQueries = await scrapeGoogleSearchQueries(page);
    console.log(
      `[sample] extracted ${searchQueries.length} related search queries`,
    );

    searchQueries.forEach((query, index) => {
      console.log(`S${index + 1}. ${query.query}`);
    });

    await saveSearchQueries(
      keyword,
      searchQueries.map((query) => query.query),
    );

    // --- Screenshot Logic ---
    DISCORD_screenshot && (await dicord(page, keyword, iteration));
  } finally {
    await context.close();
    await browser.close();
  }
}

async function runSampleLoops() {
  for (let iteration = 1; iteration <= LOOP_COUNT; iteration++) {
    const keyword = await getRandomUnfetchedKeyword();
    if (keyword) {
      // placeholder for actual keyword fetching logic
      await openBrowserOnce(iteration, keyword);
    }
  }
}

runSampleLoops().catch((error) => {
  console.error("Sample run failed:", error);
  process.exitCode = 1;
});
