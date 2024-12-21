import { Request, Response } from 'express';
import BadRequestError from '../../error/BadRequestError';
import expensesRequestValidation from './expenseRequest.validation';
import expensesRequestService from './expenseRequest.service';
import tripService from '../trip/trip.service';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import { WellKnownLeaveStatus } from '../../util/enums/well-known-leave-status.enum';
import { ExpenseRequest } from './expenseRequest.model';
import { StatusCodes } from 'http-status-codes';
import CommonResponse from '../../util/commonResponse';
import { startSession } from 'mongoose';
import expensesRequestUtil from './expenseRequest.util';
import ExpenseRequestByIdResponseDto from './dto/ExpenseRequestByIdResponseDto';

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
                'You already have a pending expense request for this trip. If you need immediate assistance, please contact the administrator!'
            );
        }

        // if it is false then create new expenses request
        let newExpenseRequest = new ExpenseRequest();

        newExpenseRequest.tripId = body.tripId;
        newExpenseRequest.requestedAmount = body.requestedAmount;
        newExpenseRequest.description = body.description;
        newExpenseRequest.createdBy = auth.id;
        newExpenseRequest.updatedBy = auth.id;

        await expensesRequestService.save(newExpenseRequest, null);

        CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Expense request saved successfully!',
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
            await expensesRequestService.findByIdAndStatusIn(expenseReqId, [
                WellKnownLeaveStatus.PENDING,
                WellKnownLeaveStatus.APPROVED,
                WellKnownLeaveStatus.REJECTED,
            ]);

        if (!expenseRequest) {
            throw new BadRequestError('No expense requests were not found.!');
        }

        if (expenseRequest.status == WellKnownLeaveStatus.APPROVED) {
            throw new BadRequestError('Expense request already approved!');
        } else if (expenseRequest.status == WellKnownLeaveStatus.REJECTED) {
            throw new BadRequestError('Expense request already rejected!');
        }

        // check if trip exists
        let trip: any = await tripService.findByIdAndStatusIn(
            expenseRequest?.tripId?._id.toString(),
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
        expenseRequest.updatedBy = auth.id;

        await expensesRequestService.save(expenseRequest, session);

        // update trip total expenses
        trip.estimatedExpense += body.approvedAmount;
        trip.updatedBy = auth.id;

        await tripService.save(trip, session);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Expense request approved successfully!',
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
            await expensesRequestService.findByIdAndStatusIn(expenseReqId, [
                WellKnownLeaveStatus.PENDING,
                WellKnownLeaveStatus.APPROVED,
                WellKnownLeaveStatus.REJECTED,
            ]);

        if (!expenseRequest) {
            throw new BadRequestError('No expense requests were found.!');
        }

        if (expenseRequest.status == WellKnownLeaveStatus.APPROVED) {
            throw new BadRequestError('Expense request already approved!');
        } else if (expenseRequest.status == WellKnownLeaveStatus.REJECTED) {
            throw new BadRequestError('Expense request already rejected!');
        }

        expenseRequest.status = WellKnownLeaveStatus.REJECTED;
        expenseRequest.updatedBy = auth.id;
        expenseRequest.rejectRemark = body.rejectRemark;

        await expensesRequestService.save(expenseRequest, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Expense request rejected successfully!',
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
            await expensesRequestService.findByIdAndStatusIn(expenseReqId, [
                WellKnownLeaveStatus.PENDING,
                WellKnownLeaveStatus.APPROVED,
                WellKnownLeaveStatus.REJECTED,
            ]);

        if (!expenseRequest) {
            throw new BadRequestError('No expense requests were found.!');
        }

        const response: ExpenseRequestByIdResponseDto =
            expensesRequestUtil.modelToExpensesRequestByIdResponseDto(
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
