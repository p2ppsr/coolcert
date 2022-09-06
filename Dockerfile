FROM node:16-alpine
EXPOSE 8080
WORKDIR /app
COPY package.json .
RUN npm i
COPY . .
CMD [ "sh", "scripts/start.sh"]
