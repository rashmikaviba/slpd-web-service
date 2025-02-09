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
import Expenses from '../expenses/expenses.model';
import expensesService from '../expenses/expenses.service';
import { startSession } from 'mongoose';
import { number } from 'joi';
import TripExpensesResponseDto from '../expenses/dto/tripExpensesResponseDto';
import expensesUtil from '../expenses/expenses.util';

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
            specialRequirement: body.specialRequirement,
            paymentMode: body.paymentMode,
            totalCostLocalCurrency: body.totalCostLocalCurrency,
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
            let isReachedPlaces = places.filter((p: any) => {
                return p.isReached;
            });
            let rearrangedPlaces: any[] = [];
            // sort places by index
            places.sort((a: any, b: any) => a.index - b.index);
            places.map((place: any, index: number) => {
                place.index = index + 1;
                place.updatedBy = auth.id;
            });

            // check if try to change isReached place index
            // if (isReachedPlaces.length > 0) {
            //     let isReachedPlaceValid = true;

            //     isReachedPlaces.forEach((p: any) => {
            //         let sleetedPlace = places.find((place: any) => {
            //             return place._id.toString() === p._id.toString();
            //         });

            //         if (sleetedPlace.index !== p.index) {
            //             isReachedPlaceValid = false;
            //         }
            //     });

            //     if (!isReachedPlaceValid) {
            //         throw new BadRequestError(
            //             'Can not change reached place Order!'
            //         );
            //     }
            // }

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
        trip.specialRequirement = body.specialRequirement;
        trip.paymentMode = body.paymentMode;
        trip.totalCostLocalCurrency = body.totalCostLocalCurrency;
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

        await Promise.all(
            trips.map(async (trip: any) => {
                trip.isDriverSalaryDone = false;
                if (
                    trip.status === WellKnownTripStatus.START ||
                    trip.status === WellKnownTripStatus.FINISHED
                ) {
                    const expense =
                        await expensesService.findByTripIdAndStatusIn(
                            trip._id.toString(),
                            [WellKnownStatus.ACTIVE]
                        );
                    if (expense) {
                        trip.isDriverSalaryDone =
                            expense.toObject()?.driverSalary != null; //  expense.toObject()?.driverSalary != null;
                    }
                }
            })
        );
        sortTrips(trips);
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
            if (
                trip.drivers
                    .find((x: any) => x.isActive)
                    ?.driver?._id.toString() === auth.id
            ) {
                trip.isActiveDriver = true;
            } else {
                trip.isActiveDriver = false;
            }
        });
        sortTrips(trips);
        response = tripUtil.tripModelArrToTripResponseDtoGetAlls(trips);
    }

    CommonResponse(res, true, StatusCodes.OK, '', response);
};

const sortTrips = (trips: any[]) => {
    const priorityMap: any = {
        [WellKnownTripStatus.START]: 1,
        [WellKnownTripStatus.PENDING]: 2,
        [WellKnownTripStatus.FINISHED]: 3,
    };

    // Sort based on the priority map
    trips.sort((a: any, b: any) => {
        return priorityMap[a.status] - priorityMap[b.status];
    });
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
                let activeDriver = trip.drivers.find((driver: any) => {
                    return driver.isActive === true;
                });

                if (activeDriver.driver.toString() !== body?.driverId) {
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
                let activeVehicle = trip.vehicles.find((vehicle: any) => {
                    return vehicle.isActive === true;
                });

                if (activeVehicle.vehicle.toString() !== body?.vehicleId) {
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
    } catch (error) {
        throw error;
    }
};

const changeTripStatus = async (req: Request, res: Response) => {
    const tripId = req.params.id;
    const auth = req.auth;
    const status = parseInt(req.params.status);

    const session = await startSession();

    try {
        session.startTransaction();

        if (!helperUtil.isValueInEnum(WellKnownTripStatus, status)) {
            throw new BadRequestError('Invalid status!');
        }

        let trip: any = null;

        //Driver Can cahnge status to pending to start trip
        if (auth.role === constants.USER.ROLES.DRIVER) {
            if (status == WellKnownTripStatus.START) {
                trip = await tripService.findByIdAndStatusIn(tripId, [
                    WellKnownTripStatus.PENDING,
                ]);

                if (!trip) {
                    throw new BadRequestError(
                        'Trip not found or not in pending status!'
                    );
                }

                trip.status = status;
                trip.startedBy = auth.id;

                // Create expenses
                let expenses = new Expenses({
                    tripId: tripId,
                    createdBy: auth.id,
                    updatedBy: auth.id,
                    expenses: [],
                    driverSalary: null,
                });

                await expensesService.save(expenses, session);
            } else if (status == WellKnownTripStatus.PENDING) {
                trip = await tripService.findByIdAndStatusIn(tripId, [
                    WellKnownTripStatus.START,
                ]);

                if (!trip) {
                    throw new BadRequestError(
                        'Trip not found or not in start status!'
                    );
                }

                let isPlaceReached = trip?.places.find(
                    (place: any) => place.isReached == true
                );

                if (isPlaceReached) {
                    throw new BadRequestError(
                        "Can't change status to pending after reached at least one place!"
                    );
                }

                trip.status = status;
                trip.startedBy = null;
                trip.updatedBy = auth.id;

                // delete expenses
                await expensesService.findAndHardDeleteByTripId(
                    tripId,
                    session
                );
            } else {
                let statusName = helperUtil.getNameFromEnum(
                    WellKnownTripStatus,
                    status
                );
                throw new BadRequestError(
                    "You'r not allowed to change status to " + statusName + '!'
                );
            }
        }

        // admin, tpm,sa cn change status to finished
        if (
            auth.role === constants.USER.ROLES.ADMIN ||
            auth.role === constants.USER.ROLES.TRIPMANAGER ||
            auth.role === constants.USER.ROLES.SUPERADMIN
        ) {
            if (status == WellKnownTripStatus.FINISHED) {
                trip = await tripService.findByIdAndStatusIn(tripId, [
                    WellKnownTripStatus.START,
                ]);

                if (!trip) {
                    throw new BadRequestError(
                        'Trip not found or not in start status!'
                    );
                }

                trip.status = status;
                trip.endedBy = auth.id;
            } else if (status == WellKnownTripStatus.PENDING) {
                trip = await tripService.findByIdAndStatusIn(tripId, [
                    WellKnownTripStatus.START,
                ]);

                if (!trip) {
                    throw new BadRequestError(
                        'Trip not found or not in start status!'
                    );
                }

                let isPlaceReached = trip?.places.find(
                    (place: any) => place.isReached == true
                );

                if (isPlaceReached) {
                    throw new BadRequestError(
                        "Can't change status to pending after reached at least one place!"
                    );
                }

                trip.status = status;
                trip.updatedBy = auth.id;
                trip.startedBy = null;

                // delete expenses
                await expensesService.findAndHardDeleteByTripId(
                    tripId,
                    session
                );
            } else {
                let statusName = helperUtil.getNameFromEnum(
                    WellKnownTripStatus,
                    status
                );
                throw new BadRequestError(
                    "You'r not allowed to change status to " + statusName + '!'
                );
            }
        }

        await tripService.save(trip, session);

        await session.commitTransaction();
    } catch (e) {
        //abort transaction
        await session.abortTransaction();
        throw e;
    } finally {
        //end session
        session.endSession();
    }

    let message = '';
    if (status == WellKnownTripStatus.START) {
        message = 'Trip started successfully!';
    } else if (status == WellKnownTripStatus.FINISHED) {
        message = 'Trip finished successfully!';
    } else if (status == WellKnownTripStatus.PENDING) {
        message = 'Trip pending successfully!';
    }

    CommonResponse(res, true, StatusCodes.OK, message, null);
};

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

const getPlacesByTripId = async (req: Request, res: Response) => {
    const { id } = req.params;

    const trip = await tripService.findTripPlacesByTripIdAndStatusIn(id, [
        WellKnownTripStatus.PENDING,
        WellKnownTripStatus.START,
        WellKnownTripStatus.FINISHED,
    ]);

    if (!trip) {
        throw new BadRequestError('Invalid trip!');
    }

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        '',
        tripUtil.TripModelArrToTripPlaceResponseDtos(trip.places)
    );
};

