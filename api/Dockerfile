FROM node:18-alpine

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose API port
EXPOSE 3030

# Start command
CMD ["npm", "start"]
