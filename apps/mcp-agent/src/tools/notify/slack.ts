import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

export const sendSlackAlert = async (alertData: {
  serviceName: string;
  severity: string;
  errorMessage: string;
  rootCause: string;
  suggestedFix: string;
}) => {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("Slack webhook URL missing.");
  }

  const message = {
    text: `🚨 ${alertData.serviceName} Incident`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text:
            `*Service:* ${alertData.serviceName}\n` +
            `*Severity:* ${alertData.severity}\n` +
            `*Error:* ${alertData.errorMessage}\n` +
            `*Root Cause:* ${alertData.rootCause}\n` +
            `*Suggested Fix:* ${alertData.suggestedFix}`
        }
      }
    ]
  };

  await axios.post(webhookUrl, message);
};