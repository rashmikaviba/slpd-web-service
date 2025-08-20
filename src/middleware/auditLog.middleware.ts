import { Request, Response, NextFunction } from "express";
import helperUtil from "../util/helper.util";

declare global {
    namespace Express {
        interface Request {
            auth?: any;
            correlationId: string;
        }
    }
}
export const accessLogMiddleware = (req: Request, res: Response, next: NextFunction) => {
    req.correlationId = req.headers['x-correlation-id'] as string || '';

    if (!req.correlationId) {
        req.correlationId = Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join("");
    }

    const log = {
        correlationId: req.correlationId,
        method: req.method,
        path: req.originalUrl,
        origin: req.headers.origin || '',
    }

    helperUtil.consoleLogMessage("info", "Access Log", log);

    next();
};


export const responseLogMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;

    (res as any).send = function (body: any) {
        const responseTime = Date.now() - startTime;

        const log = {
            correlationId: req.correlationId,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            time: `${responseTime} ms`,
        }

        helperUtil.consoleLogMessage("info", "Response Log", log);
        return originalSend.call(this, body);
    };
    next();
};