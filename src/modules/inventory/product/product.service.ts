import InventoryProduct from "./product.model";

const save = async (product: any, session: any) => {
    if (session) {
        return await product.save({ session });
    } else {
        return await product.save();
    }
};

const isShortCodeOrProductNameExists = async (shortCode: string, name: string, productId: string) => {
    const duplicate = await InventoryProduct.findOne({
        _id: { $ne: productId },
        $or: [
            { ProductShortCode: { $regex: new RegExp(`^${shortCode}$`, 'i') } },
            { ProductName: { $regex: new RegExp(`^${name}$`, 'i') } }
        ]
    });
};

const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return await InventoryProduct.findOne({
        _id: id,
        status: { $in: status },
    }, { inventoryLogs: 0 } // projection: exclude inventoryLogs field
    );
}

const findAllAndByStatusIn = async (status: number[]) => {
    return await InventoryProduct.find({ status: { $in: status } }, { inventoryLogs: 0 } // projection: exclude inventoryLogs field
    );
}

const findProductsLogByProductId = async (productId: string) => {
    let logs: any = await InventoryProduct.findOne({ _id: productId }).select('inventoryLogs')

    logs.inventoryLogs.sort((a: any, b: any) => new Date(b.inventoryLogDate).getTime() - new Date(a.inventoryLogDate).getTime());

    return logs;
}


export default {
    isShortCodeOrProductNameExists,
    save,
    findByIdAndStatusIn,
    findAllAndByStatusIn,
    findProductsLogByProductId
}