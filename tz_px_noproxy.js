import axios from "axios";
import "dotenv/config";

export const checkTz = async (username) => {
  // Properly formatted proxy URL

  try {
    const response = await axios.get(
      "https://worker-purple-wind-1de7.idrissimahdi2020.workers.dev",
      {
        timeout: 10000,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        },
      },
    );
    const ipDetails = { timezone: response.data.trim() };
    return ipDetails?.timezone || undefined;
  } catch (error) {
    // console.error("Error fetching timezone:", error.message);
    return undefined;
  }
};
