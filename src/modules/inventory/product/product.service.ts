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
    const cached = cache.getCache(cacheKey);
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

const findAllByIdsAndStatusIn = async (ids: any[], status: number[]) => {
    const byId = new Map<string, any>();
    // ids may be strings, ObjectIds or populated documents; null/undefined are skipped
    const uniqueIds = [...new Set(ids.filter((id) => id != null).map((id) => String(id._id ?? id)))];
    if (uniqueIds.length === 0) return byId;

    const products: any[] = await InventoryProduct.find({
        _id: { $in: uniqueIds },
        status: { $in: status },
    });

    for (const product of products) {
        byId.set(product._id.toString(), product);
    }

    return byId;
}

// Loads the products in one query. The returned function hands out each preloaded document once;
// a repeated request for the same id re-reads it, exactly like the per-item lookup it replaces.
const createBatchLoader = async (ids: any[], status: number[]) => {
    const preloaded = await findAllByIdsAndStatusIn(ids, status);

    return async (id: any) => {
        const key = id == null ? '' : String(id._id ?? id);
        const product = preloaded.get(key);

        if (product) {
            preloaded.delete(key);
            return product;
        }

        return findByIdAndStatusIn(id, status);
    };
}

export default {
    createBatchLoader,
    findAllByIdsAndStatusIn,
    isShortCodeOrProductNameExists,
    save,
    findByIdAndStatusIn,
    findAllAndByStatusIn,
    findProductsLogByProductId,
    findProductLogsByProductId
}