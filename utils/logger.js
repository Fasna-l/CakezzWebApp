import winston from "winston";
import path from "path";
import fs from "fs";

const logDir = "logs";

// Create logs folder if it doesn't exist
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: "info",

  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack }) => {
      return stack
        ? `${timestamp} [${level.toUpperCase()}]: ${stack}`
        : `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
  ),

  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(logDir, "app.log")
    })
  ]
});

export const authLogger = winston.createLogger({
  level: "info",
  format: logger.format,
  transports: [
    new winston.transports.File({
      filename: path.join(logDir, "auth.log")
    })
  ]
});

export default logger;