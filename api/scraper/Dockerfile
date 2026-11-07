# Official Playwright image: Python + Chromium + every system library it needs.
FROM mcr.microsoft.com/playwright/python:v1.55.0-noble

WORKDIR /app
ENV PYTHONUNBUFFERED=1 TZ=Africa/Casablanca

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY scrape_latest.py dce_service.py ./

# The same image runs the hourly scraper (default) and dce_service.py (see docker-compose.yml).
ENTRYPOINT ["python", "scrape_latest.py"]
