const save = async (monthAudi: any, session: any) => {
    if (session) {
        return await monthAudi.save({ session });
    } else {
        return await monthAudi.save();
    }
};

export default { save };
