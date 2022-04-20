# Use the official lightweight Node.js 16 image.
# https://hub.docker.com/_/node
FROM node:16-slim
WORKDIR /hucancode
COPY . ./
RUN npm ci
CMD npm run start