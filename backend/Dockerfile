FROM rust:alpine AS build
RUN apk add --no-cache musl-dev
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release --locked

FROM alpine:latest
RUN apk add --no-cache ca-certificates
COPY --from=build /app/target/release/triage-backend /usr/local/bin/triage-backend
ENV PORT=8080
EXPOSE 8080
CMD ["triage-backend"]
