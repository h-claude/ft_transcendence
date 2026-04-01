# #!/bin/bash
# cd /frontend_dist
#
# FILE="./index.html"
# LAST_HASH=$(md5sum "$FILE" | awk '{print $1}')
#
# while true; do
#     sleep 2
#     CURRENT_HASH=$(md5sum "$FILE" | awk '{print $1}')
#
#     if [[ "$CURRENT_HASH" != "$LAST_HASH" ]]; then
# 	echo "recharge a chaudasdfasdfasdf"
# 	rm -rf ./build/styles.css
# 	npm run build:css
#         LAST_HASH=$CURRENT_HASH
#     fi
# done

#!/bin/bash
# cd /frontend_dist
#
# get_files_hash() {
#     find . -type f \( -name "*.html" -o -name "*.ts" \) -exec md5sum {} \; | awk '{print $1}' | sort | md5sum | awk '{print $1}'
# }
#
# LAST_HASH=$(get_files_hash)
#
# while true; do
#     sleep 2
#     CURRENT_HASH=$(get_files_hash)
#
#     if [[ "$CURRENT_HASH" != "$LAST_HASH" ]]; then
#         rm -rf ./build/styles.css
#         npm run build:css
#         LAST_HASH=$CURRENT_HASH
#     fi
# done

#!/bin/bash
cd /frontend_dist

get_files_hash() {
    find . -type f \( -name "*.html" -o -name "*.ts" \) -exec md5sum {} \; \
    && md5sum ./src/styles.css | awk '{print $1}' | sort | md5sum | awk '{print $1}'
}

LAST_HASH=$(get_files_hash)

while true; do
    sleep 2
    CURRENT_HASH=$(get_files_hash)

    if [[ "$CURRENT_HASH" != "$LAST_HASH" ]]; then
        rm -rf ./build/styles.css
        npm run build:css
        LAST_HASH=$CURRENT_HASH
    fi
done

