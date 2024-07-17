import { StatusCodes } from 'http-status-codes'
import CommonError from './common.error'

class ForbiddenError extends CommonError {
    statusCode: StatusCodes
    constructor(message: string) {
        super(message)
        this.statusCode = StatusCodes.FORBIDDEN
    }
}

export default ForbiddenError
