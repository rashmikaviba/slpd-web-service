import { StatusCodes } from 'http-status-codes';
import InternalServerError from '../error/InternalServerError';
import { NextFunction, Request, Response } from 'express';
import CommonResponse from '../util/commonResponse';
import logger from '../util/logger.util';

const errorHandlerMiddleware = async (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    logger.error(err.stack || err.message);
    let customError: any = {
        statusCode: err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR,
        message: err.message || 'Something went wrong!',
        data: {},
    };

    if (
        err instanceof InternalServerError ||
        customError.statusCode === StatusCodes.INTERNAL_SERVER_ERROR
    ) {
        customError.message = 'Something went wrong!';
    }

    if (err.name === 'ValidationError') {
        customError.statusCode = StatusCodes.BAD_REQUEST;
        customError.message = err.errors[0];
    }

    if (err.code && err.code === 11000) {
        customError.message = `${Object.keys(
            err.keyValue
        )} already exists! Please choose another value.`;

        customError.statusCode = StatusCodes.CONFLICT;
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
