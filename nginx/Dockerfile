FROM debian:bullseye

RUN yes | apt update && yes | apt install nginx openssl

RUN mkdir -p /etc/nginx/ssl && \
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/server.key \
    -out /etc/nginx/ssl/server.crt \
    -subj "/CN=localhost"

RUN sed -i '/listen \[::\]/d' /etc/nginx/sites-available/* /etc/nginx/sites-enabled/* 2>/dev/null || true

RUN rm -f /etc/nginx/nginx.conf
COPY ./conf/nginx.conf /etc/nginx/nginx.conf
COPY ./tools/script.sh /

CMD ["/script.sh"]
