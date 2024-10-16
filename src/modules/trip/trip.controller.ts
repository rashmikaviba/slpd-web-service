import { Request, Response } from 'express';

import tripValidation from './trip.validation';

import BadRequestError from '../../error/BadRequestError';
import Trip from './trip.model';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';
import tripService from './trip.service';
import { WellKnownTripStatus } from '../../util/enums/well-known-trip-status.enum';
import tripUtil from './trip.util';
import commonUtil from '../../util/common.util';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import constants from '../../constant';
import userService from '../user/user.service';
import vehicleService from '../vehicle/vehicle.service';
import helperUtil from '../../util/helper.util';

const saveTrip = async (req: Request, res: Response) => {
    const body: any = req.body;
    const auth: any = req.auth;

    const { error } = tripValidation.tripSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        let passengers: any[] =
            body.passengers && body.passengers?.length > 0
                ? body.passengers
                : [];
        let activities: any[] =
            body.activities && body.activities?.length > 0
                ? body.activities
                : [];
        let arrivalInfo = body.arrivalInfo ?? null;
        let departureInfo = body.departureInfo ?? null;
        let pickUpInfo = body.pickUpInfo ?? null;
        let dropOffInfo = body.dropOffInfo ?? null;
        let places = body.places ?? [];
        let hotels = body.hotels ?? [];

        // create passengers and activities objects
        if (passengers.length > 0) {
            passengers.map((p: any) => delete p._id);
        }

        if (activities.length > 0) {
            activities.map((a: any) => delete a._id);
        }

        if (places.length > 0) {
            places.sort((a: any, b: any) => a.index - b.index);

            places.map((place: any, index: number) => {
                delete place._id;
                place.updatedBy = auth.id;
                place.index = index + 1;
            });
        }

        if (hotels.length > 0) {
            hotels.map((hotel: any) => {
                delete hotel._id;
            });
        }

        let tripConfirmedNumber = await tripService.generateTripId();
        let newTrip = new Trip({
            startDate: body.startDate,
            endDate: body.endDate,
            dateCount: body.dateCount,
            totalCost: body.totalCost,
            contactPerson: body.contactPerson,
            estimatedExpense: body.estimatedExpense,
            tripConfirmedNumber: tripConfirmedNumber,
            passengers: passengers,
            activities: activities,
            places: places,
            arrivalInfo: arrivalInfo,
            departureInfo: departureInfo,
            pickUpInfo: pickUpInfo,
            dropOffInfo: dropOffInfo,
            hotels: hotels,
            email: body.email,
            phoneNumber: body.phoneNumber,
            createdBy: auth.id,
            updatedBy: auth.id,
        });

        const savedTrip = await tripService.save(newTrip, null);

        CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Trip Created Successfully',
            savedTrip
        );
    } catch (error) {
        throw error;
    }
};

