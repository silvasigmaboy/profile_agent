import { chromium } from "playwright";
import { newInjectedContext } from "fingerprint-injector";
import { checkTz } from "./tz_px_noproxy.js";
import fs from "fs";

// new approach
// no proxy used
// just 5 loops
// change get nodes url

// controll one workflow without stoping it logic

const args = process.argv.slice(2);
let theworknum = null;
const DISCORD_WEBHOOK_URL =
  "https://discord.com/api/webhooks/1494468006045159464/4NIyU6ar-9WH7DGcvnypJOpBodpYxfF9FicWzVlkUknrSLoUAsWBsX6H9O-y8J6cfZFm";
args.forEach((arg) => {
  if (arg.startsWith("work=")) {
    theworknum = arg.split("=")[1].match(/\d+/)[0];
  }
});
// change this
// const endPoint = `http://localhost:3000`; // change this
// change this
const endPoint =
  "https://main-managment-dashboard.idrissimahdi2020.workers.dev";
async function getNodeInfo() {
  try {
    const request = await fetch(`${endPoint}/api/config/threads`);
    console.log("Fetching node info...");
    const data = await request.json();
    return data;
  } catch (error) {
    console.log(error);
  }
}

async function getCustomCountries() {
  try {
    const request = await fetch(`${endPoint}/api/config/customloc`);
    console.log("Fetching custom countries...");
    const data = await request.json();
    return data;
  } catch (error) {
    console.log(error);
  }
}

function generateRandomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const locations = [
  "se", // Sweden
  "ng", // Nigeria
  "cm", // Cameroon
  "ci", // Cote D'Ivoire
  "ua", // Ukraine
  "at", // Austria
  "at", // Austria
  "fr", // France
  "ca", // Canada
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "us", // United States
  "fr", // France
  "fr", // France
  "fr", // France
  "uk", // United Kingdom
  "au", // Australia
  "de", // Germany
  "jp", // Japan
  "sg", // Singapore
  "kr", // South Korea
  "it", // Italy
  "es", // Spain
  "in", // India
  "id", // Indonesia
  "ph", // Philippines
  "th", // Thailand
  "my", // Malaysia
  "eg", // Egypt
  "tr", // Turkey
  "pk", // Pakistan (English speakers, strong internet growth)
  "bd", // Bangladesh (growing internet users, relevance to global content)
  "mx", // Mexico (geographical proximity, U.S. ties)
  "lk", // Sri Lanka
  "ml", // Mali
  "bj", // Benin
  "ug", // Uganda
  "mm", // Myanmar
  "no", // Norway
  "pf", // French Polynesia
  "np", // Nepal
  "bf", // Burkina Faso
  "cd", // Congo, The Democratic Republic of the
  "bi", // Burundi
  "gf", // French Guiana
  "cf", // Central African Republic
  "hk", // Hong Kong
  "cg", // Congo
];

// Function to select a random user preference
const weightedRandom = (weights) => {
  let totalWeight = weights.reduce((sum, weight) => sum + weight.weight, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i].weight) return weights[i].value;
    random -= weights[i].weight;
  }
};

// Preferences for user agents and devices
const preferences = [
  {
    value: { device: "desktop", os: "windows", browser: "chrome" },
    weight: 20,
  },

  {
    value: { device: "mobile", os: "android", browser: "chrome" },
    weight: 100,
  },
];

export const generateNoise = () => {
  const shift = {
    r: Math.floor(Math.random() * 5) - 2,
    g: Math.floor(Math.random() * 5) - 2,
    b: Math.floor(Math.random() * 5) - 2,
    a: Math.floor(Math.random() * 5) - 2,
  };
  const webglNoise = (Math.random() - 0.5) * 0.01;
  const clientRectsNoise = {
    deltaX: (Math.random() - 0.5) * 2,
    deltaY: (Math.random() - 0.5) * 2,
  };
  const audioNoise = (Math.random() - 0.5) * 0.000001;

  return { shift, webglNoise, clientRectsNoise, audioNoise };
};

