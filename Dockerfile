FROM node:20-alpine

RUN npm install -g @crowdlisten/harness

ENV PORT=3848
EXPOSE 3848

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3848/health || exit 1

CMD ["crowdlisten-serve"]
