// Function to select a random user preference
export const weightedRandom = (weights: { value: any; weight: number }[]) => {
  let totalWeight = weights.reduce((sum, weight) => sum + weight.weight, 0);
  let random = Math.random() * totalWeight;
  for (let i = 0; i < weights.length; i++) {
    if (random < weights[i].weight) return weights[i].value;
    random -= weights[i].weight;
  }
};

// Preferences for user agents and devices
export const preferences = [
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

export const noisifyScript = (noise: any) => `
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

/**
 * Global URL blocking function that filters out unnecessary, blocked, or low-value domains
 * @param urlString - The URL to check
 * @returns true if the URL should be blocked/filtered, false if it's acceptable
 */
export function shouldBlockUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    const hostname = url.hostname.toLowerCase();

    // Search engines and similar
    const searchEngines = [
      "google.",
      "bing.",
      "yahoo.",
      "baidu.",
      "yandex.",
      "duckduckgo.",
      "ecosia.",
      "qwant.",
    ];

    // Social media platforms
    const socialMedia = [
      "facebook.com",
      "fb.com",
      "twitter.com",
      "x.com",
      "instagram.com",
      "linkedin.com",
      "tiktok.com",
      "pinterest.com",
      "snapchat.com",
      "telegram.org",
      "whatsapp.com",
      "viber.com",
      "tumblr.com",
      "nextdoor.com",
    ];

    // Video and streaming platforms
    const videoPlatforms = [
      "youtube.com",
      "youtu.be",
      "vimeo.com",
      "dailymotion.com",
      "twitch.tv",
      "rumble.com",
      "bitchute.com",
      "odysee.com",
    ];

    // URL shorteners and redirects
    const shorteners = [
      "bit.ly",
      "tinyurl.com",
      "short.link",
      "ow.ly",
      "wp.me",
      "goo.gl",
      "adf.ly",
      "t.co",
      "amzn.to",
      "rebrand.ly",
    ];

    // Ad networks and tracking
    const adNetworks = [
      "doubleclick.net",
      "googlesyndication.com",
      "adwords.google.com",
      "facebook.com/ads",
      "criteo.com",
      "scorecardresearch.com",
      "amazon-adsystem.com",
      "tapas.io",
    ];

    // CDNs and technical services (optional - comment out if you want these)
    const technicalServices = [
      "cloudflare.com",
      "akamai.com",
      "amazonaws.com",
      "azure.com",
      "digitalocean.com",
      "github.com",
      "gitlab.com",
      "bitbucket.com",
    ];

    // File sharing and storage
    const fileSharing = [
      "dropbox.com",
      "drive.google.com",
      "icloud.com",
      "onedrive.live.com",
      "box.com",
      "mega.co.nz",
      "mediafire.com",
      "4shared.com",
    ];

    // Email and messaging
    const emailServices = [
      "gmail.com",
      "mail.google.com",
      "hotmail.com",
      "outlook.com",
      "yahoo.com",
      "protonmail.com",
    ];

    // Check against all blocked categories
    const blockedCategories = [
      searchEngines,
      socialMedia,
      videoPlatforms,
      shorteners,
      adNetworks,
      technicalServices,
      fileSharing,
      emailServices,
    ];

    // Flatten and check
    for (const category of blockedCategories) {
      for (const blocked of category) {
        if (hostname.includes(blocked)) {
          return true; // Block this URL
        }
      }
    }

    // Check for paths that are typically navigational/ads
    const blockedPaths = [
      "/ads/",
      "/advertising/",
      "/tracking/",
      "/analytics/",
      "/beacon/",
      "/pixel/",
    ];

    for (const path of blockedPaths) {
      if (url.pathname.includes(path)) {
        return true; // Block this URL
      }
    }

    return false; // URL is acceptable
  } catch (error) {
    // If URL parsing fails, block it to be safe
    return true;
  }
}
