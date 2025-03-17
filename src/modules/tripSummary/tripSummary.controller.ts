import { Request, Response } from 'express';
import tripService from '../trip/trip.service';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import BadRequestError from '../../error/BadRequestError';
import constants from '../../constant';
import TripSummary from './tripSummary.model';
import tripSummaryService from './tripSummary.service';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';
import tripSummaryValidation from './tripSummary.validation';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import { TripResponseDtoGetAll } from '../trip/dto/tripResponseDtos';
import tripUtil from '../trip/trip.util';
import TripSummaryResponseDto from './dto/tripSummaryResponseDto';
import tripSummaryUtil from './tripSummary.util';

const saveTripSummary = async (req: Request, res: Response) => {
    const body: any = req.body;
    const auth: any = req.auth;

    const { error } = tripSummaryValidation.tripSummarySchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        const trip = await tripService.findByIdAndStatusIn(body.tripId, [
            WellKnownTripStatus.START,
            WellKnownTripStatus.FINISHED,
        ]);

        if (!trip) {
            throw new BadRequestError('No trip found!');
        }

        if (
            auth.role === constants.USER.ROLES.DRIVER &&
            trip.status != WellKnownTripStatus.START
        ) {
            throw new BadRequestError(
                'You can not save trip summary, because trip is already finished!'
            );
        } else if (trip.isMonthEndDone) {
            throw new BadRequestError(
                'You can not save trip summary, because month end is already done!'
            );
        }

        let tripSummary = new TripSummary();
        tripSummary.tripId = body.tripId;
        tripSummary.date = body.date;
        tripSummary.startingTime = body.startTime;
        tripSummary.endingTime = body.endTime;
        tripSummary.startingKm = body.startingKm;
        tripSummary.endingKm = body.endingKm;
        tripSummary.totalKm = body.totalKm;
        tripSummary.fuel = body.fuel;
        tripSummary.description = body.description;
        tripSummary.createdBy = auth.id;
        tripSummary.updatedBy = auth.id;

        tripSummary = await tripSummaryService.save(tripSummary, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Trip summary saved successfully!',
            tripSummary
        );
    } catch (error) {
        throw error;
    }
};
const updateTripSummary = async (req: Request, res: Response) => {
    const TripSummaryId = req.params.id;
    const body = req.body;
    const auth = req.auth;

    const { error } = tripSummaryValidation.tripSummarySchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        let tripSummary: any =
            await tripSummaryService.getTripSummaryByIdAndStatusIn(
                TripSummaryId,
                [WellKnownStatus.ACTIVE]
            );

        if (!tripSummary) {
            throw new BadRequestError('No trip summary found!');
        }

        let trip: any = tripSummary.tripId;
        if (
            auth.role === constants.USER.ROLES.DRIVER &&
            trip.status != WellKnownTripStatus.START
        ) {
            throw new BadRequestError(
                'You can not update trip summary, because trip is already finished!'
            );
        } else if (trip.isMonthEndDone) {
            throw new BadRequestError(
                'You can not update trip summary, because month end is already done!'
            );
        }

        tripSummary.date = body.date;
        tripSummary.startingTime = body.startTime;
        tripSummary.endingTime = body.endTime;
        tripSummary.startingKm = body.startingKm;
        tripSummary.endingKm = body.endingKm;
        tripSummary.totalKm = body.totalKm;
        tripSummary.fuel = body.fuel;
        tripSummary.description = body.description;
        tripSummary.updatedBy = auth.id;

        tripSummary = await tripSummaryService.save(tripSummary, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Trip summary updated successfully!',
            tripSummary
        );
    } catch (error) {
        throw error;
    }
};

const getAllSummaryByTrip = async (req: Request, res: Response) => {
    const tripId = req.params.tripId;

    try {
        let trip = await tripService.findByIdAndStatusIn(tripId, [
            WellKnownTripStatus.START,
            WellKnownTripStatus.FINISHED,
        ]);

        if (!trip) {
            throw new BadRequestError('No trip found!');
        }

        let tripResponse: TripResponseDtoGetAll =
            tripUtil.tripModelToTripResponseDtoGetAll(trip);

        let tripSummaries: any =
            await tripSummaryService.findAllTripSummaryByTripIdAndStatusIn(
                tripId,
                [WellKnownStatus.ACTIVE]
            );

        let tripSummaryResponseDtos: TripSummaryResponseDto[] = [];
        if (tripSummaries.length > 0) {
            tripSummaryResponseDtos =
                tripSummaryUtil.modelsToTripSummaryResponseDtos(tripSummaries);
        }

        let response = {
            trip: tripResponse,
            tripSummaries: tripSummaryResponseDtos,
        };

        CommonResponse(res, true, StatusCodes.OK, '', response);
    } catch (error) {
        throw error;
    }
};

const getTrpSummaryById = async (req: Request, res: Response) => {
    const TripSummaryId = req.params.id;

    try {
        let tripSummary: any =
            await tripSummaryService.getTripSummaryByIdAndStatusIn(
                TripSummaryId,
                [WellKnownStatus.ACTIVE]
            );

        if (tripSummary) {
            let trip: any = tripSummary.tripId;

            delete tripSummary.tripId;
            tripSummary.tripId = trip._id;
        }

        CommonResponse(res, true, StatusCodes.OK, '', tripSummary);
    } catch (error) {
        throw error;
    }
};

const deleteTripSummary = async (req: Request, res: Response) => {
    const TripSummaryId = req.params.id;
    const auth = req.auth;

    try {
        let tripSummary: any =
            await tripSummaryService.getTripSummaryByIdAndStatusIn(
                TripSummaryId,
                [WellKnownStatus.ACTIVE]
            );

        if (!tripSummary) {
            throw new BadRequestError('No trip summary found!');
        }

        let trip: any = tripSummary.tripId;
        if (
            trip.status != WellKnownTripStatus.START &&
            auth.role === constants.USER.ROLES.DRIVER
        ) {
            throw new BadRequestError(
                'You can not delete trip summary, because trip is already finished!'
            );
        } else if (trip.isMonthEndDone) {
            throw new BadRequestError(
                'You can not delete trip summary, because month end is already done!'
            );
        }

        tripSummary.status = WellKnownStatus.DELETED;

        tripSummary = await tripSummaryService.save(tripSummary, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Trip summary deleted successfully!',
            tripSummary
        );
    } catch (error) {
        throw error;
    }
};

export {
    saveTripSummary,
    getAllSummaryByTrip,
    getTrpSummaryById,
    updateTripSummary,
    deleteTripSummary,
};
