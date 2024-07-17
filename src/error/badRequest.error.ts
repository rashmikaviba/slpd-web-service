import { StatusCodes } from 'http-status-codes'
import CommonError from './common.error'

class BadRequestError extends CommonError {
    statusCode: StatusCodes
    constructor(message: string) {
        super(message)
        this.statusCode = StatusCodes.BAD_REQUEST
    }
}

export default BadRequestError
