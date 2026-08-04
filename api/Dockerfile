FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install system dependencies for node-gyp and canvas
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev \
    librsvg-dev

# Install dependencies
RUN npm install --omit=dev

# Copy all source files
COPY . .

# Expose port (default 3030)
EXPOSE 3030

# Command default untuk run API
CMD ["node", "index.js"]
