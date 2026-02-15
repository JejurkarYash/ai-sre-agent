import e from "express";
import { detectError } from "./tools/detectError";
import { getRenderLogs } from "./tools/getRenderLogs";
import { suggestFix } from "./tools/suggestFix";


const run = async () => {      
const logs = await getRenderLogs();
console.log("Logs:");


const error = await detectError(logs as string);
console.log("Detected Error:");

const errorDetails = await suggestFix({errorDetails:error as {errorFound:boolean, errors:{errorMessage:string, rootCause:string, errorType:string, needsRestart:boolean, needsRedeploy:boolean}[]}});
console.log("Suggested Fixes:", errorDetails);

}; 

run()