export const noisifyScript = (noise) => `
  (function() {
    const noise = ${JSON.stringify(noise)};

    // Canvas Noisify
    const getImageData = CanvasRenderingContext2D.prototype.getImageData;
    const noisify = function (canvas, context) {
      if (context) {
        const shift = noise.shift;
        const width = canvas.width;
        const height = canvas.height;
        if (width && height) {
          const imageData = getImageData.apply(context, [0, 0, width, height]);
          for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
              const n = ((i * (width * 4)) + (j * 4));
              imageData.data[n + 0] = imageData.data[n + 0] + shift.r;
              imageData.data[n + 1] = imageData.data[n + 1] + shift.g;
              imageData.data[n + 2] = imageData.data[n + 2] + shift.b;
              imageData.data[n + 3] = imageData.data[n + 3] + shift.a;
            }
          }
          context.putImageData(imageData, 0, 0); 
        }
      }
    };
    HTMLCanvasElement.prototype.toBlob = new Proxy(HTMLCanvasElement.prototype.toBlob, {
      apply(target, self, args) {
        noisify(self, self.getContext("2d"));
        return Reflect.apply(target, self, args);
      }
    });
    HTMLCanvasElement.prototype.toDataURL = new Proxy(HTMLCanvasElement.prototype.toDataURL, {
      apply(target, self, args) {
        noisify(self, self.getContext("2d"));
        return Reflect.apply(target, self, args);
      }
    });
    CanvasRenderingContext2D.prototype.getImageData = new Proxy(CanvasRenderingContext2D.prototype.getImageData, {
      apply(target, self, args) {
        noisify(self.canvas, self);
        return Reflect.apply(target, self, args);
      }
    });

    // Audio Noisify
    const originalGetChannelData = AudioBuffer.prototype.getChannelData;
    AudioBuffer.prototype.getChannelData = function() {
      const results = originalGetChannelData.apply(this, arguments);
      for (let i = 0; i < results.length; i++) {
        results[i] += noise.audioNoise; // Smaller variation
      }
      return results;
    };

    const originalCopyFromChannel = AudioBuffer.prototype.copyFromChannel;
    AudioBuffer.prototype.copyFromChannel = function() {
      const channelData = new Float32Array(arguments[1]);
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] += noise.audioNoise; // Smaller variation
      }
      return originalCopyFromChannel.apply(this, [channelData, ...Array.prototype.slice.call(arguments, 1)]);
    };

    const originalCopyToChannel = AudioBuffer.prototype.copyToChannel;
    AudioBuffer.prototype.copyToChannel = function() {
      const channelData = arguments[0];
      for (let i = 0; i < channelData.length; i++) {
        channelData[i] += noise.audioNoise; // Smaller variation
      }
      return originalCopyToChannel.apply(this, arguments);
    };

    // WebGL Noisify
    const originalGetParameter = WebGLRenderingContext.prototype.getParameter;
    WebGLRenderingContext.prototype.getParameter = function() {
      const value = originalGetParameter.apply(this, arguments);
      if (typeof value === 'number') {
        return value + noise.webglNoise; // Small random variation
      }
      return value;
    };

    // ClientRects Noisify
    const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function() {
      const rect = originalGetBoundingClientRect.apply(this, arguments);
      const deltaX = noise.clientRectsNoise.deltaX; // Random shift between -1 and 1
      const deltaY = noise.clientRectsNoise.deltaY; // Random shift between -1 and 1
      return {
        x: rect.x + deltaX,
        y: rect.y + deltaY,
        width: rect.width + deltaX,
        height: rect.height + deltaY,
        top: rect.top + deltaY,
        right: rect.right + deltaX,
        bottom: rect.bottom + deltaY,
        left: rect.left + deltaX
      };
    };
  })();
`;

