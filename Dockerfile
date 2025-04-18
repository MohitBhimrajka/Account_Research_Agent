FROM python:3.10-slim

# install system libs…
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
    build-essential python3-dev python3-pip \
    python3-setuptools python3-wheel python3-cffi \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libgdk-pixbuf2.0-0 libffi-dev shared-mime-info \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# this line will now also install google-api-core
RUN pip install -r requirements.txt \
 && pip install -e .

CMD ["uvicorn", "app.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
