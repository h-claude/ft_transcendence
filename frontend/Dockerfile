FROM node:18 AS build

RUN apt update && apt install -y supervisor
RUN mkdir -p /etc/supervisor/conf.d
COPY ./supervisord.conf /etc/supervisor/conf.d/supervisord.conf

WORKDIR /frontend_dist

COPY ./dist/package.json ./dist/package-lock.json ./

COPY ./dist/ .

COPY startup.sh /startup.sh

ENTRYPOINT ["/bin/bash", "/startup.sh"]
