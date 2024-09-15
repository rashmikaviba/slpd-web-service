import Vehicle from "./vehicle.model";

const save = async (vehicle :any, session :any) => {
    if(session){
        return await vehicle.save({ session });
    } else{
        return await vehicle.save();
    }
}

const findByRegistrationNumber = async (registrationNumber :string) => {
}

export default {
    save
}