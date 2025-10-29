import { Request, Response } from "express";
import vehicleService from "../vehicle/vehicle.service";
import vehicleMaintainValidation from "./vehicleMaintenance.validation";
import BadRequestError from "../../error/BadRequestError";
import { WellKnownStatus } from "../../util/enums/well-known-status.enum";
import garageService from "../garage/garage.service";
import vehicleMaintainModel from "./vehicleMaintenance.model";
import vehicleMaintainService from "./vehicleMaintenance.service";
import CommonResponse from "../../util/commonResponse";
import { StatusCodes } from "http-status-codes";
import vehicleMaintenanceUtil from "./vehicleMaintenance.util";
import VehicleMaintenanceResponseDto from "./dto/vehicleMaintenanceResponseDto";
import vehicleMaintenanceInvoiceResponseDto from "./dto/vehicleMaintenanceInvoiceResponseDto";
import companyWorkingInfoService from "../common/service/companyWorkingInfo.service";


const saveVehicleMaintenance = async (req: Request, res: Response,) => {
    const {
        vehicle,
        maintenancePart,
        garage,
        maintenanceDate,
        cost,
        note,
        billImageUrls
    } = req.body;
    const auth = req.auth;

    // Validate request body
    const { error } = vehicleMaintainValidation.saveVehicleMaintenanceSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    const companyInfo = await companyWorkingInfoService.getCompanyWorkingInfo();

    if (!companyInfo) {
        throw new BadRequestError('No active company information found!');
    }

    // check vehicle maintenance date in  workingYear workingMonth in companyInfo
    const isDateInWorkingMonth = vehicleMaintenanceUtil.isDateInWorkingMonth(maintenanceDate, companyInfo.workingYear, companyInfo.workingMonth);

    if (!isDateInWorkingMonth) {
        throw new BadRequestError('Vehicle maintenance date is not in working month!');
    }

    // check vehicle existence
    const existingVehicle = await vehicleService.findByIdAndStatusIn(vehicle, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!existingVehicle) {
        throw new BadRequestError('Invalid vehicle. Vehicle does not exist!');

    }

    // check garage existence
    const existingGarage = await garageService.findByIdAndStatusIn(garage, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!existingGarage) {
        throw new BadRequestError('Invalid garage. Garage does not exist!');
    }

    // create vehicle maintenance record
    let vehicleMaintain = new vehicleMaintainModel({
        vehicle: vehicle,
        maintenancePart: maintenancePart,
        garage: garage,
        maintenanceDate: maintenanceDate,
        cost: cost,
        note: note,
        billImageUrls: billImageUrls,
        createdBy: auth?.id,
        updatedBy: auth?.id,
    })

    await vehicleMaintainService.save(vehicleMaintain, null);

    CommonResponse(
        res,
        true,
        StatusCodes.CREATED,
        'Vehicle maintenance record created successfully',
        vehicleMaintain
    )
}


