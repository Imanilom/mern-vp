FROM node:18 AS build-client

WORKDIR /client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

FROM node:18 AS build-api

WORKDIR /api
COPY api/package*.json ./
RUN npm install
COPY api/ ./

# Copy built client into API's public directory (adjust as needed)
COPY --from=build-client /client/build ./public

EXPOSE 3030
CMD ["npm", "start"]
