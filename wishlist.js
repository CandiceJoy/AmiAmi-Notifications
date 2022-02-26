function addItem(name, jancode, price = 10000, allowedItemCondition = "B", allowedBoxCondition = "B") {
    return {
        name: name,
        jancode: jancode,
        price: price,
        allowedItemCondition: allowedItemCondition,
        allowedBoxCondition: allowedBoxCondition
    };
}

export const wishlist = [addItem("FGO Shuten", "4573451870240", 10000),
    addItem("IDK", "4934054109449", 100000)
];