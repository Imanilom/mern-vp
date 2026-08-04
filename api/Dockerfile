FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install system dependencies for node-gyp and canvas (Debian/apt-get)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
RUN npm install --omit=dev

# Copy all source files
COPY . .

# Expose port (default 3030)
EXPOSE 3030

# Command default untuk run API
CMD ["node", "index.js"]
