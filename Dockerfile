# Use the official lightweight Node.js 16 image.
# https://hub.docker.com/_/node
FROM node:16-alpine
WORKDIR /hucancode
COPY . ./
RUN npm ci && npm run build
CMD npm run start