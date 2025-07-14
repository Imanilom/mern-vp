FROM node:18

WORKDIR ./

COPY package*.json ./
RUN npm install

COPY . .

# Copy .env file if needed (or use docker-compose env)
# COPY .env .env

EXPOSE 3030
CMD ["npm", "start"]
