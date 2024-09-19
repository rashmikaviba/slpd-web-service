import WorkingInfoResponseDto from "./dto/workingInfoResponseDto";

const companyWorkingInfoToWorkingInfoResponseDto = (
    companyWorkingInfo: any
) : WorkingInfoResponseDto  => {
    return {
        workingMonth: companyWorkingInfo.workingMonth,
        workingYear: companyWorkingInfo.workingYear,
        workingDate: companyWorkingInfo.workingDate,
    };
}

export default { companyWorkingInfoToWorkingInfoResponseDto }