export const checkTz = async (username) => {
  try {
    const response = await fetch(
      "https://worker-purple-wind-1de7.idrissimahdi2020.workers.dev",
      {
        signal: AbortSignal.timeout(10000),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      },
    );
    const data = await response.text();
    const timezone = data.trim();
    return timezone || undefined;
  } catch (error) {
    return undefined;
  }
};