const updateTrip = async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body;
    const auth: any = req.auth;

    const { error } = tripValidation.tripSchema.validate(body, {
        allowUnknown: true,
    });

    if (error) {
        throw new BadRequestError(error.message);
    }

    let trip = await tripService.findByIdAndStatusIn(id, [
        WellKnownTripStatus.PENDING,
        WellKnownTripStatus.START,
        WellKnownTripStatus.FINISHED,
    ]);

    if (!trip) {
        throw new BadRequestError('Trip not found!');
    }

    try {
        let passengers =
            body.passengers && body.passengers?.length > 0
                ? body.passengers
                : [];
        let activities =
            body.activities && body.activities?.length > 0
                ? body.activities
                : [];
        let arrivalInfo = body.arrivalInfo ?? null;
        let departureInfo = body.departureInfo ?? null;
        let pickUpInfo = body.pickUpInfo ?? null;
        let dropOffInfo = body.dropOffInfo ?? null;
        let places = body.places ?? [];
        let hotels = body.hotels ?? [];

        // create passengers and activities objects
        if (passengers.length > 0) {
            passengers.map((p: any) => delete p._id);
        }

        if (activities.length > 0) {
            activities.map((a: any) => delete a._id);
        }

        if (hotels.length > 0) {
            hotels.map((hotel: any) => {
                delete hotel._id;
            });
        }

        if (places.length > 0) {
            let rearrangedPlaces: any[] = [];
            // sort places by index
            places.sort((a: any, b: any) => a.index - b.index);
            places.map((place: any, index: number) => {
                place.index = index + 1;
                place.updatedBy = auth.id;
            });

            let savedPlaces: any[] = [...trip.places];
            let placesFromBody: any[] = [...places];
            let placesFromBodyIds = placesFromBody.map((p: any) => p._id);

            let removedPlaces = savedPlaces.filter((p: any) => {
                return !placesFromBodyIds.includes(p._id.toString());
            });
            // remove removed places from saved places
            savedPlaces = savedPlaces.filter((p: any) =>
                placesFromBodyIds.includes(p._id.toString())
            );

            // check if try to deleted  isReached place
            if (removedPlaces.length > 0) {
                let isReachedPlace = removedPlaces.find((p: any) => {
                    return p.isReached;
                });

                if (isReachedPlace) {
                    throw new BadRequestError('Can not delete reached place!');
                }
            }

            places.forEach((place: any) => {
                let fromSavedPlaces = savedPlaces.find((p: any) => {
                    return p._id.toString() === place._id.toString();
                });

                if (fromSavedPlaces) {
                    rearrangedPlaces.push(fromSavedPlaces);
                } else {
                    delete place._id;
                    place.updatedBy = auth.id;
                    rearrangedPlaces.push(place);
                }
            });

            places = [...rearrangedPlaces];
        }

        trip.contactPerson = body.contactPerson;
        trip.startDate = body.startDate;
        trip.endDate = body.endDate;
        trip.dateCount = body.dateCount;
        trip.totalCost = body.totalCost;
        trip.estimatedExpense = body.estimatedExpense;
        trip.passengers = passengers;
        trip.activities = activities;
        trip.places = places;
        trip.hotels = hotels;
        trip.arrivalInfo = arrivalInfo;
        trip.departureInfo = departureInfo;
        trip.pickUpInfo = pickUpInfo;
        trip.dropOffInfo = dropOffInfo;
        trip.email = body.email;
        trip.phoneNumber = body.phoneNumber;
        trip.updatedBy = req.auth.id;

        const updatedTrip = await tripService.save(trip, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Trip Updated Successfully',
            updatedTrip
        );
    } catch (error) {
        throw error;
    }
};

const cancelTrip = async (req: Request, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;

    let trip = await tripService.findByIdAndStatusIn(id, [
        WellKnownTripStatus.PENDING,
        WellKnownTripStatus.START,
        WellKnownTripStatus.FINISHED,
    ]);

    if (!trip) {
        throw new BadRequestError('Trip not found!');
    }

    if (
        trip.status === WellKnownTripStatus.FINISHED ||
        trip.status === WellKnownTripStatus.START
    ) {
        throw new BadRequestError("Can't cancel started or finished trip!");
    }

    try {
        trip.status = WellKnownTripStatus.CANCELED;
        trip.updatedBy = auth.id;

        const updatedTrip = await tripService.save(trip, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Trip Canceled Successfully',
            updatedTrip
        );
    } catch (error) {
        throw error;
    }
};

const getTripById = async (req: Request, res: Response) => {
    const { id } = req.params;
    const trip = await tripService.findByIdAndStatusIn(id, [
        WellKnownTripStatus.PENDING,
        WellKnownTripStatus.START,
        WellKnownTripStatus.FINISHED,
    ]);

    if (!trip) {
        throw new BadRequestError('Trip not found!');
    }

    CommonResponse(res, true, StatusCodes.OK, '', trip);
};

