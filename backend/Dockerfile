FROM python:3.14.3

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    wget \
    tar \
    fontconfig \
    && rm -rf /var/lib/apt/lists/*

# Download and extract the appropriate Tectonic binary
RUN ARCH=$(uname -m) && \
    if [ "$ARCH" = "aarch64" ]; then \
    wget -qO tectonic.tar.gz "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-aarch64-unknown-linux-musl.tar.gz" ; \
    else \
    wget -qO tectonic.tar.gz "https://github.com/tectonic-typesetting/tectonic/releases/download/tectonic%400.15.0/tectonic-0.15.0-x86_64-unknown-linux-musl.tar.gz" ; \
    fi && \
    tar -xzf tectonic.tar.gz && \
    mv tectonic /usr/local/bin/ && \
    rm tectonic.tar.gz

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
