# Use official Python image as base
FROM python:3.12-alpine3.21

# Set working directory
WORKDIR /app

# Copy project files
COPY /app .
COPY /packages/entrypoint.sh ./entrypoint.sh

# Init project dependencies
RUN pip install -r requirements.txt
RUN chmod +x entrypoint.sh

# Expose necessary port(s)
EXPOSE 5000

# # HEALTHCHECK
# RUN apk add --no-cache curl nano sqlite
# HEALTHCHECK --interval=60s --timeout=5s --start-period=5s --retries=3 \
#   CMD curl -f http://localhost:5000/health || exit 1

# Set the entrypoint
ENTRYPOINT ["./entrypoint.sh"]