const getAllTripsByRole = async (req: Request, res: Response) => {
    const auth = req.auth;
    let response: any = [];
    // admin, trip manager, super admin
    if (
        auth.role === constants.USER.ROLES.ADMIN ||
        auth.role === constants.USER.ROLES.TRIPMANAGER ||
        auth.role === constants.USER.ROLES.SUPERADMIN
    ) {
        const trips = await tripService.findAllByStatusIn([
            WellKnownTripStatus.PENDING,
            WellKnownTripStatus.START,
            WellKnownTripStatus.FINISHED,
        ]);

        response = tripUtil.tripModelArrToTripResponseDtoGetAlls(trips);
    } else if (auth.role === constants.USER.ROLES.DRIVER) {
        const trips: any = await tripService.findAllByDriverIdAndStatusIn(
            auth.id,
            [
                WellKnownTripStatus.PENDING,
                WellKnownTripStatus.START,
                WellKnownTripStatus.FINISHED,
            ]
        );

        trips.map((trip: any) => {
            if (trip.drivers[0].driver === auth.id) {
                trip.isActiveDriver = true;
            } else {
                trip.isActiveDriver = false;
            }
        });

        response = tripUtil.tripModelArrToTripResponseDtoGetAlls(trips);
    }

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const assignDriverAndVehicle = async (req: Request, res: Response) => {
    const { id } = req.params; // trip id
    const body = req.body;
    const auth = req.auth;

    const { error } = tripValidation.assignDriverVehicleSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        let trip: any = await tripService.findByIdAndStatusIn(id, [
            WellKnownTripStatus.PENDING,
            WellKnownTripStatus.START,
        ]);

        if (!trip) {
            throw new BadRequestError('Trip not found!');
        }

        if (body?.driverId) {
            let diver = await userService.findById(body?.driverId);

            if (!diver) {
                throw new BadRequestError('Driver not found!');
            }

            if (trip.status === WellKnownTripStatus.PENDING) {
                // if trip is pending remove all drivers and asign as new one as active
                let driver = {
                    driver: body?.driverId,
                    driverAssignedBy: auth.id,
                    isActive: true,
                };
                trip.drivers = [driver];
            } else {
                // if it is not deactive all other drivers and assign new one as active
                let isDriverAvailable = false;

                trip.drivers.map((driver: any) => {
                    if (driver.driver === body?.driverId) {
                        isDriverAvailable = true;
                        driver.isActive = true;
                        driver.driverAssignedBy = auth.id;
                    } else {
                        driver.isActive = false;
                    }
                });

                if (!isDriverAvailable) {
                    let driver = {
                        driver: body?.driverId,
                        driverAssignedBy: auth.id,
                        isActive: true,
                    };
                    trip.drivers.push(driver);
                }
            }
        }

        if (body?.vehicleId) {
            let vehicle = await vehicleService.findByIdAndStatusIn(
                body?.vehicleId,
                [WellKnownStatus.ACTIVE]
            );

            if (!vehicle) {
                throw new BadRequestError('Vehicle not found!');
            }

            // if trip is pending remove all vehicles and asign as new one as active
            if (trip?.status == WellKnownTripStatus.PENDING) {
                let vehicle = {
                    vehicle: body?.vehicleId,
                    isActive: true,
                    vehicleAssignedBy: auth.id,
                };

                trip.vehicles = [vehicle];
            } else {
                let isVehicleAvailable = false;

                trip.vehicles.map((vehicle: any) => {
                    if (vehicle.vehicle === body?.vehicleId) {
                        isVehicleAvailable = true;
                        vehicle.isActive = true;
                        vehicle.vehicleAssignedBy = auth.id;
                    } else {
                        vehicle.isActive = false;
                    }
                });

                if (!isVehicleAvailable) {
                    let vehicle = {
                        vehicle: body?.vehicleId,
                        isActive: true,
                        vehicleAssignedBy: auth.id,
                    };
                    trip.vehicles.push(vehicle);
                }
            }

            await tripService.save(trip, null);

            let message =
                body?.driverId && body?.vehicleId
                    ? 'Driver and vehicle assigned successfully!'
                    : body?.driverId
                    ? 'Driver assigned successfully!'
                    : 'Vehicle assigned successfully!';

            CommonResponse(res, true, StatusCodes.OK, message, null);
        }
    } catch (error) {
        throw error;
    }
};

