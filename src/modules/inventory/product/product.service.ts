import constants from "../../../constant";
import cache from "../../../util/cache";
import { WellKnownStatus } from "../../../util/enums/well-known-status.enum";
import InventoryProduct from "./product.model";


const save = async (product: any, session: any) => {
    let prefix = constants.CACHE.PREFIX.PRODUCT;
    cache.clearCacheByPrefixs(prefix);

    if (session) {
        return await product.save({ session });
    } else {
        return await product.save();
    }
};

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
    let cacheKey = constants.CACHE.PREFIX.PRODUCT + JSON.stringify(status);
    const cached = await cache.getCache(cacheKey);
    if (cached) return cached;


    const data: any = await InventoryProduct.find({ status: { $in: status } }, { inventoryLogs: 0 }
    ).populate({
        path: 'createdBy',
        select: 'userName'
    }).populate({
        path: 'updatedBy',
        select: 'userName'
    });

    if (data) {
        cache.setCache(cacheKey, data, constants.CACHE.DURATION.ONE_WEEK);
    }

    return data;
}

const findProductsLogByProductId = async (productId: string) => {
    let logs: any = await InventoryProduct.findOne({ _id: productId }).select('inventoryLogs')

    logs.inventoryLogs.sort((a: any, b: any) => new Date(b.inventoryLogDate).getTime() - new Date(a.inventoryLogDate).getTime());

    return logs.inventoryLogs;
}

const findProductLogsByProductId = async (productId: string) => {
    return await InventoryProduct.findOne({ _id: productId }).select('inventoryLogs').populate({
        path: 'inventoryLogs.inventoryLogCreatedBy',
        select: 'userName'
    });
}

export default {
    isShortCodeOrProductNameExists,
    save,
    findByIdAndStatusIn,
    findAllAndByStatusIn,
    findProductsLogByProductId,
    findProductLogsByProductId
}