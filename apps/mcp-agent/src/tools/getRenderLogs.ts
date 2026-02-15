import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const getRenderLogs = async () => {
  try {
    console.log("Fetching logs from Render...");
    const API_KEY = process.env.RENDER_API_KEY;
    const SERVICE_ID = process.env.RENDER_SERVICE_ID;
    const OWNER_ID = process.env.RENDER_OWNER_ID;

    if (!API_KEY || !SERVICE_ID || !OWNER_ID) {
      throw new Error("Missing Render environment variables.");
    }

    // for getting past 24 hours logs
    const now = new Date();
    const twentyFourHoursAgo = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    );

    const response = await axios.get(
      "https://api.render.com/v1/logs",
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
        params: {
          ownerId: OWNER_ID,                
          resource: SERVICE_ID,            
          startTime: twentyFourHoursAgo.toISOString(),
          endTime: now.toISOString(),
          direction: "backward",
          limit: 100,
        },
      }
    );


    const logs = response.data.logs || [];



  
    const logsText = logs
      .map((log: any) => log.message)
      .join("\n");

    return JSON.stringify(logs);

  } catch (error: any) {
    console.error(error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
};