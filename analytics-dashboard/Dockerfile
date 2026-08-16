# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_URL=http://localhost:3000/api
ARG VITE_LOCAL_QA_AUTH_ENABLED=false
ARG VITE_LOCAL_QA_AUTH_TOKEN=
ARG VITE_CLERK_PUBLISHABLE_KEY
ARG VITE_CLERK_JWT_AUDIENCE
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_LOCAL_QA_AUTH_ENABLED=${VITE_LOCAL_QA_AUTH_ENABLED}
ENV VITE_LOCAL_QA_AUTH_TOKEN=${VITE_LOCAL_QA_AUTH_TOKEN}
ENV VITE_CLERK_PUBLISHABLE_KEY=${VITE_CLERK_PUBLISHABLE_KEY}
ENV VITE_CLERK_JWT_AUDIENCE=${VITE_CLERK_JWT_AUDIENCE}

COPY package*.json ./
RUN npm install

COPY . .
# Local-QA bundles deliberately use a non-production Vite mode so the existing
# production guard remains enforced for every normal image build.
RUN if [ "$VITE_LOCAL_QA_AUTH_ENABLED" = "true" ]; then \
      NODE_ENV=development npm run build -- --mode development; \
    else \
      npm run build; \
    fi

# Stage 2: Serve with nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
