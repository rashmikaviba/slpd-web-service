import { Request, Response } from 'express';
import BadRequestError from '../../error/BadRequestError';
import expensesRequestValidation from './expensesRequest.validation';
import expensesRequestService from './expensesRequest.service';
import tripService from '../trip/trip.service';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
import { ExpensesRequest } from './expensesRequest.model';
import { StatusCodes } from 'http-status-codes';
import CommonResponse from '../../util/commonResponse';
import { startSession } from 'mongoose';
import ExpensesExtensionByIdResponseDto from './ExpensesExtensionByIdResponseDto';
import expensesRequestUtil from './expensesRequest.util';

const requestMoreExpenses = async (req: Request, res: Response) => {
    const body: any = req.body;
    const auth: any = req.auth;

    const { error } =
        expensesRequestValidation.saveExpenseRequestSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        // check if trip exists
        const trip = await tripService.findByIdAndStatusIn(body.tripId, [
            WellKnownTripStatus.START,
        ]);

        if (!trip) {
            throw new BadRequestError(
                'Invalid trip or trip is not in started status!'
            );
        }
        // check if trip has pending more expenses request
        const expensesRequests =
            await expensesRequestService.findByTripIdAndStatusIn(body.tripId, [
                WellKnownLeaveStatus.PENDING,
            ]);

        if (expensesRequests.length > 0) {
            throw new BadRequestError(
                'You already have a pending expense extension request for this trip. If you need immediate assistance, please contact the administrator!'
            );
        }

        // if it is false then create new expenses request
        let newExpenseRequest = new ExpensesRequest();

        newExpenseRequest.tripId = body.tripId;
        newExpenseRequest.requestedAmount = body.requestedAmount;
        newExpenseRequest.description = body.description;
        newExpenseRequest.createdBy = auth._id;
        newExpenseRequest.updatedBy = auth._id;

        await expensesRequestService.save(newExpenseRequest, null);

        CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Expense extension request saved successfully!',
            null
        );
    } catch (error) {
        throw error;
    }
};

const approveExpensesRequest = async (req: Request, res: Response) => {
    const body: any = req.body;
    const auth: any = req.auth;
    const expenseReqId: string = req.params.id;

    const { error } =
        expensesRequestValidation.approveExpenseRequestSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    const session = await startSession();

    try {
        session.startTransaction();

        // check if expense request exists
        let expenseRequest: any =
            await expensesRequestService.findByIdAndStatusIn(expenseReqId, []);

        if (!expenseRequest) {
            throw new BadRequestError(
                'No expense extension requests were found.!'
            );
        }

        if (expenseRequest.status == WellKnownLeaveStatus.APPROVED) {
            throw new BadRequestError(
                'Expense extension request already approved!'
            );
        } else if (expenseRequest.status == WellKnownLeaveStatus.REJECTED) {
            throw new BadRequestError(
                'Expense extension request already rejected!'
            );
        }

        // check if trip exists
        let trip: any = await tripService.findByIdAndStatusIn(
            expenseRequest?.tripId.toString(),
            [WellKnownTripStatus.START]
        );

        if (!trip) {
            throw new BadRequestError(
                'Invalid trip or trip is not in started status!'
            );
        }

        // updated expense request
        expenseRequest.approvedAmount = body.approvedAmount;
        expenseRequest.status = WellKnownLeaveStatus.APPROVED;
        expenseRequest.updatedBy = auth._id;

        await expensesRequestService.save(expenseRequest, session);

        // update trip total expenses
        trip.estimatedExpense += body.approvedAmount;
        trip.updatedBy = auth._id;

        await tripService.save(trip, session);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Expense extension request approved successfully!',
            null
        );
        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        session.endSession();
    }
};

const rejectExpensesRequest = async (req: Request, res: Response) => {
    const body: any = req.body;
    const auth: any = req.auth;
    const expenseReqId: string = req.params.id;

    const { error } =
        expensesRequestValidation.rejectExpenseRequestSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        // check if expense request exists
        let expenseRequest: any =
            await expensesRequestService.findByIdAndStatusIn(expenseReqId, []);

        if (!expenseRequest) {
            throw new BadRequestError(
                'No expense extension requests were found.!'
            );
        }

        if (expenseRequest.status == WellKnownLeaveStatus.APPROVED) {
            throw new BadRequestError(
                'Expense extension request already approved!'
            );
        } else if (expenseRequest.status == WellKnownLeaveStatus.REJECTED) {
            throw new BadRequestError(
                'Expense extension request already rejected!'
            );
        }

        expenseRequest.status = WellKnownLeaveStatus.REJECTED;
        expenseRequest.updatedBy = auth._id;
        expenseRequest.rejectRemark = body.rejectRemark;

        await expensesRequestService.save(expenseRequest, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Expense extension request rejected successfully!',
            null
        );
    } catch (error) {
        throw error;
    }
};

const getExpenseExtension = async (req: Request, res: Response) => {
    const expenseReqId: string = req.params.id;

    try {
        // check if expense request exists
        let expenseRequest: any =
            await expensesRequestService.findByIdAndStatusIn(expenseReqId, []);

        if (!expenseRequest) {
            throw new BadRequestError(
                'No expense extension requests were found.!'
            );
        }

        const response: ExpensesExtensionByIdResponseDto =
            expensesRequestUtil.modelToExpensesExtensionByIdResponseDto(
                expenseRequest
            );

        CommonResponse(res, true, StatusCodes.OK, '', response);
    } catch (error) {
        throw error;
    }
};

export {
    requestMoreExpenses,
    approveExpensesRequest,
    rejectExpensesRequest,
    getExpenseExtension,
};
