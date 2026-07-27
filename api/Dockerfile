FROM node:22-alpine

WORKDIR /app

# Install system dependencies required for 'canvas' module and node-gyp
RUN apk add --no-cache python3 make g++ pkgconfig pixman-dev cairo-dev pango-dev libjpeg-turbo-dev giflib-dev

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose API port
EXPOSE 3030

# Start command
CMD ["npm", "start"]