// Function to simulate random clicks on a page
const performRandomClicks = async (page, currentNode) => {
  for (let i = 0; i < 1; i++) {
    const width = await page.evaluate(() => window.innerWidth);
    const height = await page.evaluate(() => window.innerHeight);
    const x = generateRandomNumber(0, width);
    const y = generateRandomNumber(0, height);
    await page.mouse.click(x, y);
    await page.waitForTimeout(generateRandomNumber(2000, 3000));
  }
};

const blockResources = async (page) => {
  await page.route("**/*", (route) => {
    const resourceType = route.request().resourceType();
    if (["image", "stylesheet", "media"].includes(resourceType)) {
      route.abort();
    } else {
      route.continue();
    }
  });
};

const generateSessionId = (length = 32) => {
  let result = "";
  const chars = "0123456789"; // Only use digits to avoid proxy username format issues
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const generateUsername = (countries, currentNode) => {
  // API returns { customLocations: { listName: [...] } }
  const allLists = countries?.customLocations || {};
  const listName = currentNode.countriesListName || "default_legacy";

  const pool = allLists[listName] ?? allLists["default_legacy"] ?? locations;

  const location = pool[generateRandomNumber(0, pool.length - 1)];
  const sessionId = generateSessionId(100);
  const username = `brd-customer-hl_19cb0fe8-zone-mw-country-${location}-session-${sessionId}`;
  return username;
};

const OpenBrowser = async (username, currentNode, countries, views) => {
  const userPreference = weightedRandom(preferences);
  let retry = 3;
  let timezone = await checkTz(username);

  if (timezone == undefined) {
    console.log("[error] undefined timezone, retry");
    for (let index = 0; index < 3; index++) {
      const newUsername = generateUsername(countries, currentNode);
      timezone = await checkTz(newUsername);
      if (timezone != undefined) {
        username = newUsername;
        break;
      }
    }
    // Only return false if it STILL failed after all retries
    if (timezone == undefined) {
      console.log("Failed to get timezone after retries, skipping bot.");
      return false;
    }
  }

  const browser = await chromium.launch({
    headless: false,
    // proxy: {
    //   server: `${process.env.proxy_server}`,
    //   username: username,
    //   password: process.env.proxy_password,
    // },
  });

  const context = await newInjectedContext(browser, {
    fingerprintOptions: {
      devices: [userPreference.device],
      browsers: [userPreference.browser],
      operatingSystems: [userPreference.os],
      mockWebRTC: true,
    },
    newContextOptions: {
      timezoneId: timezone || "America/New_York",
    },
  });
  try {
    const noise = generateNoise();
    const page = await context.newPage();
    // add media blockers
    // await blockResources(page);
    await page.addInitScript(noisifyScript(noise));
    console.log(
      `w -> ${theworknum}| views -> ${views.views} | website -> ${currentNode.link} | list -> ${currentNode.countriesListName || "default_legacy"} | threads -> ${currentNode.bots} | Browser view from -> ${timezone} | userPreference -> ${userPreference.device}`,
    );
    const keyword = "Short-term rental permits in berlin";
    const targetUrl = `https://www.google.com/search?q=${encodeURIComponent(keyword)}`;
    await page.goto(targetUrl, { waitUntil: "load" });
    // Wait for network to settle after page load
    await page
      .waitForLoadState("networkidle", { timeout: 30000 })
      .catch(() => {});
    // Random initial wait (simulate human reading time: 5-15 seconds)
    const initialWait = generateRandomNumber(1000, 10000);
    await page.waitForTimeout(initialWait);
    await performRandomClicks(page);
    const dwellTime = generateRandomNumber(10000, 35000);
    await page.waitForTimeout(dwellTime);

    // --- Screenshot Logic ---
    try {
      const screenshotPath = `screenshot_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });

      if (DISCORD_WEBHOOK_URL) {
        const formData = new FormData();
        formData.append("content", `📸 View registered from ${timezone}`);

        const fileBuffer = fs.readFileSync(screenshotPath);
        const fileBlob = new Blob([fileBuffer], { type: "image/png" });
        formData.append("file", fileBlob, "screenshot.png");

        await fetch(DISCORD_WEBHOOK_URL, {
          method: "POST",
          body: formData,
        });
        console.log("[discord] Screenshot sent!");
      }
      fs.unlinkSync(screenshotPath); // clean up
    } catch (ssError) {
      console.log("[error] Screenshot failed:", ssError.message);
    }
    // -------------------------

    // // Register view natively
    // fetch(`${endPoint}/api/views`, {
    //   method: "POST",
    //   headers: {
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     website: new URL(currentNode.link).hostname,
    //     viewRegistred: true,
    //   }),
    // })
    //   .then((res) => res.json())
    //   .then((data) => console.log(data))
    //   .catch((err) => console.error("Request failed:", err));

    return true;
  } catch (error) {
    console.log(error);
  } finally {
    await context.close();
    await browser.close();
  }
};

const tasksPoll = async (currentNode, countries, views, pendingViews) => {
  const botCount = Number(currentNode.bots) || 1;
  const hostname = new URL(currentNode.link).hostname;

  const tasks = Array.from({ length: botCount || 2 }).map(() => {
    const username = generateUsername(countries, currentNode);
    return OpenBrowser(username, currentNode, countries, views).then(
      (success) => {
        if (success) {
          // Accumulate into the shared batch map instead of sending a request
          pendingViews[hostname] = (pendingViews[hostname] || 0) + 1;
        }
      },
    );
  });

  await Promise.all(tasks);
};

/** Flush all accumulated views to the batch endpoint in a single request */
const flushViews = async (pendingViews) => {
  const total = Object.values(pendingViews).reduce((s, c) => s + c, 0);
  if (total === 0) return;
  try {
    const res = await fetch(`${endPoint}/api/views/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pendingViews),
    });
    const data = await res.json();
    console.log(
      `[views] Batch flushed → ${data.message || JSON.stringify(data)}`,
    );
  } catch (err) {
    console.error("[views] Batch flush failed:", err);
  }
};

