# Use official Node.js image
FROM node:20.19.4

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the app
COPY . .

# Build the app
RUN npm run build

# Expose port (change if your app uses a different port)
EXPOSE 8080

# Start the app
CMD ["npm", "start"]
