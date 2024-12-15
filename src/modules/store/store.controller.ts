import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import path from 'path';

import CommonResponse from '../../util/commonResponse';

import { envConfig } from '../../config/environment.config';
import BadRequestError from '../../error/BadRequestError';

const UploadFile = async (req: Request, res: Response) => {
    const file = req.file;

    // check if the file is uploaded
    if (!file) {
        throw new BadRequestError('Please upload a file!');
    }

    let normalizedPath = path.normalize(file.path).replace(/\\/g, '/');
    let pathData = normalizedPath.split('src/').pop();
    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'File uploaded successfully',
        `${envConfig.BASE_URL}/${pathData}`
    );
};


const UploadMultipleFiles = async (req: Request, res: Response) => {
    const files: any = req.files;

    // check if the files are uploaded
    if (!files || files.length === 0) {
        throw new BadRequestError('Please upload a file!');
    }

    let paths: string[] = [];

    files.forEach((file: any) => {
        let path = file.path.split('src/').pop();
        paths.push(`${envConfig.BASE_URL}/${path}`);
    });

    CommonResponse(
        res,
        true,
        StatusCodes.OK,
        'Files uploaded successfully',
        paths
    );
};

export { UploadFile, UploadMultipleFiles };
