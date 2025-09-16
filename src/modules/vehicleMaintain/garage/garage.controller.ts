import { Request, Response } from "express";
import garageValidation from "./garage.validation";
import BadRequestError from "../../../error/BadRequestError";
import Garage from "./garage.model";
import garageService from "./garage.service";
import CommonResponse from "../../../util/commonResponse";
import { StatusCodes } from "http-status-codes";
import { WellKnownStatus } from "../../../util/enums/well-known-status.enum";
import GarageResponseDto from "./dto/garageResponseDto";
import garageUtil from "./garage.util";

const createGarage = async (req: Request, res: Response) => {
    const {
        name,
        address,
        city,
        contactNumber,
        googleMapUrl,
        specializations,
        description
    } = req.body;
    const auth = req.auth;

    const { error } = garageValidation.garageRequestSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        let garage = new Garage({
            name,
            address,
            city,
            contactNumber,
            googleMapUrl,
            specializations,
            description,
            createdBy: auth?.id,
            updatedBy: auth?.id
        });

        let result = await garageService.save(garage, null);

        CommonResponse(
            res,
            true,
            StatusCodes.CREATED,
            'Garage created successfully!',
            result
        );
    } catch (error) {
        throw error;
    }
}


const updateGarage = async (req: Request, res: Response) => {
    const {
        name,
        address,
        city,
        contactNumber,
        googleMapUrl,
        specializations,
        description
    } = req.body;
    const auth = req.auth;
    const id = req.params.id;

    const { error } = garageValidation.garageRequestSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    try {
        let garage = await garageService.findByIdAndStatusIn(id, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

        if (!garage) {
            throw new BadRequestError('Garage not found!');
        }

        garage.name = name;
        garage.address = address;
        garage.city = city;
        garage.contactNumber = contactNumber;
        garage.googleMapUrl = googleMapUrl;
        garage.specializations = specializations;
        garage.description = description;
        garage.updatedBy = auth?.id;

        let result = await garageService.save(garage, null);

        CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Garage updated successfully!',
            result
        );

    } catch (error) {
        throw error;
    }
}

const deleteGarage = async (req: Request, res: Response) => {
    const auth = req.auth;
    const id = req.params.id;

    const garage = await garageService.findByIdAndStatusIn(id, [
        WellKnownStatus.ACTIVE,
        WellKnownStatus.INACTIVE,
    ]);

    if (!garage) {
        throw new BadRequestError('Garage not found!');
    }

    try {
        garage.status = WellKnownStatus.DELETED;
        garage.updatedBy = auth.id;
        await garageService.save(garage, null);

        return CommonResponse(
            res,
            true,
            StatusCodes.OK,
            'Garage deleted successfully!',
            null
        );
    } catch (error) {
        throw error;
    }
}

const getAllGarages = async (req: Request, res: Response) => {
    const garages = await garageService.findAllAndStatusIn([
        WellKnownStatus.ACTIVE,
        WellKnownStatus.INACTIVE,
    ]);

    let response: GarageResponseDto[] = [];

    if (garages && garages.length > 0) {
        response = garageUtil.modelToGarageResponseDtoList(garages);
    }


    return CommonResponse(
        res,
        true,
        StatusCodes.OK,
        '',
        response
    );
}

const getGarageById = async (req: Request, res: Response) => {
    const id = req.params.id;

    const garage = await garageService.findByIdAndStatusIn(id, [
        WellKnownStatus.ACTIVE,
        WellKnownStatus.INACTIVE,
    ]);

    return CommonResponse(
        res,
        true,
        StatusCodes.OK,
        '',
        garage
    );
}

const activeInactiveGarage = async (req: Request, res: Response) => {
    const auth = req.auth;
    const id = req.params.id;

    const garage = await garageService.findByIdAndStatusIn(id, [
        WellKnownStatus.ACTIVE,
        WellKnownStatus.INACTIVE,
    ]);

    if (!garage) {
        throw new BadRequestError('Garage not found!');
    }

    try {
        if (garage.status === WellKnownStatus.ACTIVE) {
            garage.status = WellKnownStatus.INACTIVE;
        } else if (garage.status === WellKnownStatus.INACTIVE) {
            garage.status = WellKnownStatus.ACTIVE;
        }

        garage.updatedBy = auth.id;
        await garageService.save(garage, null);

        let messageString = '';
        if (garage.status == WellKnownStatus.ACTIVE) {
            messageString = 'Garage activated successfully!';
        } else {
            messageString = 'Garage inactivated successfully!';
        }

        return CommonResponse(
            res,
            true,
            StatusCodes.OK,
            messageString,
            null
        );
    } catch (error) {
        throw error;
    }
}

export {
    createGarage,
    updateGarage,
    deleteGarage,
    getAllGarages,
    getGarageById,
    activeInactiveGarage
};
