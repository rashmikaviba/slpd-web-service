import UserResponseDto from './dto/userResponseDto';

const userModelToUserResponseDto = (user: any): UserResponseDto => {
    return {
        _id: user._id,
        fullName: user.fullName,
        userName: user.userName,
        gender: user.gender?.id,
        genderName: user.gender.name,
        dateOfBirth: user.dateOfBirth,
        address: user.address,
        phoneNumber1: user.phoneNumber1,
        phoneNumber2: user.phoneNumber2,
        email: user.email,
        profileImageUrl: user.profileImageUrl,
        nic: user.nic,
        nicImageUrl: user.nicImageUrl,
        gsCertificateUrl: user.gsCertificateUrl,
        drivingLicenseUrl: user.drivingLicenseUrl,
        sltdaCertificateUrl: user.sltdaCertificateUrl,
        policeReportUrl: user.policeReportUrl,
        bankName: user.bankName,
        branch: user.branch,
        accountNumber: user.accountNumber,
        accountHolderName: user.accountHolderName,
        accountHolderAddress: user.accountHolderAddress,
        basicSalary: user.basicSalary,
        leaveCount: user.leaveCount,
        languages: user.languages,
        isBlackListed: user.isBlock ? true : false,
        role: user.role.id,
        roleName: user.role.name,
        createdBy: user.createdBy?._id,
        createdUser: user.createdBy?.fullName,
        updatedBy: user.updatedBy?._id,
        updatedUser: user.updatedBy?.fullName,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
    };
};

const userModelToUserResponseDtos = (users: any[]): UserResponseDto[] => {
    return users.map((user) =>
        userModelToUserResponseDto(user)
    ) as UserResponseDto[];
};

export default { userModelToUserResponseDto, userModelToUserResponseDtos };
