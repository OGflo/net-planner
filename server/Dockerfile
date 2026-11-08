FROM python:3.12-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends iputils-ping net-tools \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY netplanner_server.py config.json ./
COPY web ./web
ENV NETPLANNER_DATA=/data NETPLANNER_PORT=8770
VOLUME ["/data"]
EXPOSE 8770
HEALTHCHECK --interval=30s --timeout=3s CMD python3 -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8770/api/health',timeout=2)"
CMD ["python3", "-u", "netplanner_server.py", "--no-browser"]
