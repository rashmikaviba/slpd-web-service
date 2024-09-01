interface UserResponseDto {
    _id: string;
    fullName: string;
    userName: string;
    gender: string;
    genderName: string;
    dateOfBirth: Date;
    address: string;
    phoneNumber1: string;
    phoneNumber2: string;
    email: string;
    profileImageUrl: string;
    nic: string;
    nicImageUrl: string;
    gsCertificateUrl: string;
    drivingLicenseUrl: string;
    sltdaCertificateUrl: string;
    policeReportUrl: string;
    bankName: string;
    bankId: Number;
    branch: string;
    accountNumber: string;
    accountHolderName: string;
    accountHolderAddress: string;
    basicSalary: number;
    leaveCount: number;
    languages: string[];
    role: string;
    roleName: string;
    isBlackListed: boolean;
    createdBy: string;
    createdUser: string;
    updatedBy: string;
    updatedUser: string;
    createdAt: Date;
    updatedAt: Date;
}

export default UserResponseDto;
