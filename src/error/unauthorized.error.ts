import CommonError from './common.error'
import { StatusCodes } from 'http-status-codes'

class UnauthorizedError extends CommonError {
    statusCode: StatusCodes
    constructor(message: string) {
        super(message)
        this.statusCode = StatusCodes.UNAUTHORIZED
    }
}

export default UnauthorizedError
