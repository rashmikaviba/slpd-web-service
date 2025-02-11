import { Request, Response } from 'express';
import internalTripValidation from './internalTrip.validation';
import BadRequestError from '../../error/BadRequestError';
import { startSession } from 'mongoose';
import InternalTrip from './internalTrip.model';
import vehicleService from '../vehicle/vehicle.service';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import internalTripService from './internalTrip.service';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';
import InternalTripResponseDto from './dto/internalTripResponseDto';
import internalTripUtil from './internalTrip.util';

const saveInternalTrip = async (req: Request, res: Response) => {
    const body: any = req.body;
    const auth: any = req.auth;

    const { error } = internalTripValidation.internalTripSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let vehicle = await vehicleService.findByIdAndStatusIn(body.vehicle, [
        WellKnownStatus.ACTIVE,
        WellKnownStatus.INACTIVE,
    ]);

    if (!vehicle) {
        throw new BadRequestError('Vehicle not found!');
    }

    if (vehicle.currentMileage >= body.meterReading) {
        throw new BadRequestError(
            'Vehicle current mileage is greater than meter reading!'
        );
    }

    const session = await startSession();
    try {
        //start transaction in session
        session.startTransaction();

        let internalTrip = new InternalTrip({
            startDate: body.startDate,
            endDate: body.endDate,
            dateCount: body.dateCount,
            vehicle: body.vehicle,
            meterReading: body.meterReading,
            reason: body.reason,
            driver: body.driver,
            createdBy: auth.id,
            updatedBy: auth.id,
        });

        // calculate distance
        let calcDistance = body.meterReading - vehicle.currentMileage;

        internalTrip.calcDistance = calcDistance;

        await internalTripService.save(internalTrip, session);

        // Update vehicle current mileage
        vehicle.currentMileage += calcDistance;

        await vehicleService.save(vehicle, session);

        //commit transaction in session
        await session.commitTransaction();

        CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Internal trip created successfully!',
            internalTrip
        );
    } catch (e) {
        //abort transaction
        await session.abortTransaction();
        throw e;
    } finally {
        //end session
        session.endSession();
    }
};

const updateInternalTrip = async (req: Request, res: Response) => {
    const body: any = req.body;
    const auth: any = req.auth;
    const internalTripId = req.params.id;

    const { error } = internalTripValidation.internalTripSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    let internalTrip = await internalTripService.findByIdAndStatusIn(
        internalTripId,
        [WellKnownStatus.ACTIVE]
    );

    if (!internalTrip) {
        throw new BadRequestError('Internal trip not found!');
    }

    const session = await startSession();
    try {
        //start transaction in session
        session.startTransaction();

        internalTrip.startDate = body.startDate;
        internalTrip.endDate = body.endDate;
        internalTrip.dateCount = body.dateCount;
        internalTrip.reason = body.reason;
        internalTrip.driver = body.driver;
        internalTrip.updatedBy = auth.id;

        await internalTripService.save(internalTrip, session);

        //commit transaction in session
        await session.commitTransaction();

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Internal trip Updated successfully!',
            internalTrip
        );
    } catch (e) {
        //abort transaction
        await session.abortTransaction();
        throw e;
    } finally {
        //end session
        session.endSession();
    }
};

const getInternalTripById = async (req: Request, res: Response) => {
    const internalTripId = req.params.id;

    const internalTrip = await internalTripService.findByIdAndStatusIn(
        internalTripId,
        [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]
    );

    CommonResponse(res, true, StatusCodes.OK, '', internalTrip);
};

const deleteInternalTripById = async (req: Request, res: Response) => {
    const auth: any = req.auth;
    const internalTripId = req.params.id;

    const internalTrip: any = await internalTripService.findByIdAndStatusIn(
        internalTripId,
        [WellKnownStatus.ACTIVE]
    );

    if (!internalTrip) {
        throw new BadRequestError('Internal trip not found!');
    }

    let vehicle = await vehicleService.findByIdAndStatusIn(
        internalTrip.vehicle,
        [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]
    );

    if (!vehicle) {
        throw new BadRequestError('Vehicle not found!');
    }

    const session = await startSession();
    try {
        //start transaction in session
        session.startTransaction();

        internalTrip.status = WellKnownStatus.DELETED;
        internalTrip.updatedBy = auth.id;

        await internalTripService.save(internalTrip, session);

        // Update vehicle current mileage
        vehicle.currentMileage -= internalTrip.calcDistance;

        await vehicleService.save(vehicle, session);

        //commit transaction in session
        await session.commitTransaction();

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Internal trip Deleted successfully!',
            internalTrip
        );
    } catch (e) {
        //abort transaction
        await session.abortTransaction();
        throw e;
    } finally {
        //end session
        session.endSession();
    }
};

const getInternalTripByVehicle = async (req: Request, res: Response) => {
    const vehicleId = req.params.id;

    let response: InternalTripResponseDto[] = [];

    let internalTrips: any[] = await internalTripService.findAllByVehicleId(
        vehicleId
    );

    if (internalTrips.length > 0) {
        response =
            internalTripUtil.modelsToInternalTripResponseDto(internalTrips);
    }

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

export {
    saveInternalTrip,
    getInternalTripById,
    updateInternalTrip,
    deleteInternalTripById,
    getInternalTripByVehicle,
};
