interface InsuranceInsuranceRenewalResponseDto {
    _id: string; // vehicle id
    type: number;
    typeName: string;
    vehicleName: string;
    expiryDate: Date;
    description: string;
    createdAt: Date;
}

export default InsuranceInsuranceRenewalResponseDto;
