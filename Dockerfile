FROM localhost/local-front-build:latest AS web-builder

ARG TARGETARCH
FROM docker.io/library/golang:1.25 AS go-builder

ARG TARGETARCH=amd64
ARG LDFLAGS

WORKDIR /opt/app-root

COPY go.mod go.mod
COPY go.sum go.sum
COPY vendor/ vendor/
COPY cmd/ cmd/
COPY pkg/ pkg/

RUN CGO_ENABLED=0 GOARCH=$TARGETARCH go build -ldflags "$LDFLAGS" -mod vendor -o plugin-backend cmd/plugin-backend.go

FROM --platform=linux/$TARGETARCH registry.access.redhat.com/ubi9/ubi-minimal:9.8-1777460003

COPY --from=web-builder /opt/app-root/web/dist ./web/dist
COPY --from=go-builder /opt/app-root/plugin-backend ./
USER 65532:65532

ENTRYPOINT ["./plugin-backend"]