const changeTripStatus = async (req: Request, res: Response) => {
    const tripId = req.params.id;
    const auth = req.auth;
    const status = req.params.status;

    try {
        if(!helperUtil.isValueInEnum(WellKnownTripStatus, status)){
            throw new BadRequestError("Invalid status!");
        }

        let trip:any = null;

        //Driver Can cahnge status to pending to start trip 
        if (
            auth.role === constants.USER.ROLES.DRIVER 
        ) {
            if(parseInt(status) != WellKnownTripStatus.START){
                trip = await tripService.findByIdAndStatusIn(tripId, [
                    WellKnownTripStatus.PENDING,
                ]);

                if (!trip) {
                    throw new BadRequestError('Trip not found or not in pending status!');
                }

                trip.status = parseInt(status);
                trip.startedBy = auth.id;
            } else{
                let statusName = helperUtil.getNameFromEnum(WellKnownTripStatus, status);
                throw new BadRequestError("You'r not allowed to change status to " + statusName + "!");
            }
        } 
        
        // admin, tpm,sa cn change status to finished
        if (
            auth.role === constants.USER.ROLES.ADMIN ||
            auth.role === constants.USER.ROLES.TRIPMANAGER ||
            auth.role === constants.USER.ROLES.SUPERADMIN
        ) {
            if(parseInt(status) != WellKnownTripStatus.FINISHED){
                trip = await tripService.findByIdAndStatusIn(tripId, [
                    WellKnownTripStatus.START,
                ]);

                if (!trip) {
                    throw new BadRequestError('Trip not found or not in start status!');
                }

                trip.status = parseInt(status);
                trip.endedBy = auth.id;
            } else{
                let statusName = helperUtil.getNameFromEnum(WellKnownTripStatus, status);
                throw new BadRequestError("You'r not allowed to change status to " + statusName + "!");
            }
        }
        
        await tripService.save(trip, null);

    } catch (error) {
        throw error;
    }

    let message = ""
    if(parseInt(status) != WellKnownTripStatus.START){
        message = "Trip staerted successfully!"
    }else if(parseInt(status) != WellKnownTripStatus.FINISHED){
        message = "Trip finished successfully!"
    }

    CommonResponse(res, true, StatusCodes.OK, message, null);
}

const saveCheckListAnswers = async (req: Request, res: Response) => {
    const { id } = req.params;
    const body = req.body;
    const auth = req.auth;

    const { error } = tripValidation.checkListAnswerSchema.validate(body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        let trip = await tripService.findByIdAndStatusIn(id, [
            WellKnownTripStatus.PENDING,
        ]);

        if (!trip) {
            throw new BadRequestError(
                'Invalid trip or trip is not in pending status!'
            );
        }

        trip.checkListAnswers = body;
        trip.checkListCheckBy = auth.id;

        await tripService.save(trip, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Answers saved successfully!',
            null
        );
    } catch (error) {
        throw error;
    }
};

const getCheckListAnswers = async (req: Request, res: Response) => {
    const { id } = req.params;

    const trip = await tripService.findByIdAndStatusIn(id, [
        WellKnownTripStatus.PENDING,
        WellKnownTripStatus.START,
        WellKnownTripStatus.FINISHED,
        WellKnownTripStatus.CANCELED,
    ]);

    if (!trip) {
        throw new BadRequestError('Invalid trip!');
    }

    if (trip.checkListAnswers == null) {
        throw new BadRequestError('Checklist not completed yet!');
    }

    CommonResponse(res, true, StatusCodes.OK, '', trip.checkListAnswers);
};
export {
    saveTrip,
    updateTrip,
    cancelTrip,
    getTripById,
    getAllTripsByRole,
    assignDriverAndVehicle,
    saveCheckListAnswers,
    getCheckListAnswers,
    changeTripStatus
};
