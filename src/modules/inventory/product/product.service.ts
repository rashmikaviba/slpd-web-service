import { WellKnownStatus } from "../../../util/enums/well-known-status.enum";
import InventoryProduct from "./product.model";

const save = async (product: any, session: any) => {
    if (session) {
        return await product.save({ session });
    } else {
        return await product.save();
    }
};

// const isShortCodeOrProductNameExists = async (shortCode: string, name: string, productId: string) => {
//     const query: any = {
//         $or: [
//             { ProductShortCode: { $regex: new RegExp(`^${shortCode}$`, 'i') } },
//             { ProductName: { $regex: new RegExp(`^${name}$`, 'i') } }
//         ]
//     };

//     if (productId) {
//         query._id = { $ne: productId };
//     }

//     const duplicate = await InventoryProduct.findOne(query);

//     return duplicate;
// };

const isShortCodeOrProductNameExists = async (shortCode: string, name: string, productId: string) => {
    const baseFilter = productId ? { _id: { $ne: productId } } : {};

    const [productDuplicate, shortCodeDuplicate] = await Promise.all([
        InventoryProduct.findOne({
            ...baseFilter,
            productName: { $regex: `^${name}$`, $options: 'i' },
            status: { $ne: WellKnownStatus.DELETED }
        }).collation({ locale: 'en', strength: 2 }),

        InventoryProduct.findOne({
            ...baseFilter,
            productShortCode: { $regex: `^${shortCode}$`, $options: 'i' },
            status: { $ne: WellKnownStatus.DELETED }
        }).collation({ locale: 'en', strength: 2 })
    ]);

    return { productDuplicate, shortCodeDuplicate };
};


const findByIdAndStatusIn = async (id: string, status: number[]) => {
    return await InventoryProduct.findOne({
        _id: id,
        status: { $in: status },
    });
}


const findAllAndByStatusIn = async (status: number[]) => {
    return await InventoryProduct.find({ status: { $in: status } }, { inventoryLogs: 0 } // projection: exclude inventoryLogs field
    ).populate({
        path: 'createdBy',
        select: 'userName'
    }).populate({
        path: 'updatedBy',
        select: 'userName'
    });
}

const findProductsLogByProductId = async (productId: string) => {
    let logs: any = await InventoryProduct.findOne({ _id: productId }).select('inventoryLogs')

    logs.inventoryLogs.sort((a: any, b: any) => new Date(b.inventoryLogDate).getTime() - new Date(a.inventoryLogDate).getTime());

    return logs.inventoryLogs;
}


export default {
    isShortCodeOrProductNameExists,
    save,
    findByIdAndStatusIn,
    findAllAndByStatusIn,
    findProductsLogByProductId
}