const RunTasks = async () => {
  const nodes = await getNodeInfo();
  const viewLog = [];
  const currentNode = nodes["work_" + theworknum];
  const keys = Object.keys(currentNode);

  keys.map((key) => {
    viewLog.push({ key: theworknum, node: currentNode[key], views: 0 });
  });

  for (let i = 0; i < 2; i++) {
    const countries = await getCustomCountries();
    const nodes = await getNodeInfo();

    if (nodes === undefined || nodes.length < 0) {
      console.log("No nodes found or error fetching nodes.");
      return;
    }
    const currentNode = nodes["work_" + theworknum];
    const keys = Object.keys(currentNode);

    // ── Reconcile viewLog so it always mirrors the live node config ──────────
    // 1. Add entries for any newly added nodes
    for (const key of keys) {
      const link = currentNode[key].link;
      if (!viewLog.find((item) => item.node.link === link)) {
        console.log(
          `[viewLog] New node detected: ${link} — adding to view log.`,
        );
        viewLog.push({ key: theworknum, node: currentNode[key], views: 0 });
      }
    }
    // 2. Remove stale entries for nodes that were deleted from the config
    const activeLinks = new Set(keys.map((k) => currentNode[k].link));
    for (let j = viewLog.length - 1; j >= 0; j--) {
      if (!activeLinks.has(viewLog[j].node.link)) {
        console.log(
          `[viewLog] Removed node: ${viewLog[j].node.link} — pruning from view log.`,
        );
        viewLog.splice(j, 1);
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // One shared batch map per iteration — all threads write into it
    const pendingViews = {};

    const tasks = keys.map((key) => {
      const node = currentNode[key];
      const logEntry = viewLog.find((item) => item.node.link === node.link);
      logEntry.views += Number(node.bots) || 0;

      return tasksPoll(node, countries, logEntry, pendingViews);
    });

    console.log(
      `Running tasks for workflow ${theworknum}, nodes ${keys.length}, iteration ${i + 1}`,
    );
    await Promise.all(tasks);

    // Single batch request for all views generated this iteration
    await flushViews(pendingViews);
  }
};

RunTasks();
