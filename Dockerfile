# Use the official lightweight Node.js 16 image.
# https://hub.docker.com/_/node
FROM node:16-slim
WORKDIR /hucancode
COPY . ./
RUN npm ci
RUN npm run build
CMD npm run start