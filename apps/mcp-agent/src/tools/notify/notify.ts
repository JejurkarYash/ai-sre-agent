import { sendSlackAlert } from "./slack";


export const notify = async (alertData: {
  serviceName: string;
  severity: string;
  errorMessage: string;
  rootCause: string;
  suggestedFix: string;
}) => {
  try {
    await sendSlackAlert(alertData);
    return { success: true };
  } catch (error: any) {
    console.error("Notification Error:", error.message);
    return { success: false, error: error.message };
  }
};