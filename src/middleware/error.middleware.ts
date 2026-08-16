import { StatusCodes } from 'http-status-codes';
import InternalServerError from '../error/InternalServerError';
import { NextFunction, Request, Response } from 'express';
import CommonResponse from '../util/commonResponse';
import helperUtil from '../util/helper.util';
import { envConfig } from '../config/environment.config';

const UPLOAD_MAX_FILE_SIZE_MB = envConfig.UPLOAD_MAX_FILE_SIZE_MB || 10;
const UPLOAD_MAX_FILE_COUNT = envConfig.UPLOAD_MAX_FILE_COUNT || 10;

const errorHandlerMiddleware = async (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    let customError: any = {
        statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
        message: err.message || 'Something went wrong!',
        data: {},
    };

    if (
        (err instanceof InternalServerError ||
            customError.statusCode === StatusCodes.INTERNAL_SERVER_ERROR) &&
        err.name != 'ValidationError'
    ) {

        const log = {
            correlationId: req.correlationId || '',
            method: req.method,
            path: req.originalUrl,
            status: customError.statusCode,
            error: err.stack || err.message
        }

        helperUtil.consoleLogMessage("error", "Internal Server Error", log);
    }

    if (err.name === 'ValidationError') {
        let validatorArr: any[] = [];

        Object.values(err.errors).forEach((error: any) => {
            validatorArr.push(error.message);
        });

        customError.statusCode = StatusCodes.BAD_REQUEST;
        customError.message = validatorArr[0];
    }

    if (err.code && err.code === 11000) {
        customError.message = `${Object.keys(
            err.keyValue
        )} already exists! Please choose another value.`;

        customError.statusCode = StatusCodes.CONFLICT;
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        customError.statusCode = 413;
        customError.message = `Uploaded file is too large. Maximum file size is ${UPLOAD_MAX_FILE_SIZE_MB}MB.`;
    }

    if (err.code === 'LIMIT_FILE_COUNT') {
        customError.statusCode = StatusCodes.BAD_REQUEST;
        customError.message = `Too many files uploaded. Maximum files allowed is ${UPLOAD_MAX_FILE_COUNT}`;
    }

    // handle mongo db cast errors
    if (err.name === 'CastError') {
        customError.message = `No item found with ID "${err.value}"!`;
        customError.statusCode = StatusCodes.NOT_FOUND;
    }

    return CommonResponse(
        res,
        false,
        customError.statusCode,
        customError.message,
        null
    );
};

export default errorHandlerMiddleware;
