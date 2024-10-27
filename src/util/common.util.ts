const generateUniqueId = (enteredIs: string[], prefix: string = '') => {
    let uniqueId = '';
    let isUnique = false;

    while (!isUnique) {
        // Generate an alphanumeric string
        const randomPart = [...Array(8)] // Length of the random part of the ID
            .map(() => Math.random().toString(36)[2]) // Random alphanumeric characters
            .join('');

        // Add current timestamp to the ID
        const timestampPart = Date.now().toString(36); // Convert timestamp to base-36

        // Combine random part with timestamp
        uniqueId = prefix
            ? `${prefix}-${randomPart}-${timestampPart}`
            : `${randomPart}-${timestampPart}`;

        // Ensure uniqueness by checking against enteredIds
        isUnique = !enteredIs.includes(uniqueId);
    }

    return uniqueId;
};

export default { generateUniqueId };
