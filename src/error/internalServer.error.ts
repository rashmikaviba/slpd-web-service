import CommonError from './common.error';
import { StatusCodes } from 'http-status-codes';

class InternalServerError extends CommonError {
    statusCode: StatusCodes;
    constructor(message: string) {
        super(message);
        this.statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    }
}

export default InternalServerError;
