ls -l /etc/supervisor/conf.d/supervisord.conf
mkdir -p build
npm install
npm run build
exec supervisord -c /etc/supervisor/conf.d/supervisord.conf
# npm run dev
