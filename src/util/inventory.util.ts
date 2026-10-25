// One entry of a product's inventoryLogs
const buildInventoryLog = (log: {
    type: number;
    quantity: number;
    before: number;
    after: number;
    productId: any;
    userId: any;
    message: string;
}) => {
    return {
        inventoryLogType: log.type,
        inventoryLogDate: new Date(),
        inventoryLogQuantity: log.quantity,
        beforeTransactionInventory: log.before,
        afterTransactionInventory: log.after,
        inventoryLogProductId: log.productId,
        inventoryLogCreatedBy: log.userId,
        message: log.message,
    };
};

export default { buildInventoryLog };