const markPlaceAsReached = async (req: Request, res: Response) => {
    const { tripId, placeId } = req.params;
    const auth = req.auth;
    const body = req.body;

    const { error } = tripValidation.markPlaceSchema.validate(body);

    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        // get trip by status running
        let trip = await tripService.findByIdAndStatusIn(tripId, [
            WellKnownTripStatus.START,
        ]);

        if (!trip) {
            throw new BadRequestError('Started trip not found!');
        }

        // get active driver
        let driver = trip.drivers.find(
            (driver: any) => driver.isActive == true
        );

        if (!driver) {
            throw new BadRequestError('No active driver found!');
        }

        if (driver.driver?.toString() != auth.id) {
            throw new BadRequestError(
                'Only active driver can update place as reached!'
            );
        }

        // find place by id from place array
        let place = trip.places.find((place: any) => place._id == placeId);

        if (!place) {
            throw new BadRequestError('Place not found!');
        }

        if (place.isReached == true) {
            throw new BadRequestError('Place already reached!');
        }

        // udpate place as reached
        place.isReached = true;
        place.reachedDate = new Date();
        place.reachedBy = auth.id;
        place.location = body.location;

        // save trip
        await tripService.save(trip, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Place marked as reached successfully!',
            null
        );
    } catch (error) {
        throw error;
    }
};

const getTripForReport = async (req: Request, res: Response) => {
    const { id } = req.params;
    const auth = req.auth;

    try {
        let trip: any = await tripService.findByIdAndStatusIn(id, [
            WellKnownTripStatus.PENDING,
            WellKnownTripStatus.START,
            WellKnownTripStatus.FINISHED,
        ]);

        let roleArr = [
            constants.USER.ROLES.ADMIN,
            constants.USER.ROLES.SUPERADMIN,
            constants.USER.ROLES.TRIPMANAGER,
            constants.USER.ROLES.FINANCEOFFICER,
        ];
        if (trip && roleArr.includes(auth.role)) {
            trip = trip.toObject();
            //  get expense by trip id and status active
            let expense: any = await expensesService.findByTripIdAndStatusIn(
                trip._id.toString(),
                [WellKnownStatus.ACTIVE]
            );

            let response: TripExpensesResponseDto | null = null;

            if (expense) {
                // get only active expenses
                let activeExpenses = expense.expenses.filter(
                    (exp: any) => exp.status === WellKnownStatus.ACTIVE
                );

                let totalExpensesAmount = activeExpenses.reduce(
                    (total: number, exp: any) => total + exp.amount,
                    0
                );

                expense.expenses = activeExpenses;
                expense.tripExpensesAmount = expense?.tripId?.estimatedExpense;
                expense.totalTripExpensesAmount = totalExpensesAmount;
                expense.remainingTripExpensesAmount =
                    expense?.tripExpensesAmount - totalExpensesAmount;

                response =
                    expensesUtil.ExpensesModelToTripExpensesResponseDto(
                        expense
                    );
            }

            trip.expenses = response;
        }

        CommonResponse(res, true, StatusCodes.OK, '', trip);
    } catch (error) {
        throw error;
    }
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
    changeTripStatus,
    getPlacesByTripId,
    markPlaceAsReached,
    getTripForReport,
};
