import { WellKnownStatus } from './../../util/enums/well-known-status.enum';
import { Request, Response } from 'express';
import { startSession } from 'mongoose';
import { StatusCodes } from 'http-status-codes';

import CommonResponse from '../../util/commonResponse';

import leaveService from '../leave/leave.service';
import vehicleService from './vehicle.service';
import Vehicle from './vehicle.model';
import constants from '../../constant';

import BadRequestError from '../../error/BadRequestError';
import VehicleResponseDto from './dto/vehicleResponseDto';
import vehicleUtil from './vehicle.util';
import vehicleValidation from './vehicle.validation';

// Save vehicle
const saveVehicle = async (req: Request, res: Response) => {
    const auth = req.auth;
    const {
        vehicleType,
        registrationNumber,
        gpsTracker,
        capacity,
        availableSeats,
        description,
        vehicleOwner,
    } = req.body;

    // Validate request body
    const { error } = vehicleValidation.vehicleSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    const isVehicleExist =
        await vehicleService.findByRegistrationNumAndStatusIn(
            registrationNumber.toUpperCase(),
            [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]
        );

    if (isVehicleExist) {
        throw new BadRequestError(
            'Vehicle already exists with this registration number!'
        );
    }

    const isGpsTrackerExist = await vehicleService.findByGpsTrackerAndStatusIn(
        gpsTracker,
        [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]
    );

    if (isGpsTrackerExist) {
        throw new BadRequestError(
            'Vehicle already exists with this GPS Tracker!'
        );
    }

    try {
        const vehicle = new Vehicle({
            vehicleType,
            registrationNumber: registrationNumber.toUpperCase(),
            gpsTracker,
            capacity,
            availableSeats,
            description,
            status: WellKnownStatus.ACTIVE,
            createdBy: auth.id,
            updatedBy: auth.id,
            vehicleOwner,
        });

        let ceratedVehicle = await vehicleService.save(vehicle, null);
        CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Vehicle created successfully!',
            ceratedVehicle
        );
    } catch (error) {
        throw error;
    }
};

// Update vehicle
const updateVehicle = async (req: Request, res: Response) => {
    const auth = req.auth;
    const { id } = req.params;
    const {
        vehicleType,
        registrationNumber,
        gpsTracker,
        capacity,
        availableSeats,
        description,
        vehicleOwner,
    } = req.body;

    // Validate request body
    const { error } = vehicleValidation.vehicleSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    const vehicle = await vehicleService.findByIdAndStatusIn(id, [
        WellKnownStatus.ACTIVE,
        WellKnownStatus.INACTIVE,
    ]);

    if (!vehicle) {
        throw new BadRequestError('Vehicle not found!');
    }

    const isVehicleExist = await vehicleService.findByRegNumAndStatusInAndIdNot(
        id,
        registrationNumber.toUpperCase(),
        [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]
    );

    if (isVehicleExist) {
        throw new BadRequestError(
            'Vehicle already exists with this registration number!'
        );
    }

    const isGpsTrackerExist =
        await vehicleService.findByIdNotAndGpsTrackerAndStatusIn(
            id,
            gpsTracker,
            [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]
        );

    if (isGpsTrackerExist) {
        throw new BadRequestError(
            'Vehicle already exists with this GPS Tracker!'
        );
    }
    try {
        vehicle.vehicleType = vehicleType;
        vehicle.registrationNumber = registrationNumber.toUpperCase();
        vehicle.gpsTracker = gpsTracker;
        vehicle.capacity = capacity;
        vehicle.availableSeats = availableSeats;
        vehicle.description = description;
        vehicle.updatedBy = auth.id;
        vehicle.vehicleOwner = vehicleOwner;

        let updatedVehicle = await vehicleService.save(vehicle, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Vehicle updated successfully!',
            updatedVehicle
        );
    } catch (error) {
        throw error;
    }
};

// Get by id
const getVehicleById = async (req: Request, res: Response) => {
    const { id } = req.params;

    const vehicle = await vehicleService.findByIdAndStatusIn(id, [
        WellKnownStatus.ACTIVE,
        WellKnownStatus.INACTIVE,
    ]);

    let response: any = null;

    if (!vehicle) {
        throw new BadRequestError('Vehicle not found!');
    } else {
        response = vehicleUtil.vehicleModelToVehicleResponseDto(vehicle);
    }

    if (vehicle) CommonResponse(res, true, StatusCodes.OK, '', response);
};

// Get all
const getAllVehicles = async (req: Request, res: Response) => {
    const withInactive = req.query.withInactive ? true : false;
    let response: any[] = [];
    let vehicles: any[] = [];
    if (withInactive) {
        vehicles = await vehicleService.findAllAndStatusIn([
            WellKnownStatus.ACTIVE,
            WellKnownStatus.INACTIVE,
        ]);
    } else {
        vehicles = await vehicleService.findAllAndStatusIn([
            WellKnownStatus.ACTIVE,
        ]);
    }

    if (vehicles.length > 0) {
        response = vehicleUtil.vehicleModelArrToVehicleResponseDtos(vehicles);
    }

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

// delete by id
const deleteVehicleById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;

    const vehicle = await vehicleService.findByIdAndStatusIn(id, [
        WellKnownStatus.ACTIVE,
        WellKnownStatus.INACTIVE,
    ]);

    if (!vehicle) {
        throw new BadRequestError('Vehicle not found!');
    }

    try {
        vehicle.status = WellKnownStatus.DELETED;
        vehicle.updatedBy = auth.id;
        await vehicleService.save(vehicle, null);

        return CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Vehicle deleted successfully!',
            updateVehicle
        );
    } catch (error) {
        throw error;
    }
};

// activeInactiveVehicles
const activeInactiveVehicle = async (req: Request, res: Response) => {
    const { id } = req.params;
    const status = req.query.status as any;
    const auth = req.auth;

    if (
        status != WellKnownStatus.ACTIVE &&
        status != WellKnownStatus.INACTIVE
    ) {
        throw new BadRequestError('Invalid status value!');
    }

    const vehicle = await vehicleService.findByIdAndStatusIn(id, [
        WellKnownStatus.ACTIVE,
        WellKnownStatus.INACTIVE,
    ]);

    if (!vehicle) {
        throw new BadRequestError('Vehicle not found!');
    }

    let messageString = '';
    if (status == WellKnownStatus.ACTIVE) {
        messageString = 'Vehicle activated successfully!';
    } else {
        messageString = 'Vehicle inactivated successfully!';
    }

    try {
        vehicle.status =
            status == 1 ? WellKnownStatus.ACTIVE : WellKnownStatus.INACTIVE;
        vehicle.updatedBy = auth.id;
        await vehicleService.save(vehicle, null);

        return CommonResponse(
            res,
            true,
            StatusCodes.OK,
            messageString,
            updateVehicle
        );
    } catch (error) {
        throw error;
    }
};

const getVehiclesByPassengersCount = async (req: Request, res: Response) => {
    const count = req.params.count || '0';

    const vehicles = await vehicleService.findVehiclesBySheetCount(+count);

    CommonResponse(res, true, StatusCodes.OK, '', vehicles);
};

export {
    saveVehicle,
    updateVehicle,
    getVehicleById,
    getAllVehicles,
    deleteVehicleById,
    activeInactiveVehicle,
    getVehiclesByPassengersCount,
};
