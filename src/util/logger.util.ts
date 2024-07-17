import { createLogger, format, transports } from 'winston';
const { combine, timestamp, printf, errors } = format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
});

// Create a logger instance
const logger = createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        errors({ stack: true }), // Capture stack trace
        logFormat
    ),
    transports: [
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' }),
    ],
});

// If not in production, log to the console as well
if (process.env.NODE_ENV !== 'production') {
    logger.add(
        new transports.Console({
            format: combine(timestamp(), logFormat),
        })
    );
}

export default logger;
