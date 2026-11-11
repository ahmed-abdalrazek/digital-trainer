# Railway (or any Docker host) image for Tutori.
# Build context is the REPO ROOT, because /admin serves ../index.html and ../assets.
#   docker build -f tutori/Dockerfile -t tutori .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    GRADIO_SERVER_NAME=0.0.0.0

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY tutori/requirements.txt tutori/requirements.txt
RUN pip install -r tutori/requirements.txt

COPY index.html ./index.html
COPY assets ./assets
COPY tutori ./tutori

# SQLite DB, generated audio and voice questions live here — mount a volume on it.
RUN mkdir -p /app/tutori/data

WORKDIR /app/tutori
EXPOSE 7860
CMD ["python", "app.py"]
