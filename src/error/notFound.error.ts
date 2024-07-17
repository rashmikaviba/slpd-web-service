import CommonError from './common.error';
import { StatusCodes } from 'http-status-codes';

class NotFoundError extends CommonError {
    statusCode: StatusCodes;
    constructor(message: string) {
        super(message);
        this.statusCode = StatusCodes.NOT_FOUND;
    }
}

export default NotFoundError;
