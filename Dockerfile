FROM node:lts

# Install gosu for user-switching in entrypoint
RUN apt-get update \
 && apt-get install -y --no-install-recommends gosu \
 && rm -rf /var/lib/apt/lists/*

# Match host docker group GID so bind-mounted files are accessible
ARG DOCKER_GID=987

RUN set -eux; \
    if getent group docker >/dev/null; then \
      groupmod -g "${DOCKER_GID}" docker; \
    else \
      groupadd -g "${DOCKER_GID}" docker; \
    fi

# Create svc user with host-matching UID in docker group
ARG SVC_UID=105
RUN useradd -m -u "${SVC_UID}" -g docker -s /bin/bash svc

# Cooperative umask for all shell types
RUN printf 'umask ${UMASK:-0002}\n' > /etc/profile.d/umask.sh \
 && chmod 644 /etc/profile.d/umask.sh \
 && printf '\n# cooperative umask\numask ${UMASK:-0002}\n' >> /etc/bash.bashrc
ENV BASH_ENV=/etc/profile.d/umask.sh
ENV UMASK=0002

# Self-contained entrypoint
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
CMD ["bash"]

WORKDIR /workspace
ENV NPM_CONFIG_CACHE=/tmp/.npm