const updateVehicleMaintenance = async (req: Request, res: Response,) => {
    const {
        vehicle,
        maintenancePart,
        garage,
        maintenanceDate,
        cost,
        note,
        billImageUrls
    } = req.body;
    const auth = req.auth;
    const maintenanceId = req.params.id;

    // Validate request body
    const { error } = vehicleMaintainValidation.saveVehicleMaintenanceSchema.validate(req.body);
    if (error) {
        throw new BadRequestError(error.message);
    }

    // check maintenance record existence
    let vehicleMaintain = await vehicleMaintainService.findByIdAndStatusIn(maintenanceId, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!vehicleMaintain) {
        throw new BadRequestError('Invalid vehicle maintenance!');
    }

    if (vehicleMaintain.isMonthEndDone) {
        throw new BadRequestError('Cannot update vehicle maintenance, Month end process already done!');
    }

    if (vehicleMaintain.vehicle.toString() !== vehicle) {
        // check vehicle existence
        const existingVehicle = await vehicleService.findByIdAndStatusIn(vehicle, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

        if (!existingVehicle) {
            throw new BadRequestError('Invalid vehicle. Vehicle does not exist!');

        }
    }
    if (vehicleMaintain.maintenanceDate !== maintenanceDate) {
        const companyInfo = await companyWorkingInfoService.getCompanyWorkingInfo();

        if (!companyInfo) {
            throw new BadRequestError('No active company information found!');
        }

        // check vehicle maintenance date in  workingYear workingMonth in companyInfo
        const isDateInWorkingMonth = vehicleMaintenanceUtil.isDateInWorkingMonth(maintenanceDate, companyInfo.workingYear, companyInfo.workingMonth);

        if (!isDateInWorkingMonth) {
            throw new BadRequestError('Vehicle maintenance date is not in working month!');
        }
    }

    if (vehicleMaintain.garage.toString() !== garage) {
        // check garage existence
        const existingGarage = await garageService.findByIdAndStatusIn(garage, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

        if (!existingGarage) {
            throw new BadRequestError('Invalid garage. Garage does not exist!');
        }
    }

    // update vehicle maintenance record
    vehicleMaintain.vehicle = vehicle;
    vehicleMaintain.maintenancePart = maintenancePart;
    vehicleMaintain.garage = garage;
    vehicleMaintain.maintenanceDate = maintenanceDate;
    vehicleMaintain.cost = cost;
    vehicleMaintain.note = note;
    vehicleMaintain.billImageUrls = billImageUrls;
    vehicleMaintain.updatedBy = auth?.id;

    await vehicleMaintainService.save(vehicleMaintain, null);

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'Vehicle maintenance updated successfully',
        vehicleMaintain
    )
}

const deleteVehicleMaintenance = async (req: Request, res: Response,) => {
    const maintenanceId = req.params.id;
    const auth = req.auth;

    // check maintenance record existence
    let vehicleMaintain = await vehicleMaintainService.findByIdAndStatusIn(maintenanceId, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    if (!vehicleMaintain) {
        throw new BadRequestError('Invalid vehicle maintenance!');
    }

    if (vehicleMaintain.isMonthEndDone) {
        throw new BadRequestError('Cannot delete vehicle maintenance, Month end process already done!');
    }

    // soft delete vehicle maintenance record
    vehicleMaintain.status = WellKnownStatus.DELETED;
    vehicleMaintain.updatedBy = auth?.id;

    await vehicleMaintainService.save(vehicleMaintain, null);

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'Vehicle maintenance deleted successfully',
        null
    );
}

const getVehicleMaintenanceById = async (req: Request, res: Response,) => {
    const maintenanceId = req.params.id;

    // check maintenance record existence
    let vehicleMaintain = await vehicleMaintainService.findByIdAndStatusIn(maintenanceId, [WellKnownStatus.ACTIVE, WellKnownStatus.INACTIVE]);

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        '',
        vehicleMaintain
    )
}

const getAllVehicleMaintenances = async (req: Request, res: Response,) => {
    const startDate = req.query.startDate as string;
    const endDate = req.query.endDate as string;

    let vehicleMaintenances = await vehicleMaintainService.findAllByMaintenanceDateAndStatusIn([WellKnownStatus.ACTIVE], startDate, endDate);


    let response: VehicleMaintenanceResponseDto[] = [];

    if (vehicleMaintenances && vehicleMaintenances.length > 0) {
        response = vehicleMaintenanceUtil.mapmodelArrToVehicleMaintenanceResponseDtos(vehicleMaintenances);
    }

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        '',
        response
    );
}

const getVehicleMaintenanceInvoice = async (req: Request, res: Response,) => {
    const maintenanceId = req.params.id;

    // check maintenance record existence
    let vehicleMaintain = await vehicleMaintainService.findByIdAndStatusInWithData(maintenanceId, [WellKnownStatus.ACTIVE]);

    let response: vehicleMaintenanceInvoiceResponseDto | null = null;

    if (vehicleMaintain != null) {
        response = vehicleMaintenanceUtil.modelTovehicleMaintainInvoiceResponseDto(vehicleMaintain);
    }

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        '',
        response
    );
}

export {
    saveVehicleMaintenance,
    updateVehicleMaintenance,
    deleteVehicleMaintenance,
    getVehicleMaintenanceById,
    getAllVehicleMaintenances,
    getVehicleMaintenanceInvoice
};