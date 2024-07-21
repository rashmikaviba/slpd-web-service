import { Request, Response } from 'express';
import commonService from './common.service';
import { WellKnownStatus } from '../../util/enums/well-known-status.enum';
import CommonResponse from '../../util/commonResponse';
import { StatusCodes } from 'http-status-codes';

// Get All Active Genders
const GetAllGenders = async (req: Request, res: Response) => {
    const genders = await commonService.findAllGendersByStatusIn([
        WellKnownStatus.ACTIVE,
    ]);

    CommonResponse(res, true, StatusCodes.OK, '', genders);
};

export { GetAllGenders };
